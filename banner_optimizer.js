/**
 * Banner Optimizer
 * UI: starting-point & target outpost selection, map highlighting.
 * Algorithm: greedy BFS Steiner tree — minimizes new banners to reach all selected targets.
 */
(function () {
  'use strict';

  // ── The 12 selectable outpost types (per game) ────────────────────────────
  // Outpost positions are identical between games; only the label strings may differ.
  // OUTPOST_LABELS must match the `label` field in PERMANENT_BUILDINGS for the active game.
  const OUTPOST_LABELS_KINGSHOT = [
    "Builder's Guild 1",
    "Builder's Guild 3",
    "Armory 2",
    "Armory 4",
    "Scholar's 1",
    "Scholar's 3",
    "Arsenal 2",
    "Arsenal 4",
    "Forager 1",
    "Harvest 1",
    "Drill Camp 2",
    "Frontier 3",
  ];

  const OUTPOST_DISPLAY_KINGSHOT = {
    "Builder's Guild 1": "건설 전초기지 — Lv.1",
    "Builder's Guild 3": "건설 전초기지 — Lv.3",
    "Armory 2":          "방어 전초기지 — Lv.2",
    "Armory 4":          "방어 전초기지 — Lv.4",
    "Scholar's 1":       "연구 전초기지 — Lv.1",
    "Scholar's 3":       "연구 전초기지 — Lv.3",
    "Arsenal 2":         "공격 전초기지 — Lv.2",
    "Arsenal 4":         "공격 전초기지 — Lv.4",
    "Forager 1":         "채집 전초기지 — Lv.1",
    "Harvest 1":         "자원 생산 전초기지 — Lv.1",
    "Drill Camp 2":      "훈련 전초기지 — Lv.2",
    "Frontier 3":        "개척자 오두막 — Lv.3",
  };

  const OUTPOST_LABELS  = OUTPOST_LABELS_KINGSHOT;
  const OUTPOST_DISPLAY = OUTPOST_DISPLAY_KINGSHOT;

  // ── State ──────────────────────────────────────────────────────────────────
  const _bo = {
    active: false,
    mode: null,          // 'pick-start' | null
    startBuilding: null, // { id, gx, gy, label, type } — set when picked from map
    startAlliance: null, // alliance label string — set when picked from dropdown
    targets: {},         // { label: permIdx }  — one selection per outpost type
    opts: { sameAlliance: true, captureResources: true, autoPickTargets: false },
    results: null,       // currently displayed solution { banners, bannerCount, resourceCount, unreachable, newTerrCells }
    solutions: [],       // all unique solutions from _boRunAllVariants()
    solIdx: 0,           // index into solutions[] currently shown
  };

  // The "effective" alliance the algorithm should use, regardless of which UI
  // path the user took to specify it.
  function _boEffectiveAlliance() {
    if (_bo.startAlliance) return _bo.startAlliance;
    if (_bo.startBuilding) return (_bo.startBuilding.label || '').trim();
    return '';
  }

  // Distinct alliance labels currently on the map (non-canonical banners/HQs
  // with non-generic labels). Sorted for stable dropdown ordering.
  function _boActiveAllianceLabels() {
    const set = new Set();
    for (const b of buildings) {
      if (b._canonical) continue;
      if (b.type !== 'banner' && b.type !== 'hq') continue;
      const lbl = (b.label || '').trim();
      if (!lbl || _isGenericLabel(lbl)) continue;
      set.add(lbl);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function _boFacilityTerm() {
    return { sing: '전초기지',  plur: '전초기지',   singCap: '전초기지',  plurCap: '전초기지'  };
  }

  function _boUpdateTerminology() {
    const { sing, plur, plurCap } = _boFacilityTerm();
    const title = _el('boTargetSectionTitle');
    if (title) title.textContent = `목표 ${plurCap}`;
    const autoLbl = _el('boAutoPickLabelText');
    if (autoLbl) autoLbl.textContent = `🎯 종류별로 가장 가까운 ${sing} 자동 선택`;
    const manHint = _el('boTargetManualHint');
    if (manHint) manHint.textContent = `지도에서 ${plur}를 클릭하거나, 종류를 펼쳐 위치별로 선택하세요.`;
    const autoHint = _el('boTargetAutoHint');
    if (autoHint) autoHint.textContent = `최적화를 실행하면 종류별로 도달 가능한 가장 가까운 ${sing}를 선택합니다.`;
  }

  function _boRenderAllianceDropdown() {
    const sel = _el('boAllianceSelect');
    if (!sel) return;
    const labels = _boActiveAllianceLabels();
    const current = _bo.startAlliance || '';
    sel.innerHTML = `<option value="">— 또는 연맹 선택 —</option>` +
      labels.map(l =>
        `<option value="${_escAttr(l)}"${l === current ? ' selected' : ''}>${_escAttr(l)}</option>`
      ).join('');
  }

  // Push opts.autoPickTargets state into the UI (checkbox, accordion visibility,
  // hint swap). Called on open and whenever the toggle flips.
  function _boSyncAutoPickUI() {
    const auto = _bo.opts.autoPickTargets;
    const chk = _el('boOptAutoPickTargets');
    if (chk) chk.checked = auto;
    const accordion = _el('boAccordion');
    if (accordion) accordion.style.display = auto ? 'none' : '';
    const manualHint = _el('boTargetManualHint');
    if (manualHint) manualHint.style.display = auto ? 'none' : '';
    const autoHint = _el('boTargetAutoHint');
    if (autoHint) autoHint.style.display = auto ? 'block' : 'none';
  }

  // Register map overlay draw hook (called at end of every draw frame by core.js)
  _postDrawHooks.push(_boDrawOverlay);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _el(id) { return document.getElementById(id); }
  function _escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

  // Stable, CSS-safe key from an outpost label  e.g. "Builder's Guild 1" → "Builder_s-Guild-1"
  function _safeKey(lbl) { return lbl.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '_'); }

  // Find a .bo-cat div by its data-cat attribute (avoids querySelector escaping issues)
  function _findCatDiv(lbl) {
    for (const div of document.querySelectorAll('.bo-cat')) {
      if (div.dataset.cat === lbl) return div;
    }
    return null;
  }

  // ── Open / Close ───────────────────────────────────────────────────────────
  // The toolbar button currently has no id="btnBannerOpt" in index.html, so
  // _el(...) returns null and any direct .classList access here would throw —
  // aborting _boRenderAccordion() and leaving the picklist empty. Guard it.
  function openBannerOpt() {
    _bo.active = true;
    _el('mainSidebar').style.display = 'none';
    _el('bannerOptPanel').style.display = 'flex';
    const btn = _el('btnBannerOpt');
    if (btn) btn.classList.add('active-place');
    _boUpdateTerminology();
    _boRenderAccordion();
    _boRenderAllianceDropdown();
    _boSyncAutoPickUI();
    _boUpdateStartDisplay();
    _boSyncTargetUI();
    scheduleDraw();
  }

  // Dropdown change → choose alliance directly. Mutually exclusive with the
  // map-picked startBuilding so the two never disagree on which alliance owns
  // the starting validSet.
  function boOnAllianceChange(select) {
    const lbl = select.value;
    if (!lbl) {
      _bo.startAlliance = null;
    } else {
      _bo.startAlliance = lbl;
      _bo.startBuilding = null;
    }
    _boClearResultsState();
    _boUpdateStartDisplay();
    scheduleDraw();
  }

  function closeBannerOpt() {
    if (_bo.mode === 'pick-start') _boCancelStartPick();
    _bo.active = false;
    _el('mainSidebar').style.display = '';
    _el('bannerOptPanel').style.display = 'none';
    const btn = _el('btnBannerOpt');
    if (btn) btn.classList.remove('active-place');
    scheduleDraw();
  }

  // ── Starting-point pick flow ───────────────────────────────────────────────
  function boActivateStartPick() {
    _bo.mode = 'pick-start';
    const btn = _el('boPickStartBtn');
    btn.classList.add('picking');
    btn.textContent = '↖ 지도에서 깃발 또는 본부를 클릭하세요…';
    canvas.style.cursor = 'crosshair';
    scheduleDraw();
  }

  function _boCancelStartPick() {
    _bo.mode = null;
    const btn = _el('boPickStartBtn');
    if (btn) {
      btn.classList.remove('picking');
      btn.textContent = '↖ 지도에서 선택';
    }
    canvas.style.cursor = getCursor();
    scheduleDraw();
  }

  function boClearStart() {
    _bo.startBuilding = null;
    _bo.startAlliance = null;
    const sel = _el('boAllianceSelect');
    if (sel) sel.value = '';
    _boClearResultsState();
    _boUpdateStartDisplay();
    scheduleDraw();
  }

  // ── Map click handler (called from index.html mousedown) ───────────────────
  function boHandleMapClick(sx, sy) {
    if (!_bo.active) return false;
    if (isOptimizerActive()) return false; // bear-trap optimizer takes priority

    if (_bo.mode === 'pick-start') {
      const hit = getBuildingAt(sx, sy);
      if (hit && (hit.type === 'banner' || hit.type === 'hq') && !hit._canonical) {
        _bo.startBuilding = { id: hit.id, gx: hit.gx, gy: hit.gy, label: hit.label, type: hit.type };
        _bo.startAlliance = null;
        const sel = _el('boAllianceSelect');
        if (sel) sel.value = '';
        _boCancelStartPick();
        _boClearResultsState();
        _boUpdateStartDisplay();
      }
      return true; // consume click in pick mode regardless
    }

    // Toggle a permanent outpost as a target
    const pi = _boPermHitTest(sx, sy);
    if (pi >= 0) {
      const b  = PERMANENT_BUILDINGS[pi];
      const gk = b.label; // group key = the outpost label (unique across the 12 types)
      if (_bo.targets[gk] === pi) {
        delete _bo.targets[gk];
      } else {
        _bo.targets[gk] = pi;
      }
      _boClearResultsState();
      _boSyncAccordionRow(gk);
      _boSyncTargetUI();
      _boAutoExpandType(gk, pi);
      scheduleDraw();
      return true;
    }

    return false;
  }

  // Only hit-test the 12 selectable outpost types (not Fortress/Sanctuary)
  function _boPermHitTest(sx, sy) {
    const { gx, gy } = screenToGrid(sx, sy);
    for (let i = 0; i < PERMANENT_BUILDINGS.length; i++) {
      const b = PERMANENT_BUILDINGS[i];
      if (!OUTPOST_LABELS.includes(b.label)) continue;
      if (gx >= b.gx && gx < b.gx + b.size && gy >= b.gy && gy < b.gy + b.size) return i;
    }
    return -1;
  }

  function _boAutoExpandType(lbl, pi) {
    const catDiv = _findCatDiv(lbl);
    if (!catDiv) return;
    const body = catDiv.querySelector('.bo-cat-body');
    const hdr  = catDiv.querySelector('.bo-cat-hdr');
    if (body && body.style.display === 'none') _boToggleCat(hdr);
    const row = _el('bo-row-' + pi);
    if (row) setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }

  // ── Accordion rendering ────────────────────────────────────────────────────
  function _boRenderAccordion() {
    // Index PERMANENT_BUILDINGS by label (for the 12 selectable types only)
    const byLabel = new Map();
    PERMANENT_BUILDINGS.forEach((b, i) => {
      if (!OUTPOST_LABELS.includes(b.label)) return;
      if (!byLabel.has(b.label)) byLabel.set(b.label, []);
      byLabel.get(b.label).push({ pi: i, b });
    });

    const root = _el('boAccordion');
    root.innerHTML = '';

    for (const lbl of OUTPOST_LABELS) {
      const outposts = byLabel.get(lbl);
      if (!outposts || outposts.length === 0) continue;

      const firstB   = outposts[0].b;
      const sk       = _safeKey(lbl);
      const dispName = OUTPOST_DISPLAY[lbl] || lbl;
      const selPi    = (_bo.targets[lbl] != null) ? _bo.targets[lbl] : -1;

      const typeDiv = document.createElement('div');
      typeDiv.className = 'bo-cat';
      typeDiv.dataset.cat = lbl;

      // Header row
      const hdr = document.createElement('button');
      hdr.className = 'bo-cat-hdr';
      hdr.innerHTML =
        `<span class="bo-cat-dot" style="background:${firstB.color}"></span>` +
        `<span class="bo-cat-name">${dispName}</span>` +
        `<span class="bo-cat-total">${outposts.length}</span>` +
        `<span class="bo-cat-sel" id="bo-csel-${sk}">${selPi >= 0 ? '1개 선택' : ''}</span>` +
        `<span class="bo-chevron">▶</span>`;
      hdr.onclick = () => _boToggleCat(hdr);
      typeDiv.appendChild(hdr);

      // Expandable body — flat list of instances (no level sub-grouping needed)
      const body = document.createElement('div');
      body.className = 'bo-cat-body';
      body.style.display = 'none';

      const rName = 'bor_' + sk;
      const lgDiv = document.createElement('div');
      lgDiv.className = 'bo-level-grp';
      lgDiv.dataset.gkey = lbl;

      lgDiv.innerHTML = outposts.map(({ pi, b }) =>
        `<label class="bo-out-row${selPi === pi ? ' selected' : ''}" id="bo-row-${pi}" data-pi="${pi}">` +
        `<input type="radio" name="${rName}" value="${pi}" data-gkey="${_escAttr(lbl)}"` +
        ` ${selPi === pi ? 'checked' : ''} onchange="boOnRadioChange(this)">` +
        `<span class="bo-out-lbl">${b.gx}, ${b.gy}</span>` +
        `</label>`
      ).join('');

      // Deselect on re-click (radio buttons can't normally be unchecked)
      lgDiv.querySelectorAll('input[type=radio]').forEach(r => {
        r.addEventListener('click', function () {
          const gkv = this.dataset.gkey;
          const piv = parseInt(this.value, 10);
          if (_bo.targets[gkv] === piv) {
            this.checked = false;
            delete _bo.targets[gkv];
            lgDiv.querySelectorAll('.bo-out-row').forEach(row => row.classList.remove('selected'));
            _boUpdateCatSel(gkv);
            _boClearResultsState();
            _boSyncTargetUI();
            scheduleDraw();
          }
        });
      });

      body.appendChild(lgDiv);
      typeDiv.appendChild(body);
      root.appendChild(typeDiv);
    }
  }

  function _boToggleCat(hdr) {
    const body = hdr.nextElementSibling;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    hdr.querySelector('.bo-chevron').textContent = open ? '▶' : '▼';
    hdr.classList.toggle('open', !open);
  }

  // Called by inline onchange on radio inputs
  function boOnRadioChange(radio) {
    const gk = radio.dataset.gkey;
    const pi = parseInt(radio.value, 10);
    _bo.targets[gk] = pi;
    const lgDiv = radio.closest('.bo-level-grp');
    if (lgDiv) {
      lgDiv.querySelectorAll('.bo-out-row').forEach(r => r.classList.remove('selected'));
      radio.closest('.bo-out-row').classList.add('selected');
    }
    _boUpdateCatSel(gk);
    _boClearResultsState();
    _boSyncTargetUI();
    const b = PERMANENT_BUILDINGS[pi];
    _boPanToGrid(b.gx + b.size / 2, b.gy + b.size / 2);
  }

  // Sync accordion display after a map-click toggle
  function _boSyncAccordionRow(lbl) {
    for (const div of document.querySelectorAll('.bo-level-grp')) {
      if (div.dataset.gkey !== lbl) continue;
      div.querySelectorAll('.bo-out-row').forEach(r => r.classList.remove('selected'));
      div.querySelectorAll('input[type=radio]').forEach(r => { r.checked = false; });
      const pi = _bo.targets[lbl];
      if (pi != null) {
        const row = _el('bo-row-' + pi);
        if (row) {
          row.classList.add('selected');
          const radio = row.querySelector('input[type=radio]');
          if (radio) radio.checked = true;
        }
      }
      break;
    }
    _boUpdateCatSel(lbl);
  }

  function _boUpdateCatSel(lbl) {
    const sk = _safeKey(lbl);
    const el = _el('bo-csel-' + sk);
    if (!el) return;
    const selected = _bo.targets[lbl] != null;
    el.textContent   = selected ? '1개 선택' : '';
    el.style.color   = selected ? 'var(--blue)' : '';
  }

  // ── Target count / run button sync ─────────────────────────────────────────
  function _boSyncTargetUI() {
    const auto     = _bo.opts.autoPickTargets;
    const count    = Object.keys(_bo.targets).length;
    const badge    = _el('boTargetCount');
    const clearBtn = _el('boClearTargetsBtn');
    if (badge) {
      badge.textContent   = auto ? '자동' : (count > 0 ? count + '개 선택' : '');
      badge.style.display = (auto || count > 0) ? 'inline-flex' : 'none';
    }
    if (clearBtn) clearBtn.style.display = (!auto && count > 0) ? 'inline-block' : 'none';
    const runBtn = _el('boRunBtn');
    const hasStart   = !!_bo.startBuilding || !!_bo.startAlliance;
    const hasTargets = auto || count > 0;
    if (runBtn) runBtn.disabled = !hasStart || !hasTargets;
  }

  // ── Start display ──────────────────────────────────────────────────────────
  function _boUpdateStartDisplay() {
    const display = _el('boStartDisplay');
    if (!display) return;
    const b = _bo.startBuilding;
    if (b) {
      const typeLabel = b.type === 'hq' ? '연맹 본부' : '깃발';
      const iconColor = b.type === 'hq' ? '#8e44ad' : '#aaaaaa';
      const icon      = b.type === 'hq' ? '⬡' : '◆';
      display.innerHTML =
        `<span class="bo-start-icon" style="color:${iconColor}">${icon}</span>` +
        `<div class="bo-start-info">` +
        `  <span class="bo-start-name">${_escAttr(b.label || typeLabel)}</span>` +
        `  <span class="bo-start-coords">${typeLabel} · ${b.gx}, ${b.gy}</span>` +
        `</div>` +
        `<button class="bo-start-clear" onclick="boClearStart()" title="지우기">✕</button>`;
    } else if (_bo.startAlliance) {
      const swatch = (typeof allianceColors === 'function')
        ? allianceColors(_bo.startAlliance).swatch : '#58a6ff';
      display.innerHTML =
        `<span class="bo-start-icon" style="color:${swatch}">⛬</span>` +
        `<div class="bo-start-info">` +
        `  <span class="bo-start-name">${_escAttr(_bo.startAlliance)}</span>` +
        `  <span class="bo-start-coords">연맹 · 연결된 모든 깃발</span>` +
        `</div>` +
        `<button class="bo-start-clear" onclick="boClearStart()" title="지우기">✕</button>`;
    } else {
      display.innerHTML = `<span class="bo-start-none">선택된 시작 지점이 없습니다</span>`;
    }
    _boSyncTargetUI();
  }

  // ── Clear helpers ──────────────────────────────────────────────────────────
  function boClearAllTargets() {
    _bo.targets = {};
    _boClearResultsState();
    _boRenderAccordion();
    _boSyncTargetUI();
    scheduleDraw();
  }

  function _boClearResultsState() {
    _bo.results = null;
    _bo.solutions = [];
    _bo.solIdx = 0;
    const r = _el('boResults');
    if (r) r.style.display = 'none';
  }

  function boClearResults() { _boClearResultsState(); scheduleDraw(); }

  function _boPanToGrid(gx, gy) {
    const { ix, iy } = gridToIso(gx, gy);
    camX = -ix;
    camY = -iy;
    scheduleDraw();
  }

  // ── Part 2: Banner Route Optimizer Algorithm ───────────────────────────────
  //
  // Territory formula (from core.js buildOwnershipMap):
  //   tx = Math.round(gx + size/2 - terr/2)
  //   Banner (size=1, terr=7): tx = gx-3 → covers [gx-3, gx+3] (7 cells each side)
  //   HQ    (size=3, terr=15): tx = gx-6 → covers [gx-6, gx+8] (15 cells each side)
  //
  // Adjacency rule (from core.js banner placement check):
  //   Banner at (bx,by) is adjacent to territory when any territory cell (tx,ty)
  //   satisfies tx∈[bx-4, bx+4] AND ty∈[by-4, by+4]  (banner's 7×7 terr rect ±1)
  //   → from territory cell (tx,ty) we can place banners in ±4 in each axis (9×9 grid).

  function _boTerrStart(gx, gy, size, terr) {
    return {
      tx: Math.round(gx + size / 2 - terr / 2),
      ty: Math.round(gy + size / 2 - terr / 2),
    };
  }

  // Territory cell indices for a building, excluding guild-fzone cells.
  function _boBuildingTerrCells(b) {
    const def = BUILDING_DEFS[b.type];
    if (!def || !def.territory) return [];
    const t = def.territory;
    const { tx, ty } = _boTerrStart(b.gx, b.gy, def.size, t);
    const GS = GRID_SIZE;
    const cells = [];
    for (let x = tx; x < tx + t; x++) {
      if (x < 0 || x >= GS) continue;
      for (let y = ty; y < ty + t; y++) {
        if (y < 0 || y >= GS) continue;
        const ci = x * GS + y;
        if (!_permForbidCells.has(ci)) cells.push(ci);
      }
    }
    return cells;
  }

  // Uint8Array[GS²]: 1 = this cell is already claimed by SOME building (anyone)
  // or sits in a permanently forbidden zone — i.e. a new banner cannot claim it.
  // Game rule: territory is first-come-first-served, so a banner only owns
  // cells in its rect that are currently unowned. Connectivity (orphan check)
  // is then evaluated using the OWNED cells, not the geometric rect. We track
  // this with claimedMask so the BFS only treats truly-unclaimed cells as
  // a new banner's contribution, and so the orphan-frontier check is accurate.
  function _boBuildClaimedMask() {
    const GS = GRID_SIZE;
    const cm = new Uint8Array(GS * GS);
    for (const ci of currentOwnerMap.keys()) cm[ci] = 1;
    for (const ci of _permForbidCells) cm[ci] = 1;
    return cm;
  }

  // Uint8Array[GS²]: 1 = a size-1 banner may be placed at this cell.
  // Blocked by terrain, all forbidden zones, ruins, maroon zone, king zone,
  // enemy territory, and existing building footprints.
  function _boBuildCanPlace(alliance) {
    const GS = GRID_SIZE;
    const cp = new Uint8Array(GS * GS);
    cp.fill(1);

    for (const ci of _lakeCells) cp[ci] = 0;
    for (const ci of _mtCells)   cp[ci] = 0;

    for (let x = KING_ZONE.x1; x <= KING_ZONE.x2; x++)
      for (let y = KING_ZONE.y1; y <= KING_ZONE.y2; y++)
        if (x >= 0 && y >= 0 && x < GS && y < GS) cp[x * GS + y] = 0;

    { const z = ZONES.ruins;
      for (let x = z.x1; x <= z.x2; x++)
        for (let y = z.y1; y <= z.y2; y++)
          if (x >= 0 && y >= 0 && x < GS && y < GS) cp[x * GS + y] = 0; }

    { const z = ZONES.forbidden;
      for (let x = z.x1; x <= z.x2; x++)
        for (let y = z.y1; y <= z.y2; y++)
          if (x >= 0 && y >= 0 && x < GS && y < GS) cp[x * GS + y] = 0; }

    for (const r of _permForbidRectsAll) {
      for (let x = Math.max(0, r.x1); x < Math.min(GS, r.x2); x++)
        for (let y = Math.max(0, r.y1); y < Math.min(GS, r.y2); y++)
          cp[x * GS + y] = 0;
    }

    if (alliance) {
      for (const [ci, owner] of currentOwnerMap)
        if (owner !== alliance) cp[ci] = 0;
    }

    for (const b of buildings) {
      const def = BUILDING_DEFS[b.type];
      if (!def) continue;
      for (let x = b.gx; x < b.gx + def.size; x++)
        for (let y = b.gy; y < b.gy + def.size; y++)
          if (x >= 0 && y >= 0 && x < GS && y < GS) cp[x * GS + y] = 0;
    }
    return cp;
  }

  // Initial validSet: HQ-connected same-alliance OWNED cells (the cells the game
  // would consider as the alliance's living, connected territory). Excludes:
  //   • cells the alliance does not actually own (lost to first-come-first-serve)
  //   • orphan cells (disconnected banners — game ignores them for adjacency)
  //   • _permForbidCells (never owned by anyone)
  // This makes our BFS roots exactly match what the game treats as validSet
  // when it runs the orphan/adjacency check on a new banner placement.
  function _boInitTerritory(start, alliance, useSameAlliance) {
    const terrSet = new Set();

    // Optional specific start building: only the cells the alliance ACTUALLY
    // owns and that are part of the connected (non-orphan) territory.
    if (start) {
      for (const ci of _boBuildingTerrCells(start)) {
        if (!alliance) { terrSet.add(ci); continue; }
        if (_currentOrphanCells.has(ci)) continue;
        if (currentOwnerMap.get(ci) === alliance) terrSet.add(ci);
      }
    }

    // Alliance-wide seed: when there's no specific start, OR the
    // useSameAlliance toggle is on, every non-orphan cell of the alliance is
    // a valid BFS root. Scanning currentOwnerMap directly avoids any geometry.
    if (alliance && (useSameAlliance || !start)) {
      for (const [ci, owner] of currentOwnerMap) {
        if (owner !== alliance) continue;
        if (_currentOrphanCells.has(ci)) continue;
        terrSet.add(ci);
      }
    }

    return terrSet;
  }

  // Bounding box covering initial territory + all target fzones + margin.
  function _boBounds(terrSet, targetPIs, margin) {
    let x1 = GRID_SIZE, y1 = GRID_SIZE, x2 = 0, y2 = 0;
    for (const ci of terrSet) {
      const cx = (ci / GRID_SIZE) | 0, cy = ci % GRID_SIZE;
      if (cx < x1) x1 = cx; if (cx > x2) x2 = cx;
      if (cy < y1) y1 = cy; if (cy > y2) y2 = cy;
    }
    for (const pi of targetPIs) {
      const fz = _permForbidRectsAll[pi];
      if (fz.x1 < x1) x1 = fz.x1; if (fz.x2 > x2) x2 = fz.x2;
      if (fz.y1 < y1) y1 = fz.y1; if (fz.y2 > y2) y2 = fz.y2;
    }
    return {
      x1: Math.max(0, x1 - margin),
      y1: Math.max(0, y1 - margin),
      x2: Math.min(GRID_SIZE - 1, x2 + margin),
      y2: Math.min(GRID_SIZE - 1, y2 + margin),
    };
  }

  // BFS over OWNED cells within bounds. Each step "places" a banner that can
  // only own cells in its 7×7 rect that are currently unclaimed (first-come-
  // first-served). A placement is rejected (orphan) unless at least one of the
  // banner's owned cells is 8-adjacent to validSet — i.e. the chain stays
  // connected on OWNED cells, which is exactly what the game's orphan check
  // does in placeBuilding (core.js).
  //
  //   dist[ci]       — min banners to bring cell ci into validSet (INF = unreachable)
  //   bannerAt[ci]   — banner cell index that first claimed ci (-1 for initial)
  //   trigCell[ci]   — validSet cell that triggered the banner at bannerAt[ci]
  //   placed[bci]    — 1 if banner position bci was already explored this run
  //   anchorDist[N]  — min dist d such that some 8-neighbor of N has dist=d
  //                    (only updated for unclaimed N). Used for orphan check:
  //                    a banner at depth d+1 must contain an N with anchorDist[N] <= d.
  // All arrays are filled/reset inside this function.
  function _boBFS(terrSet, canPlace, claimedMask, bounds, dist, bannerAt, trigCell, placed, anchorDist) {
    const GS  = GRID_SIZE;
    const INF = 0x7fffffff;
    dist.fill(INF);
    bannerAt.fill(-1);
    trigCell.fill(-1);
    placed.fill(0);
    anchorDist.fill(INF);

    const queue = [];
    for (const ci of terrSet) {
      dist[ci] = 0;
      queue.push(ci);
      // Seed anchorDist for unclaimed 8-neighbors of every initial validSet cell.
      const cx = (ci / GS) | 0, cy = ci % GS;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= GS) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= GS) continue;
          const nci = nx * GS + ny;
          if (!claimedMask[nci] && anchorDist[nci] > 0) anchorDist[nci] = 0;
        }
      }
    }

    const { x1, y1, x2, y2 } = bounds;
    let head = 0;

    while (head < queue.length) {
      const ci = queue[head++];
      const d  = dist[ci];
      const tx = (ci / GS) | 0;
      const ty = ci % GS;

      // Try all banner positions reachable from this validSet cell (±4 in each axis).
      const bx0 = Math.max(x1, tx - 4), bx1m = Math.min(x2, tx + 4);
      const by0 = Math.max(y1, ty - 4), by1m = Math.min(y2, ty + 4);
      for (let bx = bx0; bx <= bx1m; bx++) {
        for (let by = by0; by <= by1m; by++) {
          const bci = bx * GS + by;
          if (!canPlace[bci] || placed[bci]) continue;

          // Banner territory: (bx-3, by-3) to (bx+3, by+3) inclusive (7×7).
          const nx0 = Math.max(x1, bx - 3), nx1m = Math.min(x2, bx + 3);
          const ny0 = Math.max(y1, by - 3), ny1m = Math.min(y2, by + 3);
          const nd = d + 1;

          // Orphan check: this placement is only valid if the banner's rect
          // contains at least one game-unclaimed cell whose 8-neighbour was
          // reached at depth <= d (i.e. lives in validSet at placement time).
          // We deliberately do NOT also require the cell to still be untouched
          // by BFS — that filter rejects long-step banners whose anchor was
          // grabbed by a parallel BFS branch the user will never actually
          // place, producing pointlessly dense chains.
          let validClaim = false;
          for (let nx = nx0; nx <= nx1m && !validClaim; nx++) {
            for (let ny = ny0; ny <= ny1m && !validClaim; ny++) {
              const nci = nx * GS + ny;
              if (claimedMask[nci]) continue;
              if (anchorDist[nci] <= d) validClaim = true;
            }
          }
          if (!validClaim) continue;
          placed[bci] = 1;

          for (let nx = nx0; nx <= nx1m; nx++) {
            for (let ny = ny0; ny <= ny1m; ny++) {
              const nci = nx * GS + ny;
              // Banner only owns cells that are currently unclaimed.
              if (claimedMask[nci] || dist[nci] <= nd) continue;
              dist[nci] = nd;
              bannerAt[nci] = bci;
              trigCell[nci] = ci;
              queue.push(nci);
              // This new validSet cell anchors its unclaimed 8-neighbors at depth nd.
              for (let ddx = -1; ddx <= 1; ddx++) {
                const ax = nx + ddx;
                if (ax < 0 || ax >= GS) continue;
                for (let ddy = -1; ddy <= 1; ddy++) {
                  const ay = ny + ddy;
                  if (ay < 0 || ay >= GS) continue;
                  const aci = ax * GS + ay;
                  if (!claimedMask[aci] && anchorDist[aci] > nd) anchorDist[aci] = nd;
                }
              }
            }
          }
        }
      }
    }
  }

  // Scan the 1-cell ring outside target pi's fzone for the minimum-dist territory cell.
  // Returns { minCI, minDist } or null if no reach cell is within range.
  function _boNearestToTarget(pi, dist) {
    const GS = GRID_SIZE;
    const fz = _permForbidRectsAll[pi];
    let minDist = 0x7fffffff, minCI = -1;
    const check = (cx, cy) => {
      if (cx < 0 || cx >= GS || cy < 0 || cy >= GS) return;
      const ci = cx * GS + cy;
      if (dist[ci] < minDist) { minDist = dist[ci]; minCI = ci; }
    };
    // Left and right columns (includes diagonal corners)
    for (let y = fz.y1 - 1; y <= fz.y2; y++) {
      check(fz.x1 - 1, y);
      check(fz.x2,     y);
    }
    // Top and bottom rows (corners already covered above)
    for (let x = fz.x1; x < fz.x2; x++) {
      check(x, fz.y1 - 1);
      check(x, fz.y2);
    }
    return minCI < 0 ? null : { minCI, minDist };
  }

  // Backtrack from reachCI through trigCell/bannerAt chains to recover banner positions.
  // Returns [{gx,gy}] in placement order (first banner to last).
  function _boReconPath(dist, bannerAt, trigCell, reachCI) {
    const GS = GRID_SIZE;
    const banners = [];
    let cur = reachCI;
    while (cur >= 0 && dist[cur] > 0) {
      const bci = bannerAt[cur];
      if (bci < 0) break;
      banners.push({ gx: (bci / GS) | 0, gy: bci % GS });
      cur = trigCell[cur];
    }
    banners.reverse();
    return banners;
  }

  // Count canonical resource nodes with at least one footprint cell in terrSet.
  function _boCountResources(terrSet) {
    let count = 0;
    for (const b of buildings) {
      if (!b._canonical || !RESOURCE_SUBTYPES.includes(b.type)) continue;
      const def  = BUILDING_DEFS[b.type];
      const size = def ? def.size : 2;
      outer: for (let x = b.gx; x < b.gx + size; x++)
        for (let y = b.gy; y < b.gy + size; y++)
          if (terrSet.has(x * GRID_SIZE + y)) { count++; break outer; }
    }
    return count;
  }

  // Simulate placing a single banner at (gx, gy) against the current state.
  // Returns { connected, ownedCells } where:
  //   ownedCells — cell indices in the banner's 7×7 rect that are currently
  //                unclaimed (claimedMask=0) and would therefore be claimed
  //                by this banner under first-come-first-serve.
  //   connected  — true iff at least one ownedCell is 8-adjacent to validSet
  //                (matches game's connectivity / orphan rule in
  //                core.js's buildOwnershipMap).
  function _boSimulateBanner(gx, gy, claimedMask, validSet) {
    const GS = GRID_SIZE;
    const { tx, ty } = _boTerrStart(gx, gy, 1, 7);
    const owned = [];
    for (let x = tx; x < tx + 7; x++) {
      if (x < 0 || x >= GS) continue;
      for (let y = ty; y < ty + 7; y++) {
        if (y < 0 || y >= GS) continue;
        const ci = x * GS + y;
        if (!claimedMask[ci]) owned.push(ci);
      }
    }
    if (owned.length === 0) return { connected: false, ownedCells: owned };
    for (const ci of owned) {
      const cx = (ci / GS) | 0, cy = ci % GS;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= GS) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= GS) continue;
          if (validSet.has(nx * GS + ny)) return { connected: true, ownedCells: owned };
        }
      }
    }
    return { connected: false, ownedCells: owned };
  }

  // Commit a successfully-simulated banner: mark its owned cells as claimed,
  // add them to validSet, and block its footprint from further placement.
  function _boCommitBanner(gx, gy, ownedCells, claimedMask, validSet, canPlace) {
    const GS = GRID_SIZE;
    for (const ci of ownedCells) {
      claimedMask[ci] = 1;
      validSet.add(ci);
    }
    canPlace[gx * GS + gy] = 0;
  }

  // Hunt for a same-rect-shifted position near (gx, gy) that places successfully.
  // Searches ring-by-ring out to ±maxR so the first hit is the smallest move.
  function _boFindShift(gx, gy, claimedMask, validSet, canPlace, maxR) {
    const GS = GRID_SIZE;
    for (let r = 1; r <= maxR; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const ngx = gx + dx, ngy = gy + dy;
          if (ngx < 0 || ngx >= GS || ngy < 0 || ngy >= GS) continue;
          if (!canPlace[ngx * GS + ngy]) continue;
          const sim = _boSimulateBanner(ngx, ngy, claimedMask, validSet);
          if (sim.connected) return { gx: ngx, gy: ngy, sim };
        }
      }
    }
    return null;
  }

  // Find a single bridge banner B' that (a) connects to the current validSet
  // and (b) once placed, makes the originally-requested banner at
  // (targetGx,targetGy) connectable. Searches positions around the target.
  function _boFindBridge(targetGx, targetGy, claimedMask, validSet, canPlace, maxR) {
    const GS = GRID_SIZE;
    const { tx: ttx, ty: tty } = _boTerrStart(targetGx, targetGy, 1, 7);
    for (let r = 1; r <= maxR; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const bgx = targetGx + dx, bgy = targetGy + dy;
          if (bgx < 0 || bgx >= GS || bgy < 0 || bgy >= GS) continue;
          if (!canPlace[bgx * GS + bgy]) continue;
          const bSim = _boSimulateBanner(bgx, bgy, claimedMask, validSet);
          if (!bSim.connected) continue;
          // Test target connectivity assuming bridge is in place — without mutating.
          const bridgeOwned = new Set(bSim.ownedCells);
          let targetConnects = false;
          for (let x = ttx; x < ttx + 7 && !targetConnects; x++) {
            if (x < 0 || x >= GS) continue;
            for (let y = tty; y < tty + 7 && !targetConnects; y++) {
              if (y < 0 || y >= GS) continue;
              const tci = x * GS + y;
              if (claimedMask[tci] || bridgeOwned.has(tci)) continue;
              for (let ddx = -1; ddx <= 1 && !targetConnects; ddx++) {
                const nx = x + ddx;
                if (nx < 0 || nx >= GS) continue;
                for (let ddy = -1; ddy <= 1 && !targetConnects; ddy++) {
                  const ny = y + ddy;
                  if (ny < 0 || ny >= GS) continue;
                  const aci = nx * GS + ny;
                  if (validSet.has(aci) || bridgeOwned.has(aci)) targetConnects = true;
                }
              }
            }
          }
          if (targetConnects) return { gx: bgx, gy: bgy, sim: bSim };
        }
      }
    }
    return null;
  }

  // Walk the BFS-recovered path banner-by-banner with true first-come-first-
  // serve simulation. Each banner that would land orphan triggers (1) a small
  // shift search; on failure (2) a bridge-banner search. Banners that can't be
  // rescued either way are dropped from the chain (the next banner may still
  // succeed, since validSet keeps growing as we commit each fix).
  function _boValidateAndFix(path, claimedMask, validSet, canPlace) {
    const out = [];
    const SHIFT_R = 3;
    const BRIDGE_R = 7;
    for (const banner of path) {
      let { gx, gy } = banner;
      let sim = _boSimulateBanner(gx, gy, claimedMask, validSet);
      if (!sim.connected) {
        const shifted = _boFindShift(gx, gy, claimedMask, validSet, canPlace, SHIFT_R);
        if (shifted) {
          gx = shifted.gx; gy = shifted.gy; sim = shifted.sim;
        } else {
          const bridge = _boFindBridge(gx, gy, claimedMask, validSet, canPlace, BRIDGE_R);
          if (bridge) {
            out.push({ gx: bridge.gx, gy: bridge.gy });
            _boCommitBanner(bridge.gx, bridge.gy, bridge.sim.ownedCells, claimedMask, validSet, canPlace);
            sim = _boSimulateBanner(gx, gy, claimedMask, validSet);
          }
        }
      }
      if (sim.connected) {
        out.push({ gx, gy });
        _boCommitBanner(gx, gy, sim.ownedCells, claimedMask, validSet, canPlace);
      }
    }
    return out;
  }

  // Auto-pick mode: run a single BFS from the current alliance's territory and
  // for each of the 12 selectable outpost types pick the instance with the
  // smallest reach distance. Returns { label: pi } ready to drop into _bo.targets.
  // If no outposts of a given type are reachable, that type is omitted.
  function _boAutoPickTargets() {
    const alliance = _boEffectiveAlliance();
    if (!alliance) return {};

    const canPlace    = _boBuildCanPlace(alliance);
    const claimedMask = _boBuildClaimedMask();
    const terrSet     = _boInitTerritory(_bo.startBuilding, alliance, _bo.opts.sameAlliance);
    if (terrSet.size === 0) return {};

    // Bounds wrap start + every selectable outpost so the BFS can reach any of them.
    const allOutpostPIs = [];
    for (let i = 0; i < PERMANENT_BUILDINGS.length; i++) {
      if (OUTPOST_LABELS.includes(PERMANENT_BUILDINGS[i].label)) allOutpostPIs.push(i);
    }
    const bounds = _boBounds(terrSet, allOutpostPIs, 60);

    const GS = GRID_SIZE;
    const dist       = new Int32Array(GS * GS);
    const bannerAt   = new Int32Array(GS * GS);
    const trigCell   = new Int32Array(GS * GS);
    const placed     = new Uint8Array(GS * GS);
    const anchorDist = new Int32Array(GS * GS);
    _boBFS(terrSet, canPlace, claimedMask, bounds, dist, bannerAt, trigCell, placed, anchorDist);

    const picks = {};
    for (const label of OUTPOST_LABELS) {
      let bestPI = -1, bestDist = Infinity;
      for (let i = 0; i < PERMANENT_BUILDINGS.length; i++) {
        if (PERMANENT_BUILDINGS[i].label !== label) continue;
        const reach = _boNearestToTarget(i, dist);
        if (reach && reach.minDist < bestDist) {
          bestDist = reach.minDist;
          bestPI = i;
        }
      }
      if (bestPI >= 0) picks[label] = bestPI;
    }
    return picks;
  }

  function boToggleAutoPickTargets(input) {
    _bo.opts.autoPickTargets = input.checked;
    _boClearResultsState();
    _boSyncAutoPickUI();
    _boRenderAccordion();
    _boSyncTargetUI();
    scheduleDraw();
  }

  // Greedy multi-target Steiner tree.
  // fixedOrder: optional array of targetPIs in a forced connection sequence.
  //   null → nearest-first greedy (original behaviour).
  //   array → connect targets in that sequence (each iteration still runs a fresh BFS).
  function _boRunAlgorithm(fixedOrder) {
    const GS        = GRID_SIZE;
    const start     = _bo.startBuilding; // may be null in alliance-only mode
    const alliance  = _boEffectiveAlliance();
    const targetPIs = Object.values(_bo.targets).map(Number);

    const canPlace    = _boBuildCanPlace(alliance);
    const claimedMask = _boBuildClaimedMask();
    let   terrSet     = _boInitTerritory(start, alliance, _bo.opts.sameAlliance);
    const initialTerrSet = new Set(terrSet);
    const bounds      = _boBounds(terrSet, targetPIs, 60);

    const dist       = new Int32Array(GS * GS);
    const bannerAt   = new Int32Array(GS * GS);
    const trigCell   = new Int32Array(GS * GS);
    const placed     = new Uint8Array(GS * GS);
    const anchorDist = new Int32Array(GS * GS);

    const allBanners  = [];
    const unreachable = [];

    if (fixedOrder) {
      // Fixed sequence: connect each target in the given order.
      // Unreachable targets at that moment are skipped (marked unreachable).
      for (const pi of fixedOrder) {
        _boBFS(terrSet, canPlace, claimedMask, bounds, dist, bannerAt, trigCell, placed, anchorDist);
        const reach = _boNearestToTarget(pi, dist);
        if (!reach) {
          const b = PERMANENT_BUILDINGS[pi];
          unreachable.push(`${OUTPOST_DISPLAY[b.label] || b.label} (${b.gx},${b.gy})`);
          continue;
        }
        if (reach.minDist === 0) continue;
        const path = _boReconPath(dist, bannerAt, trigCell, reach.minCI);
        const fixed = _boValidateAndFix(path, claimedMask, terrSet, canPlace);
        allBanners.push(...fixed);
      }
    } else {
      // Nearest-first greedy (original): pick the closest reachable target each step.
      const remaining = [...targetPIs];
      while (remaining.length > 0) {
        _boBFS(terrSet, canPlace, claimedMask, bounds, dist, bannerAt, trigCell, placed, anchorDist);
        let nearestDist = Infinity, nearestIdx = -1, nearestCI = -1;
        for (let i = 0; i < remaining.length; i++) {
          const reach = _boNearestToTarget(remaining[i], dist);
          if (reach && reach.minDist < nearestDist) {
            nearestDist = reach.minDist;
            nearestIdx  = i;
            nearestCI   = reach.minCI;
          }
        }
        if (nearestIdx < 0) {
          for (const pi of remaining.splice(0)) {
            const b = PERMANENT_BUILDINGS[pi];
            unreachable.push(`${OUTPOST_DISPLAY[b.label] || b.label} (${b.gx},${b.gy})`);
          }
          break;
        }
        const pi = remaining.splice(nearestIdx, 1)[0];
        if (nearestDist === 0) continue;
        const path = _boReconPath(dist, bannerAt, trigCell, nearestCI);
        const fixed = _boValidateAndFix(path, claimedMask, terrSet, canPlace);
        allBanners.push(...fixed);
      }
    }

    const newTerrCells = [];
    for (const ci of terrSet) {
      if (!initialTerrSet.has(ci)) newTerrCells.push(ci);
    }

    return {
      banners:       allBanners,
      bannerCount:   allBanners.length,
      resourceCount: _bo.opts.captureResources ? _boCountResources(terrSet) : 0,
      unreachable,
      newTerrCells,
    };
  }

  // Generate all permutations of arr (only call for small N).
  function _boPermute(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.filter((_, j) => j !== i);
      for (const p of _boPermute(rest)) result.push([arr[i], ...p]);
    }
    return result;
  }

  // Canonical key for deduplicating solutions by their banner positions.
  function _boSolutionKey(sol) {
    return sol.banners.map(b => `${b.gx},${b.gy}`).sort().join('|');
  }

  // Run the algorithm under several target orderings and collect unique solutions.
  // Returns array sorted by bannerCount ascending (fewest first).
  function _boRunAllVariants() {
    const targetPIs = Object.values(_bo.targets).map(Number);
    const N = targetPIs.length;

    const orderings = [null]; // null = nearest-first greedy, always first
    if (N <= 4) {
      orderings.push(..._boPermute(targetPIs));
    } else {
      orderings.push([...targetPIs].reverse());
      for (let i = 0; i < 4; i++)
        orderings.push([...targetPIs].sort(() => Math.random() - 0.5));
    }

    const seen = new Set();
    const solutions = [];
    for (const order of orderings) {
      const result = _boRunAlgorithm(order);
      const key = _boSolutionKey(result);
      if (!seen.has(key)) { seen.add(key); solutions.push(result); }
      if (solutions.length >= 5) break;
    }
    solutions.sort((a, b) => a.bannerCount - b.bannerCount);
    return solutions;
  }

  function _boDisplayResults() {
    const result = _bo.solutions[_bo.solIdx];
    if (!result) return;
    const res = _el('boResults');
    if (res) res.style.display = 'flex';
    if (_el('boResBanners')) _el('boResBanners').textContent = result.bannerCount;
    if (_el('boResNodes'))   _el('boResNodes').textContent   = result.resourceCount;
    let msg = result.bannerCount === 0
      ? '모든 목표에 이미 도달 가능합니다 — 새 깃발이 필요 없습니다!'
      : `새로 배치할 깃발 ${result.bannerCount}개`;
    if (result.unreachable.length > 0)
      msg += '  ⚠ 도달 불가: ' + result.unreachable.join('; ');
    if (_el('boResMsg')) _el('boResMsg').textContent = msg;

    const total = _bo.solutions.length;
    const nav = _el('boResNav');
    if (nav) nav.style.display = total > 1 ? 'flex' : 'none';
    const info = _el('boSolInfo');
    if (info) info.textContent = `${_bo.solIdx + 1}/${total}`;
    const prevBtn = _el('boPrevSolBtn');
    if (prevBtn) prevBtn.disabled = _bo.solIdx === 0;
    const nextBtn = _el('boNextSolBtn');
    if (nextBtn) nextBtn.disabled = _bo.solIdx === total - 1;

    const applyBtn = _el('boApplyBtn');
    if (applyBtn) applyBtn.style.display = result.bannerCount > 0 ? 'block' : 'none';
  }

  // ── Run button ─────────────────────────────────────────────────────────────
  function boRunOptimizer() {
    const hasStart = !!_bo.startBuilding || !!_bo.startAlliance;
    const auto     = _bo.opts.autoPickTargets;
    if (!hasStart) return;
    if (!auto && Object.keys(_bo.targets).length === 0) return;
    _boClearResultsState();

    const res = _el('boResults');
    if (res) res.style.display = 'flex';
    if (_el('boResBanners')) _el('boResBanners').textContent = '…';
    if (_el('boResNodes'))   _el('boResNodes').textContent   = '…';
    if (_el('boResMsg'))     _el('boResMsg').textContent     = '최적 경로 계산 중…';
    const nav = _el('boResNav');
    if (nav) nav.style.display = 'none';
    const applyBtn = _el('boApplyBtn');
    if (applyBtn) applyBtn.style.display = 'none';
    const runBtn = _el('boRunBtn');
    if (runBtn) runBtn.disabled = true;

    setTimeout(() => {
      try {
        // Auto-pick mode: replace _bo.targets with the closest reachable
        // outpost of each type. Persisted so the user can see the picks in
        // the accordion if they later flip the toggle off.
        if (auto) {
          _bo.targets = _boAutoPickTargets();
          if (Object.keys(_bo.targets).length === 0) {
            if (_el('boResMsg')) _el('boResMsg').textContent =
              `선택한 시작 영토에서 도달 가능한 ${_boFacilityTerm().plur}가 없습니다.`;
            return;
          }
        }
        const solutions = _boRunAllVariants();
        _bo.solutions = solutions;
        _bo.solIdx    = 0;
        _bo.results   = solutions[0] || null;
        if (_bo.results) _boDisplayResults();
      } catch (e) {
        if (_el('boResMsg')) _el('boResMsg').textContent = '오류: ' + e.message;
        console.error('[BannerOpt]', e);
      } finally {
        if (runBtn) runBtn.disabled = false;
        scheduleDraw();
      }
    }, 16);
  }

  // ── Solution navigation ────────────────────────────────────────────────────
  function boNextSolution() {
    if (_bo.solIdx < _bo.solutions.length - 1) {
      _bo.solIdx++;
      _bo.results = _bo.solutions[_bo.solIdx];
      _boDisplayResults();
      scheduleDraw();
    }
  }

  function boPrevSolution() {
    if (_bo.solIdx > 0) {
      _bo.solIdx--;
      _bo.results = _bo.solutions[_bo.solIdx];
      _boDisplayResults();
      scheduleDraw();
    }
  }

  // ── Apply banners (one undo step) ─────────────────────────────────────────
  // After applying we wipe all per-session state (start, targets, results) and
  // close the optimizer panel. Leaving stale targets selected causes the next
  // run on a different alliance to see the old PIs as "already connected"
  // because we'd start from a different validSet but with the same goals.
  function boApplyBanners() {
    const sol = _bo.results;
    if (!sol || sol.banners.length === 0) return;

    pushHistory();

    const alliance = _boEffectiveAlliance();
    // Color: prefer the picked start building's color; otherwise inherit from
    // any existing non-canonical banner/HQ of the chosen alliance.
    let color = '#888888';
    if (_bo.startBuilding) {
      const startB = buildings.find(b => b.id === _bo.startBuilding.id);
      if (startB) color = startB.color;
    } else if (alliance) {
      const ref = buildings.find(b =>
        !b._canonical &&
        (b.type === 'banner' || b.type === 'hq') &&
        (b.label || '').trim() === alliance);
      if (ref) color = ref.color;
    }

    for (const { gx, gy } of sol.banners) {
      buildings.push({
        id:    _genId(),
        type:  'banner',
        gx, gy,
        label: alliance,
        color,
        seq:   ++placementSeq,
      });
    }

    invalidateTset();
    invalidateBuildings();
    saveToStorage();

    _bo.startBuilding = null;
    _bo.startAlliance = null;
    _bo.targets       = {};
    _boClearResultsState();
    closeBannerOpt();
  }

  // ── Map overlay drawing (registered in _postDrawHooks) ─────────────────────
  function _boDrawOverlay() {
    if (!_bo.active || !ctx || !canvas) return;
    window.__perf && window.__perf.mark('boOverlay');
    try {
    ctx.save();

    // Gold highlight: starting point
    if (_bo.startBuilding) {
      const b  = _bo.startBuilding;
      const sz = (BUILDING_DEFS[b.type] || { size: 1 }).size;
      const c  = buildingCorners(b.gx, b.gy, sz);
      ctx.shadowColor = '#c9a84c';
      ctx.shadowBlur  = 12;
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      c.forEach((p, i) => i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy));
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = 'rgba(201,168,76,0.16)';
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    // Blue highlight: selected target outposts
    for (const pi of Object.values(_bo.targets)) {
      if (pi == null) continue;
      const b = PERMANENT_BUILDINGS[pi];
      const c = buildingCorners(b.gx, b.gy, b.size);
      ctx.setLineDash([6, 3]);
      ctx.strokeStyle = '#58a6ff';
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      c.forEach((p, i) => i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy));
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(88,166,255,0.12)';
      ctx.fill();
    }

    // Pick-start mode: dashed gold ring on all selectable banners/HQs
    if (_bo.mode === 'pick-start') {
      for (const b of buildings) {
        if ((b.type !== 'banner' && b.type !== 'hq') || b._canonical) continue;
        const sz = BUILDING_DEFS[b.type].size;
        const c  = buildingCorners(b.gx, b.gy, sz);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(201,168,76,0.7)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        c.forEach((p, i) => i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy));
        ctx.closePath();
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);

    // Territory + banner preview from last optimizer run
    if (_bo.results && _bo.results.newTerrCells && _bo.results.newTerrCells.length > 0) {
      const GS = GRID_SIZE;
      // Semi-transparent pink fill for all territory cells gained by the proposed banners
      ctx.beginPath();
      for (const ci of _bo.results.newTerrCells) {
        const gx = (ci / GS) | 0, gy = ci % GS;
        const c = buildingCorners(gx, gy, 1);
        ctx.moveTo(c[0].sx, c[0].sy);
        ctx.lineTo(c[1].sx, c[1].sy);
        ctx.lineTo(c[2].sx, c[2].sy);
        ctx.lineTo(c[3].sx, c[3].sy);
        ctx.closePath();
      }
      ctx.fillStyle = 'rgba(230,81,0,0.28)';
      ctx.fill();
    }

    // Solid hot-pink diamonds with white outline: each proposed banner position
    if (_bo.results && _bo.results.banners.length > 0) {
      for (const { gx, gy } of _bo.results.banners) {
        const c = buildingCorners(gx, gy, 1);
        ctx.beginPath();
        ctx.moveTo(c[0].sx, c[0].sy);
        ctx.lineTo(c[1].sx, c[1].sy);
        ctx.lineTo(c[2].sx, c[2].sy);
        ctx.lineTo(c[3].sx, c[3].sy);
        ctx.closePath();
        ctx.shadowColor = '#000';
        ctx.shadowBlur  = 5;
        ctx.fillStyle   = '#e65100';
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 2.5;
        ctx.stroke();
      }
    }

    ctx.restore();
    } finally {
      window.__perf && window.__perf.measure('boOverlay');
    }
  }

  // ── Expose API to global scope ─────────────────────────────────────────────
  window.openBannerOpt       = openBannerOpt;
  window.closeBannerOpt      = closeBannerOpt;
  window.boActivateStartPick = boActivateStartPick;
  window.boClearStart        = boClearStart;
  window.boOnAllianceChange  = boOnAllianceChange;
  window.boToggleAutoPickTargets = boToggleAutoPickTargets;
  window.boOnRadioChange     = boOnRadioChange;
  window.boRunOptimizer      = boRunOptimizer;
  window.boNextSolution      = boNextSolution;
  window.boPrevSolution      = boPrevSolution;
  window.boApplyBanners      = boApplyBanners;
  window.boClearResults      = boClearResults;
  window.boClearAllTargets   = boClearAllTargets;
  window.boHandleMapClick    = boHandleMapClick;
})();
