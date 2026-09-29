// ═══════════════════════════════════════════════════════════════════
// KINGSHOT MAPPER — HIVE OPTIMIZER
// ═══════════════════════════════════════════════════════════════════
// Places N cities inside the chosen alliance's territory, optimized
// for minimum bear march time (sum of min(B1, B2) per city). No
// manual area drawing — the alliance's territory bbox is the
// working area.
//
// Flow:
//   1. Pick alliance (must have an HQ AND a bear trap nearby).
//   2. Enter city count (1–100).
//   3. Run → enters isolated view, validates, optimizes, previews.
//   4. Cycle variants with ◀ ▶, Apply commits the visible one.
//
// Public API (window):
//   openHiveOpt(), closeHiveOpt(), HiveOpt.{isActive}
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  const _ho = {
    active:     false,
    step:       'config',   // 'config' | 'results'
    alliance:   null,       // tag string
    cityCount:  10,
    rect:       null,       // { x1, y1, x2, y2 } — alliance bbox (inclusive)
    b1Trap:     null,       // building object | null
    b2Trap:     null,       // building object | null
    solutions:  [],         // [{ name, cities:[{gx,gy,t1,t2,cost,viaB1}], totalCost, b1Count, b2Count }]
    solIdx:     0,
    lastValidate: null,     // cached _hoValidate() result for re-runs on count change
  };

  // Register overlay (called at end of every draw frame)
  if (typeof _postDrawHooks !== 'undefined') _postDrawHooks.push(_hoDrawOverlay);

  // ── Tiny helpers ───────────────────────────────────────────────────────────
  function _el(id) { return document.getElementById(id); }
  function _escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
  function _escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ── Alliance dropdown source ───────────────────────────────────────────────
  // Per spec: alliance HQ MUST already exist on the map AND at least one bear
  // trap must sit inside (or right next to) that alliance's territory bbox —
  // without a trap nearby the optimizer has no rally target, so listing the
  // alliance would dead-end the user mid-flow.
  function _allianceLabelsWithHQ() {
    const set = new Set();
    for (const b of buildings) {
      if (b._canonical) continue;
      if (b.type !== 'hq') continue;
      const lbl = (b.label || '').trim();
      if (!lbl) continue;
      set.add(lbl);
    }
    const tsz = BUILDING_DEFS.beartrap.size;
    const out = [];
    for (const lbl of set) {
      const bbox = _allianceBbox(lbl);
      if (!bbox) continue;
      let hasTrap = false;
      for (const b of buildings) {
        if (b._canonical || b.type !== 'beartrap') continue;
        if (b.gx + tsz - 1 < bbox.x1 || b.gx > bbox.x2) continue;
        if (b.gy + tsz - 1 < bbox.y1 || b.gy > bbox.y2) continue;
        hasTrap = true; break;
      }
      if (hasTrap) out.push(lbl);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }

  // ── Bbox of an alliance's territory (for fitCameraToBbox) ──────────────────
  function _allianceBbox(tag) {
    let x1 = GRID_SIZE, y1 = GRID_SIZE, x2 = 0, y2 = 0;
    let any = false;
    if (typeof currentOwnerMap !== 'undefined' && currentOwnerMap.size) {
      for (const [ci, owner] of currentOwnerMap) {
        if (owner !== tag) continue;
        if (typeof _currentOrphanCells !== 'undefined' && _currentOrphanCells.has(ci)) continue;
        const gx = (ci / 1200) | 0, gy = ci % 1200;
        if (gx < x1) x1 = gx; if (gx > x2) x2 = gx;
        if (gy < y1) y1 = gy; if (gy > y2) y2 = gy;
        any = true;
      }
    }
    // Fallback: span of the alliance's HQ + banners by label (ownership not
    // yet computed, or alliance literally just placed HQ this session).
    if (!any) {
      for (const b of buildings) {
        if (b._canonical) continue;
        if (b.type !== 'hq' && b.type !== 'banner') continue;
        if ((b.label || '').trim() !== tag) continue;
        const sz = BUILDING_DEFS[b.type].size;
        if (b.gx < x1) x1 = b.gx;
        if (b.gx + sz > x2) x2 = b.gx + sz;
        if (b.gy < y1) y1 = b.gy;
        if (b.gy + sz > y2) y2 = b.gy + sz;
        any = true;
      }
    }
    if (!any) return null;
    const pad = 20;
    return {
      x1: Math.max(0, x1 - pad),
      y1: Math.max(0, y1 - pad),
      x2: Math.min(GRID_SIZE, x2 + pad),
      y2: Math.min(GRID_SIZE, y2 + pad),
    };
  }

  // ── Open / Close ───────────────────────────────────────────────────────────
  function openHiveOpt() {
    if (_ho.active) return;
    _ho.active = true;
    _ho.step = 'config';
    _ho.alliance = null;
    _ho.rect = null;
    _ho.solutions = [];
    _ho.solIdx = 0;
    _ho.b1Trap = _ho.b2Trap = null;
    const ms = _el('mainSidebar');     if (ms) ms.style.display = 'none';
    const p  = _el('hiveOptPanel');    if (p)  p.style.display  = 'flex';
    // Marker class lets CSS (a) keep the panel visible after we enter
    // isolated view and (b) hide the hive view's share/export/exit chrome
    // so the user can only leave via Apply or Cancel.
    document.body.classList.add('hive-opt-active');
    _hoRenderAllianceDropdown();
    _hoSyncUI();
    scheduleDraw();
  }

  function closeHiveOpt() {
    if (!_ho.active) return;
    _ho.active = false;
    _ho.step = 'config';
    _ho.alliance = null;
    _ho.rect = null;
    _ho.solutions = [];
    _ho.solIdx = 0;
    _ho.b1Trap = _ho.b2Trap = null;
    _ho.lastValidate = null;
    const p  = _el('hiveOptPanel');    if (p)  p.style.display  = 'none';
    const ms = _el('mainSidebar');     if (ms) ms.style.display = '';
    document.body.classList.remove('hive-opt-active');
    if (window.HiveView && HiveView.isActive()) HiveView.close();
    scheduleDraw();
  }

  // Bail back to config step (used by validation error paths). Leaves
  // isolated view so the user can re-pick an alliance.
  function _hoBailToConfig() {
    _ho.rect = null;
    _ho.lastValidate = null;
    _ho.solutions = [];
    _ho.solIdx = 0;
    _ho.b1Trap = _ho.b2Trap = null;
    _ho.step = 'config';
    if (window.HiveView && HiveView.isActive()) HiveView.close();
    _hoSyncUI();
    scheduleDraw();
  }

  // ── Config: alliance + count UI handlers ──────────────────────────────────
  function _hoRenderAllianceDropdown() {
    const sel = _el('hoAllianceSelect');
    if (!sel) return;
    const labels = _allianceLabelsWithHQ();
    sel.innerHTML = `<option value="">— 연맹 선택 —</option>` +
      labels.map(l => `<option value="${_escAttr(l)}">${_escAttr(l)}</option>`).join('');
    if (!labels.length) {
      sel.innerHTML = `<option value="">(본부와 인근 곰 함정이 있는 연맹이 없습니다)</option>`;
    }
  }

  function hoOnAllianceChange(select) {
    _ho.alliance = select.value || null;
    _hoSyncUI();
  }

  function hoOnCityCountChange(input) {
    let n = parseInt(input.value, 10);
    if (!Number.isFinite(n)) n = 10;
    n = Math.max(1, Math.min(100, n));
    input.value = n;
    _ho.cityCount = n;
    // Mirror the new value into every count input so all step views agree.
    for (const id of ['hoCityCount', 'hoCityCountResults']) {
      const other = _el(id);
      if (other && other !== input) other.value = n;
    }
    // Live re-run when a rect is already drawn and we're past validation —
    // no popups, just clamp to capacity and refresh the preview.
    if (_ho.step === 'results' && _ho.rect && _ho.lastValidate) {
      const target = Math.min(n, _ho.lastValidate.candidateSlots);
      if (target >= 1) _hoRun(target, _ho.lastValidate);
    }
    _hoSyncUI();
  }

  // ── Run: enter isolated view + auto-optimize over the alliance bbox ───────
  function hoEnterIsolated() {
    if (!_ho.alliance) return;
    if (!window.HiveView || typeof HiveView.openForArea !== 'function') {
      alert('하이브 보기 모듈이 로드되지 않았습니다.');
      return;
    }
    const bbox = _allianceBbox(_ho.alliance);
    if (!bbox) {
      alert(`연맹 "${_ho.alliance}"의 본부/깃발이 지도에 없습니다.`);
      return;
    }
    if (!HiveView.openForArea(_ho.alliance, bbox)) {
      alert('격리 보기로 전환할 수 없습니다.');
      return;
    }
    _ho.rect = { x1: bbox.x1, y1: bbox.y1, x2: bbox.x2, y2: bbox.y2 };
    _hoValidateAndRun();
  }

  // ── Validate the alliance bbox → confirm warnings → run ───────────────────
  function _hoValidateAndRun() {
    const v = _hoValidate();
    if (v.ownedSlots === 0) {
      alert(`지도에서 "${_ho.alliance}" 영토를 찾을 수 없습니다.`);
      _hoBailToConfig();
      return;
    }
    // Hard block: bear trap is required — without one there's no rally
    // target to optimize against. The dropdown filter should prevent this,
    // but guard anyway in case state changed between open and run.
    if (v.trapCount === 0) {
      alert(`"${_ho.alliance}" 영토 근처에 곰 함정이 없습니다.`);
      _hoBailToConfig();
      return;
    }
    let targetCount = _ho.cityCount;
    if (v.candidateSlots < _ho.cityCount) {
      if (!confirm(`이 영토에는 도시 ${v.candidateSlots}개만 들어갑니다 (요청: ${_ho.cityCount}개). 대신 ${v.candidateSlots}개를 배치할까요?`)) {
        _hoBailToConfig();
        return;
      }
      targetCount = v.candidateSlots;
    }
    if (targetCount === 0) {
      alert('이 영토에는 도시를 배치할 공간이 없습니다.');
      _hoBailToConfig();
      return;
    }
    _ho.lastValidate = v;
    _hoRun(targetCount, v);
  }

  // ── Pre-flight validation ─────────────────────────────────────────────────
  // Walks the rect once collecting: alliance-owned cell count, candidate 2×2
  // positions, bear traps whose footprint intersects.
  function _hoValidate() {
    const rect = _ho.rect;
    const alliance = _ho.alliance;
    let ownedSlots = 0;
    // Owned cells inside rect — needed both for the gate and for the
    // candidate test (every 4 cells of a city must be owned by alliance).
    const ownedMask = new Uint8Array(GRID_SIZE * GRID_SIZE);
    for (let gx = rect.x1; gx <= rect.x2; gx++) {
      for (let gy = rect.y1; gy <= rect.y2; gy++) {
        const ci = gx * 1200 + gy;
        if (currentOwnerMap.get(ci) !== alliance) continue;
        if (_currentOrphanCells && _currentOrphanCells.has(ci)) continue;
        ownedMask[gx * GRID_SIZE + gy] = 1;
        ownedSlots++;
      }
    }
    // Candidate city positions: 2×2 with all four cells owned, not blocked.
    let candidateSlots = 0;
    const candidates = [];
    for (let gx = rect.x1; gx <= rect.x2 - 1; gx++) {
      for (let gy = rect.y1; gy <= rect.y2 - 1; gy++) {
        if (!ownedMask[ gx     * GRID_SIZE +  gy   ]) continue;
        if (!ownedMask[(gx+1)  * GRID_SIZE +  gy   ]) continue;
        if (!ownedMask[ gx     * GRID_SIZE + (gy+1)]) continue;
        if (!ownedMask[(gx+1)  * GRID_SIZE + (gy+1)]) continue;
        if (wouldOverlap(gx, gy, 2, null)) continue;
        if (inForbiddenZone(gx, gy, 2, 'city')) continue;
        candidates.push({ gx, gy });
        candidateSlots++;
      }
    }
    // Bear traps whose 3×3 footprint intersects rect (inclusive cell bounds).
    const tsz = BUILDING_DEFS.beartrap.size;
    const trapsInRect = [];
    for (const b of buildings) {
      if (b._canonical || b.type !== 'beartrap') continue;
      if (b.gx + tsz - 1 < rect.x1 || b.gx > rect.x2) continue;
      if (b.gy + tsz - 1 < rect.y1 || b.gy > rect.y2) continue;
      trapsInRect.push(b);
    }
    return {
      ownedSlots, candidateSlots, candidates,
      trapCount: trapsInRect.length,
      traps: trapsInRect,
    };
  }

  // ── March time formula (matches hive_view.js) ──────────────────────────────
  function _marchTime(cityGx, cityGy, trap) {
    const csz = BUILDING_DEFS.city.size;
    const tsz = BUILDING_DEFS.beartrap.size;
    const dx = (cityGx + csz / 2) - (trap.gx + tsz / 2);
    const dy = (cityGy + csz / 2) - (trap.gy + tsz / 2);
    return Math.round(2.5 * Math.sqrt(dx * dx + dy * dy) + 4);
  }

  // ── Pick the B1/B2 traps from the rect (mirrors hive_view _computeRallyData)
  function _pickTraps(traps, candidates) {
    if (!traps.length) return { b1: null, b2: null };
    // Total time per trap across candidates — used for both
    // intra-slot tiebreaks and the fallback rank.
    const totals = new Map();
    for (const t of traps) {
      let sum = 0;
      for (const c of candidates) sum += _marchTime(c.gx, c.gy, t);
      totals.set(t.id, sum);
    }
    const has1 = traps.filter(t => (t.label || '').includes('1'));
    let b1 = null;
    if (has1.length) {
      b1 = has1.reduce((best, t) => totals.get(t.id) < totals.get(best.id) ? t : best, has1[0]);
    }
    const has2 = traps.filter(t => t !== b1 && (t.label || '').includes('2'));
    let b2 = null;
    if (has2.length) {
      b2 = has2.reduce((best, t) => totals.get(t.id) < totals.get(best.id) ? t : best, has2[0]);
    }
    const rest = traps
      .filter(t => t !== b1 && t !== b2)
      .sort((a, b) => totals.get(a.id) - totals.get(b.id));
    if (!b1 && rest.length) b1 = rest.shift();
    if (!b2 && rest.length) b2 = rest.shift();
    return { b1, b2 };
  }

  // ── Run optimizer → produce variants ──────────────────────────────────────
  // Pre-condition (enforced by _hoValidateAndRun): v.traps has at least one
  // bear trap. _pickTraps decides which become B1/B2.
  function _hoRun(N, v) {
    const { candidates, traps } = v;
    const { b1, b2 } = _pickTraps(traps, candidates);
    _ho.b1Trap = b1;
    _ho.b2Trap = b2;

    // Score every candidate once.
    const scored = candidates.map(c => {
      const t1 = b1 ? _marchTime(c.gx, c.gy, b1) : Infinity;
      const t2 = b2 ? _marchTime(c.gx, c.gy, b2) : Infinity;
      const cost = Math.min(t1, t2);
      return { gx: c.gx, gy: c.gy, t1, t2, cost, viaB1: t1 <= t2 };
    });

    const variants = [];
    variants.push(_variantClosest(scored, N));
    if (b1 && b2) variants.push(_variantBalanced(scored, N));

    // Dedupe by city-set fingerprint.
    const uniq = [];
    const seen = new Set();
    for (const va of variants) {
      if (!va || !va.cities.length) continue;
      const key = va.cities.map(c => c.gx * 1200 + c.gy).sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(va);
    }
    _ho.solutions = uniq;
    _ho.solIdx = 0;
    _ho.step = 'results';
    _hoSyncUI();
    scheduleDraw();
  }

  // ── Variants ───────────────────────────────────────────────────────────────
  // Each variant returns { name, cities:[{gx,gy,t1,t2,cost,viaB1}], totalCost, b1Count, b2Count }
  function _finalizeVariant(name, cities) {
    let total = 0, b1n = 0, b2n = 0;
    for (const c of cities) {
      total += c.cost;
      if (c.viaB1) b1n++;
      else if (c.t2 !== Infinity) b2n++;
    }
    return { name, cities, totalCost: total, b1Count: b1n, b2Count: b2n };
  }

  function _conflicts(gx, gy, claimed) {
    return claimed[gx*GRID_SIZE+gy]
        || claimed[(gx+1)*GRID_SIZE+gy]
        || claimed[gx*GRID_SIZE+(gy+1)]
        || claimed[(gx+1)*GRID_SIZE+(gy+1)];
  }
  function _markClaimed(gx, gy, claimed) {
    claimed[gx*GRID_SIZE+gy] = 1;
    claimed[(gx+1)*GRID_SIZE+gy] = 1;
    claimed[gx*GRID_SIZE+(gy+1)] = 1;
    claimed[(gx+1)*GRID_SIZE+(gy+1)] = 1;
  }
  function _unmarkClaimed(gx, gy, claimed) {
    claimed[gx*GRID_SIZE+gy] = 0;
    claimed[(gx+1)*GRID_SIZE+gy] = 0;
    claimed[gx*GRID_SIZE+(gy+1)] = 0;
    claimed[(gx+1)*GRID_SIZE+(gy+1)] = 0;
  }

  // ── Variant 1: Closest, compactness-weighted + 2-opt polish ────────────────
  // Objective: minimize Σ ( marchTime + ALPHA × distToCentroid ). The
  // compactness term acts as a soft pull toward the chosen cluster, breaking
  // ties (and near-ties) in favour of hives that LOOK like hives instead of
  // a star pattern around the trap. ALPHA = 0.5 means a city 10 cells off the
  // centroid pays a 5-second penalty — small next to typical march times
  // (50–200s) but enough to favour density when the raw cost is similar.
  //
  // After the greedy pass, a bounded 2-opt loop tries to swap each chosen
  // city with any free candidate whose weighted score (using the centroid
  // computed WITHOUT that city) is lower. This refines away the small
  // sacrifices the greedy made for compactness without unraveling the
  // overall shape.
  function _variantClosest(scored, N) {
    const ALPHA = 0.5;
    const claimed = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const cities = [];
    let cx = 0, cy = 0;  // running centroid of chosen cities (top-left coords)

    // Greedy with compactness — O(N × M).
    for (let i = 0; i < N; i++) {
      let best = null, bestScore = Infinity;
      for (const s of scored) {
        if (_conflicts(s.gx, s.gy, claimed)) continue;
        let score = s.cost;
        if (cities.length > 0) {
          const dx = s.gx - cx, dy = s.gy - cy;
          score += ALPHA * Math.sqrt(dx*dx + dy*dy);
        }
        if (score < bestScore) { bestScore = score; best = s; }
      }
      if (!best) break;
      cities.push(best);
      _markClaimed(best.gx, best.gy, claimed);
      const n = cities.length;
      cx = ((n - 1) * cx + best.gx) / n;
      cy = ((n - 1) * cy + best.gy) / n;
    }

    // 2-opt polish — bounded iterations, exits on first stable pass.
    // For each chosen city, recompute the centroid of the OTHER cities and
    // look for any unblocked candidate with a lower weighted score there.
    for (let iter = 0; iter < 10; iter++) {
      let improved = false;
      for (let i = 0; i < cities.length; i++) {
        const cur = cities[i];
        _unmarkClaimed(cur.gx, cur.gy, claimed);

        // Centroid of cities[] \ cur
        let tcx = 0, tcy = 0;
        const others = cities.length - 1;
        if (others > 0) {
          for (let j = 0; j < cities.length; j++) {
            if (j === i) continue;
            tcx += cities[j].gx; tcy += cities[j].gy;
          }
          tcx /= others; tcy /= others;
        }
        const scoreOf = (s) => {
          if (others === 0) return s.cost;
          const dx = s.gx - tcx, dy = s.gy - tcy;
          return s.cost + ALPHA * Math.sqrt(dx*dx + dy*dy);
        };

        let best = cur, bestScore = scoreOf(cur);
        for (const cand of scored) {
          if (cand === cur) continue;
          if (_conflicts(cand.gx, cand.gy, claimed)) continue;
          const sc = scoreOf(cand);
          if (sc < bestScore) { bestScore = sc; best = cand; }
        }
        if (best !== cur) { cities[i] = best; improved = true; }
        _markClaimed(best.gx, best.gy, claimed);
      }
      if (!improved) break;
    }

    return _finalizeVariant('최단 거리', cities);
  }

  // Variant 2: alternates picking from B1-best and B2-best pools to keep
  // counts roughly equal. Slightly more total time than Closest, but each
  // trap rallies a comparable number of cities.
  function _variantBalanced(scored, N) {
    const claimed = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const cities = [];
    const b1Cands = scored.slice().sort((a, b) => a.t1 - b.t1);
    const b2Cands = scored.slice().sort((a, b) => a.t2 - b.t2);
    let b1n = 0, b2n = 0;
    let i1 = 0, i2 = 0;
    // Bookkeeping by candidate index → already chosen?
    const inUse = new Set();
    const keyOf = (s) => s.gx * 1200 + s.gy;
    while (cities.length < N) {
      // Whichever trap has fewer assignees gets next pick.
      const tryB1 = b1n <= b2n;
      let picked = null;
      if (tryB1) {
        while (i1 < b1Cands.length) {
          const s = b1Cands[i1++];
          if (inUse.has(keyOf(s))) continue;
          if (_conflicts(s.gx, s.gy, claimed)) continue;
          picked = s; break;
        }
        if (!picked) {
          while (i2 < b2Cands.length) {
            const s = b2Cands[i2++];
            if (inUse.has(keyOf(s))) continue;
            if (_conflicts(s.gx, s.gy, claimed)) continue;
            picked = s; break;
          }
        }
      } else {
        while (i2 < b2Cands.length) {
          const s = b2Cands[i2++];
          if (inUse.has(keyOf(s))) continue;
          if (_conflicts(s.gx, s.gy, claimed)) continue;
          picked = s; break;
        }
        if (!picked) {
          while (i1 < b1Cands.length) {
            const s = b1Cands[i1++];
            if (inUse.has(keyOf(s))) continue;
            if (_conflicts(s.gx, s.gy, claimed)) continue;
            picked = s; break;
          }
        }
      }
      if (!picked) break;
      cities.push(picked);
      inUse.add(keyOf(picked));
      _markClaimed(picked.gx, picked.gy, claimed);
      // Each chosen city counts for its actual nearest trap (NOT the pool
      // we picked it from — that pool was just for ranking).
      if (picked.viaB1) b1n++; else b2n++;
    }
    return _finalizeVariant('균형 배분', cities);
  }

  // ── Results nav ────────────────────────────────────────────────────────────
  function hoNextSolution() {
    if (!_ho.solutions.length) return;
    _ho.solIdx = (_ho.solIdx + 1) % _ho.solutions.length;
    _hoSyncUI();
    scheduleDraw();
  }
  function hoPrevSolution() {
    if (!_ho.solutions.length) return;
    _ho.solIdx = (_ho.solIdx - 1 + _ho.solutions.length) % _ho.solutions.length;
    _hoSyncUI();
    scheduleDraw();
  }

  // ── Apply: commit the visible variant's cities into buildings[] ───────────
  function hoApply() {
    const sol = _ho.solutions[_ho.solIdx];
    if (!sol || !sol.cities.length) return;
    const tag = _ho.alliance;
    if (!tag) return;

    pushHistory();

    // Applied cities use the default city color — keeps them visually
    // consistent with manually-placed cities. Preview still color-splits
    // by B1/B2 so the optimization is readable before commit.
    const color = (BUILDING_DEFS.city && BUILDING_DEFS.city.defaultColor) || '#4a9edd';

    // Numbering: continue past the highest "[TAG] N" already present.
    const re = new RegExp('^\\[' + _escapeRegExp(tag) + '\\]\\s+(\\d+)$');
    let maxN = 0;
    for (const b of buildings) {
      if (b._canonical || b.type !== 'city') continue;
      const m = (b.label || '').trim().match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxN) maxN = n;
      }
    }
    let n = maxN + 1;
    for (const c of sol.cities) {
      buildings.push({
        id: _genId(),
        type: 'city',
        gx: c.gx, gy: c.gy,
        label: `[${tag}] ${n}`,
        color,
        seq: ++placementSeq,
      });
      n++;
    }
    invalidateBuildings();
    saveToStorage();
    updatePlacedList();

    // Per spec: Apply confirms the placement and exits the whole flow
    // (closes the panel AND leaves isolated view). Cancel via the panel's
    // ✕ button is the other path out.
    const placed = sol.cities.length;
    closeHiveOpt();
    alert(`${tag} 연맹에 도시 ${placed}개를 배치했습니다.`);
    draw();
  }

  // ── UI sync ────────────────────────────────────────────────────────────────
  function _hoSyncUI() {
    // Section visibility per step
    const stepConfig  = _el('hoStepConfig');
    const stepResults = _el('hoStepResults');
    if (stepConfig)  stepConfig.style.display  = (_ho.step === 'config') ? '' : 'none';
    if (stepResults) stepResults.style.display = (_ho.step === 'results') ? '' : 'none';

    // Sync count inputs to the current value (the input the user just
    // edited keeps its caret; the other gets updated for step transitions).
    for (const id of ['hoCityCount', 'hoCityCountResults']) {
      const inp = _el(id);
      if (inp && document.activeElement !== inp && +inp.value !== _ho.cityCount) {
        inp.value = _ho.cityCount;
      }
    }

    // Run button enabled only when alliance + count valid
    const enterBtn = _el('hoEnterBtn');
    if (enterBtn) enterBtn.disabled = !_ho.alliance || _ho.cityCount < 1;

    // Results
    if (_ho.step === 'results' && _ho.solutions.length) {
      const sol = _ho.solutions[_ho.solIdx];
      const name = _el('hoSolName');     if (name) name.textContent = sol.name;
      const idx  = _el('hoSolIdx');      if (idx)  idx.textContent  = `${_ho.solIdx + 1}/${_ho.solutions.length}`;
      const cnt  = _el('hoSolCities');   if (cnt)  cnt.textContent  = sol.cities.length;
      const tot  = _el('hoSolTotal');    if (tot)  tot.textContent  = sol.totalCost;
      const avg  = _el('hoSolAvg');      if (avg)  avg.textContent  = sol.cities.length ? Math.round(sol.totalCost / sol.cities.length) : 0;
      const split = _el('hoSolSplit');
      if (split) {
        split.textContent = _ho.b2Trap
          ? `${sol.b1Count} → B1 · ${sol.b2Count} → B2`
          : `전체 → 단일 함정`;
      }
      const nav = _el('hoSolNav');
      if (nav) nav.style.display = (_ho.solutions.length > 1) ? '' : 'none';
    }
  }

  // ── Overlay (registered above in _postDrawHooks) ──────────────────────────
  function _hoDrawOverlay() {
    if (!_ho.active || !ctx || !canvas) return;
    ctx.save();

    // Highlight chosen bear traps (B1/B2 — gold dashed)
    for (const t of [_ho.b1Trap, _ho.b2Trap]) {
      if (!t) continue;
      const corners = buildingCorners(t.gx, t.gy, BUILDING_DEFS.beartrap.size);
      ctx.beginPath();
      corners.forEach((p, i) => i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy));
      ctx.closePath();
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth   = 3;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Proposed city positions (orange 2×2 diamonds)
    const sol = _ho.solutions[_ho.solIdx];
    if (sol) {
      for (const c of sol.cities) {
        const corners = buildingCorners(c.gx, c.gy, 2);
        ctx.beginPath();
        corners.forEach((p, i) => i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy));
        ctx.closePath();
        ctx.shadowColor = '#000';
        ctx.shadowBlur  = 5;
        // Distinguishable shade per trap: B1 = deep orange, B2 = lighter
        ctx.fillStyle   = c.viaB1 ? '#e65100' : '#ff8f1f';
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 2.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ── Public exports ─────────────────────────────────────────────────────────
  window.HiveOpt = {
    isActive: () => _ho.active,
  };
  window.openHiveOpt        = openHiveOpt;
  window.closeHiveOpt       = closeHiveOpt;
  window.hoOnAllianceChange = hoOnAllianceChange;
  window.hoOnCityCountChange= hoOnCityCountChange;
  window.hoEnterIsolated    = hoEnterIsolated;
  window.hoNextSolution     = hoNextSolution;
  window.hoPrevSolution     = hoPrevSolution;
  window.hoApply            = hoApply;
})();
