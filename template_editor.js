// ═══════════════════════════════════════════════════════════════════
// KINGSHOT MAPPER — TEMPLATE EDITOR (Phase 3)
// ═══════════════════════════════════════════════════════════════════
// Self-contained modal editor for designing bear-trap templates.
//
// Usage:
//   TemplateEditor.open({
//     onSave:   (payload) => { ... },   // called with validated payload on save
//     onCancel: () => { ... },          // called when user cancels (optional)
//     initialTemplate: null,            // optional — preload buildings (edit path)
//   });
//
// Payload format (matches /admin/templates/save schema, minus id/submitter):
//   {
//     name: string, description: string,
//     bbox: { w, h }, anchor: { gx, gy },
//     buildings: [{ type, gx, gy }],   // coords RELATIVE to bbox top-left
//   }
// ═══════════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  // ── Constants — must mirror BUILDING_DEFS in core.js ────────────────
  const CANVAS_SIZE   = 99;     // editor grid is 99×99
  const CANVAS_CENTER = 49;     // center cell — anchor reference
  const BUILDING_SIZE = { city: 2, beartrap: 3, banner: 1, hq: 3 };
  const TERRITORY_SIZE = { banner: 7, hq: 15 };
  const MAX_TRAPS  = 2;
  const MIN_TRAPS  = 1;
  const MAX_HQ     = 1;
  const MAX_CITIES = 100;

  // Visual palette — matches main map's BUILDING_DEFS where applicable.
  const COLORS = {
    bg:              '#0d1117',
    canvasBg:        '#0a0d12',
    gridMinor:       '#262d38',     // every 1 cell — faint
    gridMajor:       '#4a5360',     // every 10 cells — prominent
    gridOutline:     '#6e7681',     // 99×99 boundary
    centerCellFill:  '#c9a84c66',   // anchor cell (49,49) — gold w/ ~40% alpha
    centerCellStroke:'#ffd870',     // brighter gold outline so it pops
    gridDiamond:     '#21262d',
    territoryFill:   '#2d5a73',     // unified opaque alliance shade
    orphanFill:      '#7a3a3a',     // distinct color for orphan territory
    city:            '#4a9edd',
    cityStroke:      '#1f4d6e',
    banner:          '#f1c40f',
    bannerStroke:    '#7d6608',
    hq:              '#8e44ad',
    hqStroke:        '#5b2e75',
    beartrap:        '#c0392b',
    beartrapStroke:  '#7c1d12',
    invalidBuilding: '#ff5555',     // outline for cities outside territory
    hoverGhost:      '#ffffff66',   // ghost outline at cursor
    hoverInvalid:    '#ff555588',   // ghost outline at invalid cursor
  };

  // Tools
  const TOOLS = ['city', 'banner', 'hq', 'beartrap', 'erase', 'pan'];
  const TOOL_LABEL = {
    city: '도시', banner: '깃발', hq: '본부', beartrap: '곰 함정',
    erase: '지우기', pan: '이동',
  };
  const TOOL_KEY = { '1': 'city', '2': 'banner', '3': 'hq', '4': 'beartrap', 'e': 'erase', 'E': 'erase', 'p': 'pan', 'P': 'pan' };

  // ── Module state (per-open instance) ────────────────────────────────
  let _isOpen = false;
  let _state  = null;   // see open() for shape

  // ────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ────────────────────────────────────────────────────────────────────

  function open(opts) {
    if (_isOpen) return;
    opts = opts || {};
    _isOpen = true;
    _state = {
      onSave:   typeof opts.onSave === 'function'   ? opts.onSave   : () => {},
      onCancel: typeof opts.onCancel === 'function' ? opts.onCancel : () => {},
      buildings: [],          // {id, type, gx, gy}
      nextId: 1,
      tool: 'city',
      // Camera: cell-pixel scale + (panX, panY) screen-space offset.
      // Initial values set by _autoFitCamera once canvas is sized.
      camScale: 1,
      camX: 0, camY: 0,
      // Pointer state
      hoverGX: -1, hoverGY: -1,   // cell under cursor (-1 if none)
      isDragging: false,
      lastDragX: 0, lastDragY: 0,
      // Validation snapshot (recomputed after every mutation)
      validation: null,
    };

    _buildDOM();
    if (opts.initialTemplate && Array.isArray(opts.initialTemplate.buildings)) {
      _loadBuildings(opts.initialTemplate.buildings);
    }
    // Optional name/description carried into the save prompts (handy for edit-existing flows)
    _state.initialName        = (opts.initialTemplate && opts.initialTemplate.name)        || '';
    _state.initialDescription = (opts.initialTemplate && opts.initialTemplate.description) || '';
    _autoFitCamera();
    _recomputeValidation();
    _redraw();
    _renderStats();
  }

  function close() {
    if (!_isOpen) return;
    _isOpen = false;
    if (_state.dom && _state.dom.root && _state.dom.root.parentNode) {
      _state.dom.root.parentNode.removeChild(_state.dom.root);
    }
    document.removeEventListener('keydown', _onKeyDown, true);
    _state = null;
  }

  // ────────────────────────────────────────────────────────────────────
  // DOM CONSTRUCTION
  // ────────────────────────────────────────────────────────────────────

  function _buildDOM() {
    const root = document.createElement('div');
    root.id = 'tplEditorModal';
    root.innerHTML = _STYLE + _HTML;
    document.body.appendChild(root);

    const dom = {
      root,
      canvas:    root.querySelector('#tplEdCanvas'),
      tools:     root.querySelectorAll('.tpl-ed-tool'),
      stats:     root.querySelector('#tplEdStats'),
      saveBtn:   root.querySelector('#tplEdSave'),
      cancelBtn: root.querySelector('#tplEdCancel'),
      hud:       root.querySelector('#tplEdHud'),
    };
    _state.dom = dom;
    _state.ctx = dom.canvas.getContext('2d');

    // Tool clicks
    dom.tools.forEach(btn => {
      btn.addEventListener('click', () => _setTool(btn.dataset.tool));
    });

    // Save / cancel
    dom.saveBtn.addEventListener('click', _handleSave);
    dom.cancelBtn.addEventListener('click', _handleCancel);

    // Canvas events
    const c = dom.canvas;
    c.addEventListener('mousedown', _onMouseDown);
    c.addEventListener('mousemove', _onMouseMove);
    c.addEventListener('mouseup',   _onMouseUp);
    c.addEventListener('mouseleave', _onMouseLeave);
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('wheel', _onWheel, { passive: false });

    // Keyboard
    document.addEventListener('keydown', _onKeyDown, true);

    // Resize handling — match canvas to its container
    _resizeCanvasToContainer();
    window.addEventListener('resize', _resizeCanvasToContainer);

    // Set initial tool styling
    _setTool('city');
  }

  function _resizeCanvasToContainer() {
    if (!_isOpen) return;
    const c = _state.dom.canvas;
    const rect = c.parentNode.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width  = Math.floor(rect.width  * dpr);
    c.height = Math.floor(rect.height * dpr);
    c.style.width  = rect.width  + 'px';
    c.style.height = rect.height + 'px';
    _state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _autoFitCamera();
    _redraw();
  }

  // ────────────────────────────────────────────────────────────────────
  // PROJECTION (iso) + CAMERA
  // ────────────────────────────────────────────────────────────────────

  // Cell (gx, gy) → iso world (ix, iy). Same as main map: ix = gx-gy, iy = -(gx+gy).
  // Camera maps iso world → screen via: sx = ix*camScale + camX; sy = iy*camScale + camY.
  function _gridToScreen(gx, gy) {
    const ix = gx - gy;
    const iy = -(gx + gy);
    return {
      sx: ix * _state.camScale + _state.camX,
      sy: iy * _state.camScale + _state.camY,
    };
  }

  function _screenToGrid(sx, sy) {
    const ix = (sx - _state.camX) / _state.camScale;
    const iy = (sy - _state.camY) / _state.camScale;
    // Inverse of (ix=gx-gy, iy=-(gx+gy)): gx = (ix - iy)/2, gy = (-ix - iy)/2
    const gx = (ix - iy) / 2;
    const gy = (-ix - iy) / 2;
    return { gx, gy };
  }

  function _autoFitCamera() {
    if (!_state.dom) return;
    const c = _state.dom.canvas;
    const cssW = c.clientWidth, cssH = c.clientHeight;
    if (cssW < 10 || cssH < 10) return;
    // The 99×99 grid in iso has corners (0,0)→(0,0), (99,0)→(99,-99),
    // (99,99)→(0,-198), (0,99)→(-99,-99). Iso bbox: x∈[-99,99], y∈[-198,0].
    const isoW = 2 * CANVAS_SIZE;       // 198
    const isoH = 2 * CANVAS_SIZE;       // 198
    const padding = 0.06;
    const scale = Math.min(cssW / isoW, cssH / isoH) * (1 - padding * 2);
    _state.camScale = scale;
    // Center the diamond. Iso center: (0, -99). Map to (cssW/2, cssH/2).
    _state.camX = cssW / 2;
    _state.camY = cssH / 2 + 99 * scale;
  }

  // ────────────────────────────────────────────────────────────────────
  // BUILDING OPS
  // ────────────────────────────────────────────────────────────────────

  function _loadBuildings(arr) {
    _state.buildings = arr.map(b => ({
      id: _state.nextId++,
      type: b.type,
      gx: b.gx | 0,
      gy: b.gy | 0,
    }));
  }

  // Returns true if the [gx, gy, sz] footprint fits inside the 99×99 canvas
  // and overlaps no existing building.
  function _canPlace(type, gx, gy, ignoreId) {
    const sz = BUILDING_SIZE[type];
    if (gx < 0 || gy < 0 || gx + sz > CANVAS_SIZE || gy + sz > CANVAS_SIZE) return false;
    for (const b of _state.buildings) {
      if (ignoreId != null && b.id === ignoreId) continue;
      const bsz = BUILDING_SIZE[b.type];
      if (gx < b.gx + bsz && gx + sz > b.gx && gy < b.gy + bsz && gy + sz > b.gy) {
        return false;  // AABB overlap
      }
    }
    return true;
  }

  function _placeBuilding(type, gx, gy) {
    if (!_canPlace(type, gx, gy)) return false;
    _state.buildings.push({ id: _state.nextId++, type, gx, gy });
    _recomputeValidation();
    _redraw();
    _renderStats();
    return true;
  }

  // Find building whose footprint contains (gx, gy) as a cell. Returns building or null.
  function _buildingAtCell(gx, gy) {
    for (let i = _state.buildings.length - 1; i >= 0; i--) {
      const b = _state.buildings[i];
      const sz = BUILDING_SIZE[b.type];
      if (gx >= b.gx && gx < b.gx + sz && gy >= b.gy && gy < b.gy + sz) return b;
    }
    return null;
  }

  function _eraseAtCell(gx, gy) {
    const b = _buildingAtCell(gx, gy);
    if (!b) return false;
    _state.buildings = _state.buildings.filter(x => x.id !== b.id);
    _recomputeValidation();
    _redraw();
    _renderStats();
    return true;
  }

  // ────────────────────────────────────────────────────────────────────
  // VALIDATION + OWNERSHIP
  // ────────────────────────────────────────────────────────────────────

  // Compute territory cells for one banner/HQ — matches core.js territoryBox.
  function _territoryCells(b) {
    const t = TERRITORY_SIZE[b.type];
    if (!t) return null;
    const sz = BUILDING_SIZE[b.type];
    const tx = Math.round(b.gx + sz / 2 - t / 2);
    const ty = Math.round(b.gy + sz / 2 - t / 2);
    return { tx, ty, t };
  }

  // Build:
  //   ownedCells: Set<cellKey>     — every cell owned by any banner/HQ
  //   cellSourceBuildings: Map<cellKey, building[]>
  // cellKey is (gx*100 + gy) — fits since gx,gy ∈ [-7..105] worst case.
  //
  // Connectivity: cells in `ownedCells` form a graph via 4-adjacency.
  // Largest connected component = "main alliance"; the rest are orphans.
  // A banner/HQ is "orphan" if any of its territory cells lands ONLY in an
  // orphan component. (Same definition as the main map.)
  function _computeOwnership() {
    const ownedCells = new Set();
    const buildingTerritories = []; // { building, cells: Set<cellKey> }

    for (const b of _state.buildings) {
      const tb = _territoryCells(b);
      if (!tb) continue;
      const cells = new Set();
      for (let x = tb.tx; x < tb.tx + tb.t; x++) {
        for (let y = tb.ty; y < tb.ty + tb.t; y++) {
          // Only count cells inside the canvas
          if (x < 0 || y < 0 || x >= CANVAS_SIZE || y >= CANVAS_SIZE) continue;
          const k = x * 200 + y;
          cells.add(k);
          ownedCells.add(k);
        }
      }
      buildingTerritories.push({ building: b, cells });
    }

    // Find connected components via 4-adjacency BFS.
    const compId = new Map();   // cellKey → componentId
    const compSize = new Map(); // componentId → cellCount
    let nextComp = 0;
    for (const k of ownedCells) {
      if (compId.has(k)) continue;
      // BFS
      const id = nextComp++;
      const queue = [k];
      compId.set(k, id);
      let count = 0;
      while (queue.length) {
        const c = queue.pop();
        count++;
        const x = Math.floor(c / 200), y = c % 200;
        const neigh = [(x+1)*200+y, (x-1)*200+y, x*200+(y+1), x*200+(y-1)];
        for (const n of neigh) {
          if (ownedCells.has(n) && !compId.has(n)) {
            compId.set(n, id);
            queue.push(n);
          }
        }
      }
      compSize.set(id, count);
    }

    // Determine "main" component = the one containing the HQ if any, else
    // the largest. Buildings outside main = orphans.
    let mainComp = -1;
    const hq = _state.buildings.find(b => b.type === 'hq');
    if (hq) {
      const tb = _territoryCells(hq);
      if (tb) {
        const probeKey = tb.tx * 200 + tb.ty;
        // Find any cell of this HQ's territory that's tracked
        for (let x = tb.tx; x < tb.tx + tb.t; x++) {
          for (let y = tb.ty; y < tb.ty + tb.t; y++) {
            if (x < 0 || y < 0 || x >= CANVAS_SIZE || y >= CANVAS_SIZE) continue;
            const k = x * 200 + y;
            if (compId.has(k)) { mainComp = compId.get(k); break; }
          }
          if (mainComp !== -1) break;
        }
      }
    }
    if (mainComp === -1) {
      // No HQ (or HQ has no in-canvas territory) — main = largest component
      let bestSz = 0;
      for (const [id, sz] of compSize) {
        if (sz > bestSz) { bestSz = sz; mainComp = id; }
      }
    }

    // Per-building: orphan if NONE of its territory cells are in mainComp.
    const orphanBuildings = new Set();
    for (const bt of buildingTerritories) {
      let inMain = false;
      for (const k of bt.cells) {
        if (compId.get(k) === mainComp) { inMain = true; break; }
      }
      if (!inMain) orphanBuildings.add(bt.building.id);
    }

    // Build a "main territory" cell set (used to validate cities).
    const mainCells = new Set();
    for (const k of ownedCells) {
      if (compId.get(k) === mainComp) mainCells.add(k);
    }

    return { ownedCells, mainCells, orphanBuildings, mainComp, buildingTerritories };
  }

  // Cities outside territory: a city is "in territory" iff EVERY one of its
  // 4 footprint cells lies in mainCells.
  function _citiesOutsideTerritory(mainCells) {
    const bad = new Set();
    for (const b of _state.buildings) {
      if (b.type !== 'city') continue;
      const sz = BUILDING_SIZE.city;
      let allIn = true;
      for (let dx = 0; dx < sz; dx++) {
        for (let dy = 0; dy < sz; dy++) {
          const k = (b.gx + dx) * 200 + (b.gy + dy);
          if (!mainCells.has(k)) { allIn = false; break; }
        }
        if (!allIn) break;
      }
      if (!allIn) bad.add(b.id);
    }
    return bad;
  }

  function _recomputeValidation() {
    const counts = { trap: 0, hq: 0, banner: 0, city: 0 };
    for (const b of _state.buildings) {
      if      (b.type === 'beartrap') counts.trap++;
      else if (b.type === 'hq')       counts.hq++;
      else if (b.type === 'banner')   counts.banner++;
      else if (b.type === 'city')     counts.city++;
    }

    const ownership = _computeOwnership();
    const citiesOutside = _citiesOutsideTerritory(ownership.mainCells);

    const errors = [];
    if (_state.buildings.length === 0) errors.push('건물을 배치해 시작하세요.');
    if (counts.trap < MIN_TRAPS) errors.push(`곰 함정이 최소 ${MIN_TRAPS}개 필요합니다`);
    if (counts.trap > MAX_TRAPS) errors.push(`곰 함정은 최대 ${MAX_TRAPS}개입니다`);
    if (counts.hq   > MAX_HQ)    errors.push(`본부는 최대 ${MAX_HQ}개입니다`);
    if (counts.city > MAX_CITIES) errors.push(`도시는 최대 ${MAX_CITIES}개입니다`);
    if (ownership.orphanBuildings.size > 0) errors.push(`연결되지 않은 깃발/본부 ${ownership.orphanBuildings.size}개`);
    if (citiesOutside.size > 0) errors.push(`영토 밖 도시 ${citiesOutside.size}개`);

    _state.validation = {
      counts, errors,
      orphanBuildings: ownership.orphanBuildings,
      citiesOutside,
      mainCells: ownership.mainCells,
      ownedCells: ownership.ownedCells,
      buildingTerritories: ownership.buildingTerritories,
      mainComp: ownership.mainComp,
      compIdLookup: ownership /* keep refs for draw */,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // INPUT
  // ────────────────────────────────────────────────────────────────────

  function _setTool(tool) {
    if (TOOLS.indexOf(tool) === -1) return;
    _state.tool = tool;
    _state.dom.tools.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    _state.dom.canvas.style.cursor = (tool === 'pan') ? 'grab' :
                                     (tool === 'erase') ? 'not-allowed' : 'crosshair';
  }

  function _onKeyDown(e) {
    if (!_isOpen) return;
    if (e.key === 'Escape') { _handleCancel(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (!_state.dom.saveBtn.disabled) _handleSave();
      return;
    }
    if (TOOL_KEY[e.key]) { _setTool(TOOL_KEY[e.key]); e.preventDefault(); }
  }

  function _onMouseDown(e) {
    const { sx, sy } = _localCoords(e);
    if (e.button === 1 || e.button === 2 || _state.tool === 'pan') {
      _state.isDragging = 'pan';
      _state.lastDragX = sx; _state.lastDragY = sy;
      _state.dom.canvas.style.cursor = 'grabbing';
      return;
    }
    const g = _hoveredCell(sx, sy);
    if (!g) return;
    if (_state.tool === 'erase') {
      _eraseAtCell(g.gx, g.gy);
    } else if (BUILDING_SIZE[_state.tool]) {
      _placeBuilding(_state.tool, g.gx, g.gy);
    }
  }

  function _onMouseMove(e) {
    const { sx, sy } = _localCoords(e);
    if (_state.isDragging === 'pan') {
      _state.camX += sx - _state.lastDragX;
      _state.camY += sy - _state.lastDragY;
      _state.lastDragX = sx; _state.lastDragY = sy;
      _redraw();
      return;
    }
    const g = _hoveredCell(sx, sy);
    if (g) {
      _state.hoverGX = g.gx; _state.hoverGY = g.gy;
    } else {
      _state.hoverGX = -1; _state.hoverGY = -1;
    }
    _redraw();
  }

  function _onMouseUp(e) {
    if (_state.isDragging === 'pan') {
      _state.isDragging = false;
      _state.dom.canvas.style.cursor = (_state.tool === 'pan') ? 'grab' : 'crosshair';
    }
  }

  function _onMouseLeave() {
    _state.hoverGX = -1; _state.hoverGY = -1;
    _redraw();
  }

  function _onWheel(e) {
    e.preventDefault();
    const { sx, sy } = _localCoords(e);
    const factor = Math.exp(-e.deltaY * 0.001);
    const newScale = Math.max(0.5, Math.min(40, _state.camScale * factor));
    // Zoom around cursor
    const realFactor = newScale / _state.camScale;
    _state.camX = sx + (_state.camX - sx) * realFactor;
    _state.camY = sy + (_state.camY - sy) * realFactor;
    _state.camScale = newScale;
    _redraw();
  }

  function _localCoords(e) {
    const rect = _state.dom.canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  // Convert pointer screen to a (gx, gy) cell. Returns null if outside 99×99.
  // Snaps so building's top-left lands sensibly under the cursor based on size.
  function _hoveredCell(sx, sy) {
    const { gx, gy } = _screenToGrid(sx, sy);
    let cgx = Math.floor(gx), cgy = Math.floor(gy);
    // For multi-cell building tools, anchor on top-left so the cell under the
    // cursor is roughly center. Offset by half-size.
    if (BUILDING_SIZE[_state.tool]) {
      const sz = BUILDING_SIZE[_state.tool];
      cgx = Math.floor(gx - (sz - 1) / 2);
      cgy = Math.floor(gy - (sz - 1) / 2);
    }
    if (cgx < 0 || cgy < 0 || cgx >= CANVAS_SIZE || cgy >= CANVAS_SIZE) return null;
    return { gx: cgx, gy: cgy };
  }

  // ────────────────────────────────────────────────────────────────────
  // DRAW
  // ────────────────────────────────────────────────────────────────────

  function _rhombusPath(ctx, gx, gy, w, h) {
    const a = _gridToScreen(gx,     gy);
    const b = _gridToScreen(gx + w, gy);
    const c = _gridToScreen(gx + w, gy + h);
    const d = _gridToScreen(gx,     gy + h);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(d.sx, d.sy);
    ctx.closePath();
  }

  function _redraw() {
    if (!_state || !_state.dom) return;
    const ctx = _state.ctx;
    const c = _state.dom.canvas;
    ctx.fillStyle = COLORS.canvasBg;
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);

    // ── Grid ──────────────────────────────────────────────────────
    // Minor lines: every cell. Faint, but visible enough to count cells.
    ctx.strokeStyle = COLORS.gridMinor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 1; i < CANVAS_SIZE; i++) {
      if (i % 10 === 0) continue;   // major lines drawn separately below
      const a = _gridToScreen(i, 0), b = _gridToScreen(i, CANVAS_SIZE);
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      const c2 = _gridToScreen(0, i), d = _gridToScreen(CANVAS_SIZE, i);
      ctx.moveTo(c2.sx, c2.sy); ctx.lineTo(d.sx, d.sy);
    }
    ctx.stroke();

    // Major lines: every 10 cells. Brighter, slightly thicker.
    ctx.strokeStyle = COLORS.gridMajor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 10; i < CANVAS_SIZE; i += 10) {
      const a = _gridToScreen(i, 0), b = _gridToScreen(i, CANVAS_SIZE);
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      const c2 = _gridToScreen(0, i), d = _gridToScreen(CANVAS_SIZE, i);
      ctx.moveTo(c2.sx, c2.sy); ctx.lineTo(d.sx, d.sy);
    }
    ctx.stroke();

    // Outline of the 99×99 canvas — drawn last among grid layers so it's on top.
    ctx.strokeStyle = COLORS.gridOutline;
    ctx.lineWidth = 1.5;
    _rhombusPath(ctx, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.stroke();

    // Center cell highlight — single cell at (49, 49). This is the anchor
    // reference: when this template is stamped, this cell sits under the
    // cursor. Filled with translucent gold, plus an opaque gold outline so
    // it stays visible even when buildings cover it.
    ctx.fillStyle = COLORS.centerCellFill;
    _rhombusPath(ctx, CANVAS_CENTER, CANVAS_CENTER, 1, 1);
    ctx.fill();

    const v = _state.validation;
    if (!v) return;

    // Territory: opaque, single color. Draw all banner/HQ territories — overlap
    // looks unified because they're the same opaque fill.
    for (const bt of v.buildingTerritories) {
      const isOrphan = v.orphanBuildings.has(bt.building.id);
      const fill = isOrphan ? COLORS.orphanFill : COLORS.territoryFill;
      const tb = _territoryCells(bt.building);
      ctx.fillStyle = fill;
      _rhombusPath(ctx, tb.tx, tb.ty, tb.t, tb.t);
      ctx.fill();
    }

    // Buildings — order: city, hq, banner, beartrap (trap on top)
    const order = { city: 0, hq: 1, banner: 2, beartrap: 3 };
    const sorted = _state.buildings.slice().sort((a, b) => order[a.type] - order[b.type]);
    for (const b of sorted) {
      const sz = BUILDING_SIZE[b.type];
      let fill, stroke;
      switch (b.type) {
        case 'city':     fill = COLORS.city;     stroke = COLORS.cityStroke;     break;
        case 'hq':       fill = COLORS.hq;       stroke = COLORS.hqStroke;       break;
        case 'banner':   fill = COLORS.banner;   stroke = COLORS.bannerStroke;   break;
        case 'beartrap': fill = COLORS.beartrap; stroke = COLORS.beartrapStroke; break;
        default:         fill = '#888'; stroke = '#444';
      }
      ctx.fillStyle = fill;
      _rhombusPath(ctx, b.gx, b.gy, sz, sz);
      ctx.fill();
      // Highlight cities outside territory and orphan banners/HQs
      if (v.citiesOutside.has(b.id) || v.orphanBuildings.has(b.id)) {
        ctx.strokeStyle = COLORS.invalidBuilding;
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }

    // Center-cell anchor outline — drawn AFTER buildings so it survives
    // even when a building footprint covers (49,49).
    ctx.strokeStyle = COLORS.centerCellStroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    _rhombusPath(ctx, CANVAS_CENTER, CANVAS_CENTER, 1, 1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hover ghost
    if (_state.hoverGX >= 0 && BUILDING_SIZE[_state.tool]) {
      const sz = BUILDING_SIZE[_state.tool];
      const valid = _canPlace(_state.tool, _state.hoverGX, _state.hoverGY);
      _rhombusPath(ctx, _state.hoverGX, _state.hoverGY, sz, sz);
      ctx.strokeStyle = valid ? COLORS.hoverGhost : COLORS.hoverInvalid;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // HUD: cursor coords
    if (_state.dom.hud) {
      const t = _state.tool;
      const coordStr = (_state.hoverGX >= 0)
        ? `${_state.hoverGX}, ${_state.hoverGY}`
        : '—';
      _state.dom.hud.textContent = `도구: ${TOOL_LABEL[t]}   커서: ${coordStr}   |   1 도시 · 2 깃발 · 3 본부 · 4 함정 · E 지우기 · P 이동 · 휠 확대/축소 · Esc 취소`;
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // STATS PANEL
  // ────────────────────────────────────────────────────────────────────

  function _renderStats() {
    if (!_state.dom.stats) return;
    const v = _state.validation;
    if (!v) return;
    const c = v.counts;

    const row = (label, value, ok, max) => {
      const okStr = ok ? '<span style="color:#3fb950">✓</span>' : '<span style="color:#f85149">✗</span>';
      const range = max != null ? `<span style="color:var(--text-dim)"> / ${max}</span>` : '';
      return `<div class="tpl-ed-row"><span class="tpl-ed-row-label">${label}</span><span class="tpl-ed-row-val">${value}${range} ${okStr}</span></div>`;
    };

    let html = '<div class="tpl-ed-stats-title">통계</div>';
    html += row('곰 함정',     c.trap,   c.trap >= MIN_TRAPS && c.trap <= MAX_TRAPS, `${MIN_TRAPS}-${MAX_TRAPS}`);
    html += row('본부',           c.hq,     c.hq <= MAX_HQ, `0-${MAX_HQ}`);
    html += row('깃발',      c.banner, true);
    html += row('도시',       c.city,   c.city <= MAX_CITIES, MAX_CITIES);
    html += row('연결 끊김',      v.orphanBuildings.size, v.orphanBuildings.size === 0);
    html += row('영토 밖 도시', v.citiesOutside.size,   v.citiesOutside.size === 0);

    if (v.errors.length > 0 && _state.buildings.length > 0) {
      html += '<div class="tpl-ed-errs">';
      for (const e of v.errors) html += `<div>• ${e}</div>`;
      html += '</div>';
    }

    _state.dom.stats.innerHTML = html;

    // Toggle save button
    const canSave = v.errors.length === 0 && _state.buildings.length > 0;
    _state.dom.saveBtn.disabled = !canSave;
  }

  // ────────────────────────────────────────────────────────────────────
  // SAVE / CANCEL
  // ────────────────────────────────────────────────────────────────────

  function _computeTightBboxAndAnchor() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of _state.buildings) {
      const sz = BUILDING_SIZE[b.type];
      if (b.gx < minX) minX = b.gx;
      if (b.gy < minY) minY = b.gy;
      if (b.gx + sz > maxX) maxX = b.gx + sz;
      if (b.gy + sz > maxY) maxY = b.gy + sz;
    }
    const w = maxX - minX, h = maxY - minY;
    // Anchor: cell (49, 49) of the editor canvas, expressed in template-local
    // coords (relative to the tight bbox top-left).
    const anchor = { gx: CANVAS_CENTER - minX, gy: CANVAS_CENTER - minY };
    return { bbox: { w, h }, anchor, minX, minY };
  }

  function _handleSave() {
    if (_state.dom.saveBtn.disabled) return;
    const name = prompt('템플릿 이름 (필수, 최대 60자):', _state.initialName || '');
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) { alert('이름을 입력하세요.'); return; }
    if (trimmed.length > 60) { alert('이름은 60자 이하여야 합니다.'); return; }

    const desc = prompt('설명 (선택, 최대 200자):', _state.initialDescription || '') || '';
    if (desc.length > 200) { alert('설명은 200자 이하여야 합니다.'); return; }

    const { bbox, anchor, minX, minY } = _computeTightBboxAndAnchor();
    const buildings = _state.buildings.map(b => ({
      type: b.type,
      gx: b.gx - minX,
      gy: b.gy - minY,
    }));
    const payload = {
      name: trimmed,
      description: desc.trim(),
      bbox, anchor, buildings,
    };

    const cb = _state.onSave;
    close();
    cb(payload);
  }

  function _handleCancel() {
    if (_state.buildings.length > 0) {
      if (!confirm('이 템플릿을 버리시겠습니까? 저장하지 않은 변경 사항은 사라집니다.')) return;
    }
    const cb = _state.onCancel;
    close();
    cb();
  }

  // ────────────────────────────────────────────────────────────────────
  // STYLE + HTML TEMPLATES
  // ────────────────────────────────────────────────────────────────────

  const _STYLE = `
<style>
#tplEditorModal { position: fixed; inset: 0; z-index: 10000;
  background: rgba(8,12,18,0.96); color: #e6edf3;
  font: 14px/1.4 -apple-system, Segoe UI, sans-serif;
  display: flex; flex-direction: column; }
#tplEditorModal .tpl-ed-header { padding: 12px 18px;
  border-bottom: 1px solid #30363d; display: flex; align-items: center;
  gap: 16px; background: #161b22; }
#tplEditorModal .tpl-ed-title { font-weight: 600; font-size: 16px; color: #c9a84c; }
#tplEditorModal .tpl-ed-tools { display: flex; gap: 6px; }
#tplEditorModal .tpl-ed-tool {
  background: #0d1117; color: #e6edf3; border: 1px solid #30363d;
  padding: 6px 14px; border-radius: 6px; cursor: pointer; font: inherit; }
#tplEditorModal .tpl-ed-tool:hover { background: #21262d; }
#tplEditorModal .tpl-ed-tool.active {
  background: #c9a84c; border-color: #c9a84c; color: #0d1117; font-weight: 600; }
#tplEditorModal .tpl-ed-spacer { flex: 1; }
#tplEditorModal .tpl-ed-body { flex: 1; display: flex; min-height: 0; }
#tplEditorModal .tpl-ed-canvas-wrap { flex: 1; position: relative; min-width: 0; }
#tplEditorModal #tplEdCanvas { display: block; width: 100%; height: 100%;
  background: #0a0d12; }
#tplEditorModal #tplEdHud { position: absolute; left: 12px; bottom: 12px;
  font: 12px/1 monospace; color: #8b949e; background: rgba(0,0,0,0.5);
  padding: 6px 10px; border-radius: 4px; pointer-events: none; }
#tplEditorModal .tpl-ed-side {
  width: 260px; padding: 16px; background: #161b22;
  border-left: 1px solid #30363d; display: flex; flex-direction: column;
  gap: 12px; overflow-y: auto; }
#tplEditorModal .tpl-ed-stats-title {
  font-weight: 600; color: #c9a84c; margin-bottom: 4px; font-size: 13px; }
#tplEditorModal .tpl-ed-row {
  display: flex; justify-content: space-between; padding: 4px 0;
  border-bottom: 1px dashed #21262d; font-size: 13px; }
#tplEditorModal .tpl-ed-row-label { color: #8b949e; }
#tplEditorModal .tpl-ed-row-val   { font-family: monospace; }
#tplEditorModal .tpl-ed-errs {
  background: #2d1418; border: 1px solid #6e2530; border-radius: 6px;
  padding: 8px 10px; font-size: 12px; color: #ff8a8a; }
#tplEditorModal .tpl-ed-footer {
  padding: 12px 18px; border-top: 1px solid #30363d;
  display: flex; gap: 10px; justify-content: space-between; background: #161b22; }
#tplEditorModal .tpl-ed-btn {
  padding: 8px 16px; border-radius: 6px; cursor: pointer; font: inherit;
  border: 1px solid transparent; }
#tplEditorModal .tpl-ed-btn-primary {
  background: #c9a84c; border-color: #c9a84c; color: #0d1117; font-weight: 600; }
#tplEditorModal .tpl-ed-btn-primary:disabled {
  background: #4a4a4a; border-color: #4a4a4a; color: #8b949e; cursor: not-allowed; }
#tplEditorModal .tpl-ed-btn-secondary {
  background: #21262d; border-color: #30363d; color: #e6edf3; }
#tplEditorModal .tpl-ed-btn-secondary:hover { background: #30363d; }
</style>`;

  const _HTML = `
<div class="tpl-ed-header">
  <div class="tpl-ed-title">템플릿 편집기</div>
  <div class="tpl-ed-tools">
    <button class="tpl-ed-tool" data-tool="city">도시 <span style="color:#888">(1)</span></button>
    <button class="tpl-ed-tool" data-tool="banner">깃발 <span style="color:#888">(2)</span></button>
    <button class="tpl-ed-tool" data-tool="hq">본부 <span style="color:#888">(3)</span></button>
    <button class="tpl-ed-tool" data-tool="beartrap">곰 함정 <span style="color:#888">(4)</span></button>
    <button class="tpl-ed-tool" data-tool="erase">지우기 <span style="color:#888">(E)</span></button>
    <button class="tpl-ed-tool" data-tool="pan">이동 <span style="color:#888">(P)</span></button>
  </div>
  <div class="tpl-ed-spacer"></div>
</div>
<div class="tpl-ed-body">
  <div class="tpl-ed-canvas-wrap">
    <canvas id="tplEdCanvas"></canvas>
    <div id="tplEdHud"></div>
  </div>
  <div class="tpl-ed-side">
    <div id="tplEdStats"></div>
  </div>
</div>
<div class="tpl-ed-footer">
  <button id="tplEdCancel" class="tpl-ed-btn tpl-ed-btn-secondary">취소</button>
  <button id="tplEdSave" class="tpl-ed-btn tpl-ed-btn-primary" disabled>템플릿 저장</button>
</div>`;

  // ── Export ──────────────────────────────────────────────────────────
  root.TemplateEditor = { open, close };
})(typeof self !== 'undefined' ? self : this);
