// ═══════════════════════════════════════════════════════════════════
// KINGSHOT MAPPER — HIVE VIEW
// ═══════════════════════════════════════════════════════════════════
// Isolated, view-only render of a single alliance's hive (HQ + banners +
// cities + bear trap). Activated either by the "View Hive Plan" button in
// the Alliance Territory Summary modal or by the `?tag=<allianceTag>` URL
// slug (combined with the existing `?map=` cloud share link).
//
// Public API:
//   HiveView.open(tag)        — enter hive view for given alliance label
//   HiveView.close()          — exit hive view and restore prior camera
//   HiveView.isActive()       — true while hive view is showing
//   HiveView.getBbox()        — { x1, y1, x2, y2 } in grid coords (padded)
//   HiveView.getBuildingIdSet()— Set<id> of the hive's buildings (fast filter)
//   HiveView.computeAllianceHive(tag) — pure: returns hive info or null
//
// Cluster detection: union-find on cities with Chebyshev distance ≤ D (25).
// Only the biggest cluster is used; requires ≥10 cities to activate.
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const CLUSTER_DIST   = 25;  // Chebyshev tile threshold for city clustering
  const MIN_CITIES     = 10;  // minimum cluster size to qualify as a hive
  const BBOX_PAD       = 2;   // padding tiles added around the bbox (cities only)

  const _hv = {
    active: false,
    tag: null,
    bbox: null,           // {x1, y1, x2, y2}
    buildingIds: null,    // Set<id>
    prevCam: null,        // {camX, camY, camScale} snapshot for restore
    // Rally-time data, computed once per open() — see _computeRallyData.
    b1Trap: null,         // building object | null
    b2Trap: null,         // building object | null
    cityTimes: null,      // Map<cityId, { b1?: number, b2?: number }>  (rounded seconds)
    bearLabels: null,     // Map<beartrapId, '(TAG) Bear 1' | '(TAG) Bear 2'>
  };

  // ─────────────────────────────────────────────────────────────────
  // CLUSTER DETECTION (union-find on Chebyshev distance)
  // ─────────────────────────────────────────────────────────────────
  function _cluster(items) {
    const n = items.length;
    const parent = new Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;
    function find(i) {
      while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
      return i;
    }
    function union(a, b) {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    }
    // O(n²) — fine for ~50 cities per alliance.
    for (let i = 0; i < n; i++) {
      const ci = items[i];
      const cxi = ci.gx + ci._size / 2;
      const cyi = ci.gy + ci._size / 2;
      for (let j = i + 1; j < n; j++) {
        const cj = items[j];
        const cxj = cj.gx + cj._size / 2;
        const cyj = cj.gy + cj._size / 2;
        const dx = Math.abs(cxi - cxj);
        const dy = Math.abs(cyi - cyj);
        if (Math.max(dx, dy) <= CLUSTER_DIST) union(i, j);
      }
    }
    const groups = new Map();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      let arr = groups.get(r);
      if (!arr) { arr = []; groups.set(r, arr); }
      arr.push(items[i]);
    }
    return [...groups.values()];
  }

  // ─────────────────────────────────────────────────────────────────
  // computeAllianceHive(tag) — returns { tag, buildings, bbox, cityCount }
  // or null if the alliance has no qualifying ≥10-city cluster.
  //
  // Attribution rules:
  //   • HQ + banners belong to the alliance by LABEL (their tag is the
  //     canonical identifier).
  //   • Cities belong by TERRITORY OWNERSHIP (≥majority of their cells
  //     owned by the alliance's HQ-connected territory) — their own
  //     labels are player names, not alliance tags.
  //   • Bear traps belong by BBOX containment (any bear trap whose
  //     footprint intersects the hive's bbox is included as a rally
  //     option, regardless of which alliance owns the cells beneath it).
  // ─────────────────────────────────────────────────────────────────
  function computeAllianceHive(tag, ownerMapArg) {
    // `buildings` and `BUILDING_DEFS` live in core.js's script-level lexical
    // scope — accessible by bare name from other classic scripts, but NOT on
    // window. `typeof` guards against the (impossible-in-practice) case
    // where core.js hasn't loaded yet.
    if (typeof buildings === 'undefined' || typeof BUILDING_DEFS === 'undefined') return null;
    const trimmed = String(tag || '').trim();
    if (!trimmed) return null;

    // Use the caller's ownership map when provided (e.g. computeAllianceSummary
    // passes in its fresh map so we don't recompute per alliance). Otherwise
    // build one — avoids race conditions with the async BFS worker on URL load.
    const ownerMap = ownerMapArg || (
      typeof buildOwnershipMap === 'function'
        ? buildOwnershipMap(buildings)
        : (typeof currentOwnerMap !== 'undefined' ? currentOwnerMap : new Map())
    );

    function _ownedBy(b) {
      const def = BUILDING_DEFS[b.type];
      if (!def) return false;
      const cells = def.size * def.size;
      const need = Math.ceil(cells / 2) + (cells % 2 === 0 ? 1 : 0); // strict majority
      let count = 0;
      for (let x = b.gx; x < b.gx + def.size; x++) {
        for (let y = b.gy; y < b.gy + def.size; y++) {
          const owner = ownerMap.get(x * 1200 + y);
          if (owner && owner.trim() === trimmed) {
            count++;
            if (count >= need) return true;
          }
        }
      }
      return false;
    }

    // HQ + banners (label match)
    const allianceTerrBldg = [];
    for (const b of buildings) {
      if (b._canonical) continue;
      if (b.type !== 'hq' && b.type !== 'banner') continue;
      if (!b.label || b.label.trim() !== trimmed) continue;
      allianceTerrBldg.push(b);
    }
    if (!allianceTerrBldg.length) return null;

    // Cities (ownership match) — only owned cities count toward clustering.
    const ownedCities = [];
    for (const b of buildings) {
      if (b._canonical) continue;
      if (b.type === 'city' && _ownedBy(b)) {
        ownedCities.push({ gx: b.gx, gy: b.gy, _size: BUILDING_DEFS.city.size, ref: b });
      }
    }
    if (ownedCities.length < MIN_CITIES) return null;

    // Bear traps — collect ALL, regardless of ownership. They get added to
    // the hive set below if their footprint intersects the bbox.
    const allBeartraps = [];
    for (const b of buildings) {
      if (!b._canonical && b.type === 'beartrap') allBeartraps.push(b);
    }

    const clusters = _cluster(ownedCities);
    let biggest = clusters[0];
    for (const c of clusters) if (c.length > biggest.length) biggest = c;
    if (biggest.length < MIN_CITIES) return null;

    // Bounding box from CITIES ONLY (outermost city in each direction
    // + BBOX_PAD cells). Computed BEFORE the hive-set assembly so we can
    // use it to admit non-owned bear traps by intersection.
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const citySz = BUILDING_DEFS.city.size;
    for (const c of biggest) {
      if (c.gx < x1) x1 = c.gx;
      if (c.gy < y1) y1 = c.gy;
      if (c.gx + citySz > x2) x2 = c.gx + citySz;
      if (c.gy + citySz > y2) y2 = c.gy + citySz;
    }
    const GS = (typeof GRID_SIZE !== 'undefined') ? GRID_SIZE : 1200;
    x1 = Math.max(0, x1 - BBOX_PAD);
    y1 = Math.max(0, y1 - BBOX_PAD);
    x2 = Math.min(GS, x2 + BBOX_PAD);
    y2 = Math.min(GS, y2 + BBOX_PAD);

    // Hive set:
    //   • Every cluster city.
    //   • Alliance HQ/banner within CLUSTER_DIST of any cluster city
    //     (proximity-based; they belong by label).
    //   • Any bear trap whose footprint intersects the bbox (regardless
    //     of which alliance owns the cells beneath it).
    const hive = [];
    const inHive = new Set();
    for (const c of biggest) {
      hive.push(c.ref);
      inHive.add(c.ref.id);
    }
    for (const b of allianceTerrBldg) {
      if (inHive.has(b.id)) continue;
      const bdef = BUILDING_DEFS[b.type];
      const bcx = b.gx + bdef.size / 2;
      const bcy = b.gy + bdef.size / 2;
      for (const c of biggest) {
        const ccx = c.gx + c._size / 2;
        const ccy = c.gy + c._size / 2;
        if (Math.max(Math.abs(bcx - ccx), Math.abs(bcy - ccy)) <= CLUSTER_DIST) {
          hive.push(b);
          inHive.add(b.id);
          break;
        }
      }
    }
    const tsz = BUILDING_DEFS.beartrap.size;
    for (const b of allBeartraps) {
      if (inHive.has(b.id)) continue;
      // Footprint intersection with bbox: building cells span
      // [gx, gx+size) × [gy, gy+size); admit if any cell is inside.
      if (b.gx + tsz > x1 && b.gx < x2 && b.gy + tsz > y1 && b.gy < y2) {
        hive.push(b);
        inHive.add(b.id);
      }
    }

    return {
      tag: trimmed,
      buildings: hive,
      bbox: { x1, y1, x2, y2 },
      cityCount: biggest.length,
    };
  }

  // For Alliance Summary gating — cheap-ish wrapper that only returns the
  // biggest cluster size, used to decide whether to render the button.
  function biggestCityClusterFor(tag, ownerMapArg) {
    const r = computeAllianceHive(tag, ownerMapArg);
    return r ? r.cityCount : 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // _computeRallyData(hive) — pick the B1/B2 bear trap pair and
  // precompute each city's rounded march time to each.
  //
  // Step A: honour user-designated traps — any trap whose own label
  //   contains "1" claims the B1 slot; any with "2" claims B2.
  //   Multiple candidates per slot → pick the one with the lowest
  //   sum-of-city-times.
  // Step B: fill remaining slot(s) by per-trap totalTime ascending.
  //
  // Time formula: round(2.5 × euclidean(cityCenter, trapCenter) + 4).
  // Returns { b1Trap, b2Trap, cityTimes, bearLabels }.
  // ─────────────────────────────────────────────────────────────────
  function _computeRallyData(hive) {
    const out = { b1Trap: null, b2Trap: null, cityTimes: new Map(), bearLabels: new Map() };

    // Partition the hive set into cities and bear traps.
    const traps = [], cities = [];
    for (const b of hive.buildings) {
      if (b.type === 'beartrap') traps.push(b);
      else if (b.type === 'city') cities.push(b);
    }
    if (!traps.length) return out;

    // Helper: rounded march time from city to trap, Euclidean center-to-center.
    function _timeTo(city, trap) {
      const csz = BUILDING_DEFS.city.size;
      const tsz = BUILDING_DEFS.beartrap.size;
      const dx = (city.gx + csz / 2) - (trap.gx + tsz / 2);
      const dy = (city.gy + csz / 2) - (trap.gy + tsz / 2);
      return Math.round(2.5 * Math.sqrt(dx * dx + dy * dy) + 4);
    }

    // Per-trap sum of times across all hive cities — used both for ranking
    // candidates within a slot and for the time-based fallback.
    const totalTimes = new Map();
    for (const t of traps) {
      let sum = 0;
      for (const c of cities) sum += _timeTo(c, t);
      totalTimes.set(t.id, sum);
    }

    // Step A: label-priority assignment.
    const has1 = traps.filter(t => (t.label || '').includes('1'));
    let b1 = null, b2 = null;
    if (has1.length) {
      b1 = has1.reduce((best, t) => totalTimes.get(t.id) < totalTimes.get(best.id) ? t : best, has1[0]);
    }
    const has2 = traps.filter(t => t !== b1 && (t.label || '').includes('2'));
    if (has2.length) {
      b2 = has2.reduce((best, t) => totalTimes.get(t.id) < totalTimes.get(best.id) ? t : best, has2[0]);
    }

    // Step B: fill remaining slots from the rest, ranked by totalTime ASC.
    const remaining = traps
      .filter(t => t !== b1 && t !== b2)
      .sort((a, b) => totalTimes.get(a.id) - totalTimes.get(b.id));
    if (!b1 && remaining.length) b1 = remaining.shift();
    if (!b2 && remaining.length) b2 = remaining.shift();

    out.b1Trap = b1 || null;
    out.b2Trap = b2 || null;

    // Bear trap display labels (one per designated trap).
    const tag = hive.tag;
    if (out.b1Trap) out.bearLabels.set(out.b1Trap.id, `(${tag}) 곰 1`);
    if (out.b2Trap) out.bearLabels.set(out.b2Trap.id, `(${tag}) 곰 2`);

    // Per-city times.
    for (const c of cities) {
      const entry = {};
      if (out.b1Trap) entry.b1 = _timeTo(c, out.b1Trap);
      if (out.b2Trap) entry.b2 = _timeTo(c, out.b2Trap);
      out.cityTimes.set(c.id, entry);
    }

    return out;
  }

  // ─────────────────────────────────────────────────────────────────
  // open / close
  // ─────────────────────────────────────────────────────────────────
  function open(tag) {
    if (_hv.active) close();
    const hive = computeAllianceHive(tag);
    if (!hive) {
      console.warn('[HiveView] No ≥' + MIN_CITIES + '-city cluster for alliance: ' + tag);
      return false;
    }
    _hv.active = true;
    _hv.tag = hive.tag;
    _hv.bbox = hive.bbox;
    _hv.buildingIds = new Set(hive.buildings.map(b => b.id));
    _hv.prevCam = (typeof camX !== 'undefined')
      ? { camX, camY, camScale }
      : null;

    // Rally data: pick B1/B2 traps + precompute every city's march times.
    const rally = _computeRallyData(hive);
    _hv.b1Trap     = rally.b1Trap;
    _hv.b2Trap     = rally.b2Trap;
    _hv.cityTimes  = rally.cityTimes;
    _hv.bearLabels = rally.bearLabels;

    document.body.classList.add('hive-view-active');
    _showHeader(hive.tag);
    _syncUrlTag(hive.tag);

    // The sidebar/header/toolbar all collapse via CSS when .hive-view-active
    // is added — the canvas-wrap expands but the canvas's drawing buffer is
    // still sized for the old layout, leaving a dark gap. resizeCanvas()
    // reads the new wrap.clientWidth/Height and re-sets canvas.width/height.
    if (typeof resizeCanvas === 'function') resizeCanvas();
    if (typeof fitCameraToBbox === 'function') {
      fitCameraToBbox(hive.bbox.x1, hive.bbox.y1, hive.bbox.x2, hive.bbox.y2);
    }
    if (typeof invalidateBuildings === 'function') invalidateBuildings();
    if (typeof scheduleDraw === 'function') scheduleDraw();
    return true;
  }

  function close() {
    if (!_hv.active) return;
    _hv.active = false;
    _hv.tag = null;
    _hv.bbox = null;
    _hv.buildingIds = null;
    _hv.b1Trap = null;
    _hv.b2Trap = null;
    _hv.cityTimes = null;
    _hv.bearLabels = null;

    document.body.classList.remove('hive-view-active');
    _hideHeader();
    _clearUrlTag();

    // Sidebar/header re-appears — re-size the canvas drawing buffer to match
    // the (now smaller) canvas-wrap, otherwise there's overflow on the right.
    if (typeof resizeCanvas === 'function') resizeCanvas();

    if (_hv.prevCam && typeof camX !== 'undefined') {
      // camX/camY/camScale are let-declared in core.js — they live in the
      // shared GlobalEnv lexical record, NOT on window. Assign by bare name
      // so core.js reads the restored values.
      camX     = _hv.prevCam.camX;
      camY     = _hv.prevCam.camY;
      camScale = _hv.prevCam.camScale;
      if (typeof updateZoomDisplay === 'function') updateZoomDisplay();
    }
    _hv.prevCam = null;

    if (typeof invalidateBuildings === 'function') invalidateBuildings();
    if (typeof scheduleDraw === 'function') scheduleDraw();
  }

  // ─────────────────────────────────────────────────────────────────
  // openForArea(tag, bbox) — enter isolated view without requiring a
  // ≥10-city cluster. Used by the hive optimizer to focus on an
  // alliance the user explicitly picked plus a user-drawn working area.
  //
  // Differs from open():
  //   • Skips the cluster size check.
  //   • Uses the caller-supplied bbox instead of computing one from cities.
  //   • The "hive" building set is everything (no isolation filter),
  //     which lets the optimizer freely see the alliance's full territory.
  //     Visual collapse of sidebar/header still happens via .hive-view-active.
  // ─────────────────────────────────────────────────────────────────
  function openForArea(tag, bbox) {
    if (_hv.active) close();
    const trimmed = String(tag || '').trim();
    if (!trimmed || !bbox) return false;

    _hv.active = true;
    _hv.tag = trimmed;
    _hv.bbox = { x1: bbox.x1, y1: bbox.y1, x2: bbox.x2, y2: bbox.y2 };
    _hv.buildingIds = null;     // null → "no isolation filter, show all"
    _hv.b1Trap = null;
    _hv.b2Trap = null;
    _hv.cityTimes = null;
    _hv.bearLabels = null;
    _hv.prevCam = (typeof camX !== 'undefined')
      ? { camX, camY, camScale }
      : null;

    document.body.classList.add('hive-view-active');
    _showHeader(trimmed);
    _syncUrlTag(trimmed);

    if (typeof resizeCanvas === 'function') resizeCanvas();
    if (typeof fitCameraToBbox === 'function') {
      fitCameraToBbox(_hv.bbox.x1, _hv.bbox.y1, _hv.bbox.x2, _hv.bbox.y2);
    }
    if (typeof invalidateBuildings === 'function') invalidateBuildings();
    if (typeof scheduleDraw === 'function') scheduleDraw();
    return true;
  }

  function isActive()         { return _hv.active === true; }
  function getBbox()          { return _hv.bbox; }
  function getBuildingIdSet() { return _hv.buildingIds; }
  function getTag()           { return _hv.tag; }

  // Per-city march times to the designated B1/B2 traps (rounded seconds).
  // Returns { b1?, b2? } or null when no times were precomputed for this id.
  function getCityTimes(id) {
    if (!_hv.active || !_hv.cityTimes) return null;
    return _hv.cityTimes.get(id) || null;
  }

  // Display label override for a hive bear trap (e.g. "(ALB) Bear 1").
  // Returns null for any non-designated trap.
  function getBearLabel(id) {
    if (!_hv.active || !_hv.bearLabels) return null;
    return _hv.bearLabels.get(id) || null;
  }

  function isHiveBuilding(b) {
    if (!_hv.active || !_hv.buildingIds) return false;
    return _hv.buildingIds.has(b.id);
  }

  // ─────────────────────────────────────────────────────────────────
  // URL: add / remove &tag= without reloading
  // ─────────────────────────────────────────────────────────────────
  function _syncUrlTag(tag) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tag', tag);
      window.history.replaceState({}, '', url.toString());
    } catch (e) { /* non-fatal */ }
  }
  function _clearUrlTag() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('tag');
      const qs = url.searchParams.toString();
      const newUrl = url.pathname + (qs ? '?' + qs : '') + url.hash;
      window.history.replaceState({}, '', newUrl);
    } catch (e) { /* non-fatal */ }
  }

  // ─────────────────────────────────────────────────────────────────
  // Header strip (alliance tag + exit link)
  // ─────────────────────────────────────────────────────────────────
  function _showHeader(tag) {
    const el = document.getElementById('hiveViewHeader');
    if (!el) return;
    const tagEl = el.querySelector('.hive-view-tag');
    if (tagEl) tagEl.textContent = tag;
    el.style.display = 'flex';
  }
  function _hideHeader() {
    const el = document.getElementById('hiveViewHeader');
    if (el) el.style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────────
  // diagnose(tag) — console helper to investigate why an alliance's
  // "View Hive Plan" button isn't showing. Logs counts at each step.
  // ─────────────────────────────────────────────────────────────────
  function diagnose(tag) {
    const trimmed = String(tag || '').trim();
    if (!trimmed) { console.log('Usage: HiveView.diagnose("PHZ")'); return; }
    if (typeof buildings === 'undefined' || !buildings.length) {
      console.log('No buildings loaded.');
      return;
    }

    const ownerMap = (typeof buildOwnershipMap === 'function')
      ? buildOwnershipMap(buildings)
      : (typeof currentOwnerMap !== 'undefined' ? currentOwnerMap : new Map());

    const hqs = [], banners = [], orphanBanners = [];
    for (const b of buildings) {
      if (b._canonical) continue;
      if (!b.label || b.label.trim() !== trimmed) continue;
      if (b.type === 'hq') hqs.push(b);
      else if (b.type === 'banner') (b._orphan ? orphanBanners : banners).push(b);
    }

    let allCities = 0;
    const ownedCities = [];
    const SZ = BUILDING_DEFS.city.size;
    for (const b of buildings) {
      if (b._canonical || b.type !== 'city') continue;
      allCities++;
      let cellsOwnedByMe = 0;
      for (let x = b.gx; x < b.gx + SZ; x++) {
        for (let y = b.gy; y < b.gy + SZ; y++) {
          const owner = ownerMap.get(x * 1200 + y);
          if (owner && owner.trim() === trimmed) cellsOwnedByMe++;
        }
      }
      if (cellsOwnedByMe >= 3) {
        ownedCities.push({ gx: b.gx, gy: b.gy, _size: SZ, ref: b, _cellsOwned: cellsOwnedByMe });
      }
    }

    const clusters = ownedCities.length ? _cluster(ownedCities) : [];
    clusters.sort((a, b) => b.length - a.length);
    const biggest = clusters[0] || [];

    console.group(`HiveView.diagnose("${trimmed}")`);
    console.log(`Alliance buildings: ${hqs.length} HQ, ${banners.length} valid banners, ${orphanBanners.length} orphan banners`);
    console.log(`Total cities on map: ${allCities}`);
    console.log(`Cities owned by ${trimmed} (≥3 of 4 cells, orphan-included): ${ownedCities.length}`);
    console.log(`Clusters formed at D=${CLUSTER_DIST}: ${clusters.length}`);
    console.log(`Biggest cluster: ${biggest.length} cities`);
    console.log(`Required minimum: ${MIN_CITIES}`);
    if (biggest.length >= MIN_CITIES) {
      console.log('✓ Hive view should show. If it isn\'t, the bug is elsewhere — share this diagnose output.');
    } else if (ownedCities.length === 0) {
      console.warn('No cities found owned by this alliance. Either:');
      console.warn('  • The label "' + trimmed + '" doesn\'t match any banner/HQ label exactly (check case/whitespace).');
      console.warn('  • No banner/HQ for this alliance has claimed cells under any city.');
    } else if (ownedCities.length < MIN_CITIES) {
      console.warn(`Only ${ownedCities.length} cities are inside this alliance's territory by the ≥3/4-cell rule.`);
    } else {
      console.warn(`Cities are split into ${clusters.length} clusters; biggest is ${biggest.length} (< ${MIN_CITIES}).`);
      console.warn(`Cluster sizes (top 10): ${clusters.slice(0,10).map(c => c.length).join(', ')}`);
      console.warn(`Try raising CLUSTER_DIST (currently ${CLUSTER_DIST}) if cities are spread out.`);
      const top = clusters.slice(0, 5).map(c => {
        let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
        for (const ct of c) {
          x1 = Math.min(x1, ct.gx); y1 = Math.min(y1, ct.gy);
          x2 = Math.max(x2, ct.gx + ct._size); y2 = Math.max(y2, ct.gy + ct._size);
        }
        return { count: c.length, bbox: `(${x1},${y1})-(${x2},${y2})`, span: `${x2-x1}×${y2-y1}` };
      });
      console.table(top);
    }
    console.groupEnd();
    return { ownedCities: ownedCities.length, biggestCluster: biggest.length, clusters: clusters.length };
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC EXPORT
  // ─────────────────────────────────────────────────────────────────
  window.HiveView = {
    open, openForArea, close, isActive, getBbox, getBuildingIdSet, getTag,
    getCityTimes, getBearLabel,
    isHiveBuilding, computeAllianceHive, biggestCityClusterFor, diagnose,
  };
})();
