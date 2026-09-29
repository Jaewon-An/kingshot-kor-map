// ═══════════════════════════════════════════════════════════════════
// KINGSHOT MAPPER — TEMPLATE STAMP TOOL (Phase 5, v2)
// ═══════════════════════════════════════════════════════════════════
// v2 changes from v1:
//   • Uses a TRANSPARENT overlay canvas with pointer-events:none for ghost
//     rendering, driven by requestAnimationFrame. No more monkey-patching
//     window.draw — that was unreliable across engines.
//   • Preserves alliance-tag case exactly as entered (no .toUpperCase()).
//
// Public API:
//   TemplateStamp.activate({
//     template, allianceTag, workerUrl,
//     onCommit: ({stampedIds}) => {},
//     onCancel: () => {},
//   });
//   TemplateStamp.deactivate();
//
// Hotkeys (while active):
//   Q  rotate 90° left
//   E  rotate 90° right
//   X  mirror across X axis
//   Y  mirror across Y axis
//   Esc cancel
//   Click  commit (with confirm if any cells doomed)
// ═══════════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  const SIZES = { city: 2, beartrap: 3, banner: 1, hq: 3 };

  // Persistent — survives across activate/deactivate so undo/redo of past
  // stamps still fires use-count adjustments.
  const _stampHistory = [];   // array of { tplId, ids: Set<string>, active: bool }
  let _undoHooksInstalled = false;
  let _origUndo, _origRedo;
  let _cachedWorkerUrl = '';

  let _state = null;

  // ────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ────────────────────────────────────────────────────────────────────

  function activate(opts) {
    if (_state) return;
    opts = opts || {};
    if (!opts.template) return;
    if (typeof canvas === 'undefined' || !canvas) return;
    _cachedWorkerUrl = (opts.workerUrl || _cachedWorkerUrl || '').replace(/\/$/, '');

    _state = {
      template:    opts.template,
      // Preserve case exactly as entered
      allianceTag: String(opts.allianceTag || '').slice(0, 3),
      onCommit:    typeof opts.onCommit === 'function' ? opts.onCommit : () => {},
      onCancel:    typeof opts.onCancel === 'function' ? opts.onCancel : () => {},
      rotation:    0,
      flipX:       false,
      flipY:       false,
      hoverGX:     null,
      hoverGY:     null,
      hovering:    false,
      _xformed:    null,
      _xformedAnchor: null,
      _rafId:      0,
      _overlay:    null,
      _overlayCtx: null,
      _resizeBound:null,
      _hud:        null,
      _pan:        null,
    };
    _recomputeTransform();
    _createOverlayCanvas();
    _installUndoHooks();
    _attachInputListeners();
    _showHud();
    _startRenderLoop();
  }

  function deactivate() {
    if (!_state) return;
    const cb = _state.onCancel;
    _stopRenderLoop();
    _detachInputListeners();
    _removeOverlayCanvas();
    _hideHud();
    _state = null;
    cb();
  }

  // ────────────────────────────────────────────────────────────────────
  // OVERLAY CANVAS — sits over main canvas, pointer-events:none
  // ────────────────────────────────────────────────────────────────────

  function _createOverlayCanvas() {
    const main = canvas;
    if (!main || !main.parentNode) return;
    const overlay = document.createElement('canvas');
    overlay.id = 'tplStampOverlay';
    overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:50;left:0;top:0;';
    main.parentNode.appendChild(overlay);
    _state._overlay = overlay;
    _state._overlayCtx = overlay.getContext('2d');
    _state._resizeBound = _resizeOverlay;
    window.addEventListener('resize', _state._resizeBound);
    _resizeOverlay();
  }

  function _resizeOverlay() {
    if (!_state || !_state._overlay) return;
    const main = canvas;
    const overlay = _state._overlay;
    overlay.width  = main.width;
    overlay.height = main.height;
    const mainRect   = main.getBoundingClientRect();
    const parentRect = main.parentNode.getBoundingClientRect();
    overlay.style.left   = (mainRect.left - parentRect.left) + 'px';
    overlay.style.top    = (mainRect.top  - parentRect.top)  + 'px';
    overlay.style.width  = mainRect.width  + 'px';
    overlay.style.height = mainRect.height + 'px';
  }

  function _removeOverlayCanvas() {
    if (_state && _state._resizeBound) {
      window.removeEventListener('resize', _state._resizeBound);
    }
    if (_state && _state._overlay && _state._overlay.parentNode) {
      _state._overlay.parentNode.removeChild(_state._overlay);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // RENDER LOOP — rAF, runs continuously while active
  // ────────────────────────────────────────────────────────────────────

  function _startRenderLoop() {
    // Skip _drawOverlay when none of the inputs that affect the overlay have
    // changed since last frame. The RAF callback itself still fires at 60Hz
    // but the body is a cheap 9-comparison check when idle.
    let _lastSig = '';
    const tick = () => {
      if (!_state) return;
      window.__perf && window.__perf.mark('stampTick');
      try {
        const sig =
          _state.hoverGX + '|' + _state.hoverGY + '|' + (_state.hovering ? 1 : 0) + '|' +
          _state.rotation + '|' + (_state.flipX ? 1 : 0) + '|' + (_state.flipY ? 1 : 0) + '|' +
          camX + '|' + camY + '|' + camScale;
        if (sig !== _lastSig) {
          _lastSig = sig;
          _drawOverlay();
        }
      } finally {
        window.__perf && window.__perf.measure('stampTick');
      }
      _state._rafId = requestAnimationFrame(tick);
    };
    _state._rafId = requestAnimationFrame(tick);
  }

  function _stopRenderLoop() {
    if (_state && _state._rafId) cancelAnimationFrame(_state._rafId);
  }

  function _gridToScreen(gx, gy) {
    if (typeof gridToIso !== 'function') return { sx: 0, sy: 0 };
    const { ix, iy } = gridToIso(gx, gy);
    const main = canvas;
    return {
      sx: main.width  / 2 + (ix + camX) * camScale,
      sy: main.height / 2 + (iy + camY) * camScale,
    };
  }

  function _drawOverlay() {
    const ctx = _state && _state._overlayCtx;
    const overlay = _state && _state._overlay;
    if (!ctx || !overlay) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!_state.hovering || _state.hoverGX == null) return;
    const { placements } = _evalPlacement();
    const validPlacements = placements.filter(p => !p.doomed);

    function rhombus(gx, gy, w, h) {
      const a = _gridToScreen(gx,     gy);
      const b = _gridToScreen(gx + w, gy);
      const c = _gridToScreen(gx + w, gy + h);
      const d = _gridToScreen(gx,     gy + h);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(c.sx, c.sy); ctx.lineTo(d.sx, d.sy);
      ctx.closePath();
    }

    ctx.save();

    // ── Layer 1: combined territory outline ─────────────────────────
    // Trace the perimeter of the union of all (non-doomed) banner + HQ
    // territories. Drawn as a single boundary line so the user sees the
    // overall alliance footprint without per-banner clutter.
    _drawTerritoryOutline(ctx, validPlacements);

    // ── Layer 2: building ghosts ────────────────────────────────────
    for (const p of placements) {
      const sz = SIZES[p.b.type];
      let fill, stroke;
      if (p.doomed) {
        fill = 'rgba(255,85,85,0.55)'; stroke = '#ff5555';
      } else {
        switch (p.b.type) {
          case 'beartrap': fill = 'rgba(192,57,43,0.85)';  stroke = '#7c1d12'; break;
          case 'hq':       fill = 'rgba(142,68,173,0.85)'; stroke = '#5b2e75'; break;
          case 'banner':   fill = 'rgba(241,196,15,0.85)'; stroke = '#7d6608'; break;
          case 'city':     fill = 'rgba(74,158,221,0.85)'; stroke = '#1f4d6e'; break;
          default:         fill = 'rgba(136,136,136,0.85)'; stroke = '#444';
        }
      }
      rhombus(p.absGX, p.absGY, sz, sz);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }

    // ── Layer 3: cursor anchor crosshair ────────────────────────────
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    rhombus(_state.hoverGX, _state.hoverGY, 1, 1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Compute the union of territory cells from all valid banner/HQ placements
  // and trace its perimeter as a single set of edges.
  // Algorithm: for each owned cell, draw each of its 4 cell-edges where the
  // neighbor cell on the other side is NOT in the owned set. Edges where
  // both adjacent cells are owned are interior and don't get drawn.
  function _drawTerritoryOutline(ctx, validPlacements) {
    const TERRITORY_SIZE = { banner: 7, hq: 15 };
    const owned = new Set();
    for (const p of validPlacements) {
      const tSz = TERRITORY_SIZE[p.b.type];
      if (!tSz) continue;
      const bSz = SIZES[p.b.type];
      const tx = Math.round(p.absGX + bSz / 2 - tSz / 2);
      const ty = Math.round(p.absGY + bSz / 2 - tSz / 2);
      for (let dx = 0; dx < tSz; dx++) {
        for (let dy = 0; dy < tSz; dy++) {
          owned.add((tx + dx) * 1200 + (ty + dy));
        }
      }
    }
    if (owned.size === 0) return;

    ctx.beginPath();
    for (const k of owned) {
      const x = Math.floor(k / 1200), y = k % 1200;
      // North edge: top of cell (x, y); shared with cell (x, y-1)
      if (!owned.has(x * 1200 + (y - 1))) {
        const a = _gridToScreen(x,     y);
        const b = _gridToScreen(x + 1, y);
        ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      }
      // East edge: right of cell; shared with (x+1, y)
      if (!owned.has((x + 1) * 1200 + y)) {
        const a = _gridToScreen(x + 1, y);
        const b = _gridToScreen(x + 1, y + 1);
        ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      }
      // South edge: bottom of cell; shared with (x, y+1)
      if (!owned.has(x * 1200 + (y + 1))) {
        const a = _gridToScreen(x,     y + 1);
        const b = _gridToScreen(x + 1, y + 1);
        ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      }
      // West edge: left of cell; shared with (x-1, y)
      if (!owned.has((x - 1) * 1200 + y)) {
        const a = _gridToScreen(x,     y);
        const b = _gridToScreen(x,     y + 1);
        ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      }
    }
    ctx.strokeStyle = 'rgba(58, 143, 183, 0.85)';   // teal — same family as thumbnail territory shading
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ────────────────────────────────────────────────────────────────────
  // TRANSFORMS + PLACEMENT EVAL
  // ────────────────────────────────────────────────────────────────────

  function _xform(gx, gy, w, h) {
    if (_state.flipX) gx = (w - 1) - gx;
    if (_state.flipY) gy = (h - 1) - gy;
    let r = _state.rotation & 3;
    let curW = w, curH = h;
    while (r-- > 0) {
      const nx = (curH - 1) - gy;
      const ny = gx;
      gx = nx; gy = ny;
      const tmp = curW; curW = curH; curH = tmp;
    }
    return { gx, gy };
  }

  function _recomputeTransform() {
    const tpl = _state.template;
    const w = tpl.bbox.w, h = tpl.bbox.h;
    const out = [];
    for (let i = 0; i < tpl.buildings.length; i++) {
      const b = tpl.buildings[i];
      const sz = SIZES[b.type] || 1;
      const c1 = _xform(b.gx,            b.gy,            w, h);
      const c2 = _xform(b.gx + sz - 1,   b.gy + sz - 1,   w, h);
      out.push({
        type: b.type,
        gx: Math.min(c1.gx, c2.gx),
        gy: Math.min(c1.gy, c2.gy),
        originalIdx: i,
      });
    }
    _state._xformed       = out;
    _state._xformedAnchor = _xform(tpl.anchor.gx, tpl.anchor.gy, w, h);
  }

  function _evalPlacement() {
    const ta = _state._xformedAnchor;
    const transformed = _state._xformed;
    const anchorGX = _state.hoverGX, anchorGY = _state.hoverGY;
    const bboxOriginGX = anchorGX - ta.gx;
    const bboxOriginGY = anchorGY - ta.gy;

    const placements = [];
    for (const tb of transformed) {
      const sz = SIZES[tb.type];
      const absGX = bboxOriginGX + tb.gx;
      const absGY = bboxOriginGY + tb.gy;
      let doomed = false, reason = '';

      const G = (typeof GRID_SIZE !== 'undefined') ? GRID_SIZE : 1200;
      if (absGX < 0 || absGY < 0 || absGX + sz > G || absGY + sz > G) {
        doomed = true; reason = 'out-of-bounds';
      }

      if (!doomed) {
        // Use core.js's full restriction logic — handles King's zone, permanent building
        // footprints (Fortress/Sanctuary/turrets), ruins (banner/HQ/trap), fertile (HQ),
        // forbidden maroon zone (HQ + non-city), and all per-type zone rules.
        if (typeof inForbiddenZone === 'function' && inForbiddenZone(absGX, absGY, sz, tb.type)) {
          doomed = true; reason = 'restricted';
        }
      }

      if (!doomed) {
        // Terrain (lakes/mountains) — still check at cell granularity in case
        // inForbiddenZone above wasn't available or terrain override is on for non-stamp builds.
        const lake = (typeof _lakeCells       !== 'undefined') ? _lakeCells       : null;
        const mt   = (typeof _mtCells         !== 'undefined') ? _mtCells         : null;
        outer:
        for (let dx = 0; dx < sz; dx++) {
          for (let dy = 0; dy < sz; dy++) {
            const k = (absGX + dx) * 1200 + (absGY + dy);
            if (lake && lake.has(k))  { doomed = true; reason = 'lake';      break outer; }
            if (mt && mt.has(k))      { doomed = true; reason = 'mountain';  break outer; }
          }
        }
      }

      if (!doomed) {
        // Use core.js's spatial-hash-backed overlap check. Without this,
        // each template building was scanning ALL existing buildings on the
        // map — quadratic in (template_size × map_size) per frame.
        if (typeof wouldOverlap === 'function' && wouldOverlap(absGX, absGY, sz, null)) {
          doomed = true; reason = 'overlap';
        }
      }

      placements.push({ b: tb, absGX, absGY, doomed, doomReason: reason });
    }

    return { anchorGX, anchorGY, bboxOriginGX, bboxOriginGY, placements };
  }

  // ────────────────────────────────────────────────────────────────────
  // INPUT — capture-phase listeners on main canvas
  // ────────────────────────────────────────────────────────────────────

  function _attachInputListeners() {
    const c = canvas;
    if (!c) return;
    c.addEventListener('mousemove', _onMouseMove, true);
    c.addEventListener('mousedown', _onMouseDown, true);
    c.addEventListener('mouseup',   _onMouseUp,   true);
    c.addEventListener('mouseleave', _onMouseLeave, true);
    c.addEventListener('contextmenu', _onContextMenu, true);
    document.addEventListener('keydown', _onKeyDown, true);
  }

  function _detachInputListeners() {
    const c = canvas;
    if (c) {
      c.removeEventListener('mousemove', _onMouseMove, true);
      c.removeEventListener('mousedown', _onMouseDown, true);
      c.removeEventListener('mouseup',   _onMouseUp,   true);
      c.removeEventListener('mouseleave', _onMouseLeave, true);
      c.removeEventListener('contextmenu', _onContextMenu, true);
    }
    document.removeEventListener('keydown', _onKeyDown, true);
  }

  function _onMouseMove(e) {
    if (!_state) return;
    const main = canvas;
    const rect = main.getBoundingClientRect();

    // Pan in progress — drive the camera directly. We do this here (instead of
    // relying on the main canvas mousemove) because the stamp's capture-phase
    // listener can shadow the main listener in some browsers.
    if (_state._pan) {
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (typeof camX !== 'undefined' && typeof camY !== 'undefined' && typeof camScale !== 'undefined') {
        camX = _state._pan.startCamX + (sx - _state._pan.startSX) / camScale;
        camY = _state._pan.startCamY + (sy - _state._pan.startSY) / camScale;
        if (typeof scheduleDraw === 'function') scheduleDraw();
      }
      e.stopPropagation();
      return;
    }

    e.stopPropagation();
    const sxBuffer = (e.clientX - rect.left) * (main.width  / rect.width);
    const syBuffer = (e.clientY - rect.top)  * (main.height / rect.height);
    if (typeof screenToGrid === 'function') {
      const cell = screenToGrid(sxBuffer, syBuffer);
      if (cell && Number.isFinite(cell.gx) && Number.isFinite(cell.gy)) {
        _state.hoverGX = Math.floor(cell.gx);
        _state.hoverGY = Math.floor(cell.gy);
        _state.hovering = true;
      }
    }
    _updateHud();
  }

  function _onMouseLeave() {
    if (!_state) return;
    _state._pan = null;
    canvas.style.cursor = '';
    _state.hovering = false;
  }

  function _onMouseDown(e) {
    if (!_state) return;
    // Panning gestures: middle-mouse, or Alt + left click. Drive panning from
    // the stamp itself so it works regardless of how the main canvas's
    // listener interacts with our capture-phase handler.
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      const rect = canvas.getBoundingClientRect();
      _state._pan = {
        startSX:   e.clientX - rect.left,
        startSY:   e.clientY - rect.top,
        startCamX: (typeof camX !== 'undefined') ? camX : 0,
        startCamY: (typeof camY !== 'undefined') ? camY : 0,
      };
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }
    if (e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      _commitStamp();
    } else if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      deactivate();
    }
  }

  function _onMouseUp(e) {
    if (!_state) return;
    if (_state._pan) {
      _state._pan = null;
      canvas.style.cursor = '';
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }

  function _onContextMenu(e) {
    if (!_state) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function _onKeyDown(e) {
    if (!_state) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); deactivate(); return; }
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    let handled = false;
    if      (e.key === 'q' || e.key === 'Q') { _state.rotation = (_state.rotation + 3) & 3; handled = true; }
    else if (e.key === 'e' || e.key === 'E') { _state.rotation = (_state.rotation + 1) & 3; handled = true; }
    else if (e.key === 'x' || e.key === 'X') { _state.flipX = !_state.flipX; handled = true; }
    else if (e.key === 'y' || e.key === 'Y') { _state.flipY = !_state.flipY; handled = true; }
    if (handled) {
      e.preventDefault(); e.stopPropagation();
      _recomputeTransform();
      _updateHud();
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // COMMIT
  // ────────────────────────────────────────────────────────────────────

  function _commitStamp() {
    const result  = _evalPlacement();
    const valid   = result.placements.filter(p => !p.doomed);
    const dropped = result.placements.length - valid.length;

    if (valid.length === 0) {
      alert('All buildings would be dropped — nothing to place.');
      return;
    }
    if (dropped > 0) {
      const ok = confirm(`Stamp template? ${dropped} building${dropped === 1 ? '' : 's'} will be skipped due to overlap or restricted terrain.`);
      if (!ok) return;
    }

    const tag = _state.allianceTag;
    const stampedIds = [];
    let trapCounter = 0;
    const trapTotal = valid.filter(p => p.b.type === 'beartrap').length;
    if (typeof pushHistory === 'function') pushHistory();
    if (typeof placementSeq !== 'number') placementSeq = 0;

    const defs = (typeof BUILDING_DEFS !== 'undefined') ? BUILDING_DEFS : {};
    for (const p of valid) {
      const t = p.b.type;
      let label;
      if (t === 'beartrap') {
        trapCounter++;
        label = trapTotal > 1 ? `Bear Trap ${trapCounter}` : 'Bear Trap';
      } else {
        label = tag;
      }
      const def = defs[t] || {};
      const newB = {
        id: (typeof _genId === 'function')
          ? _genId()
          : ('s_' + Date.now() + '_' + Math.random().toString(36).slice(2)),
        type: t,
        gx: p.absGX, gy: p.absGY,
        label,
        color: def.defaultColor || '#888888',
        seq: ++placementSeq,
      };
      buildings.push(newB);
      stampedIds.push(newB.id);
    }

    if (typeof invalidateTset       === 'function') invalidateTset();
    if (typeof invalidateBuildings  === 'function') invalidateBuildings();
    if (typeof saveToStorage        === 'function') saveToStorage();
    if (typeof updatePlacedList     === 'function') updatePlacedList();
    if (typeof draw                 === 'function') draw();

    const tplId = _state.template.id;
    _stampHistory.push({ tplId, ids: new Set(stampedIds), active: true });
    _fireUseCount(tplId, +1);

    const cbCommit = _state.onCommit;
    _stopRenderLoop();
    _detachInputListeners();
    _removeOverlayCanvas();
    _hideHud();
    _state = null;
    cbCommit({ stampedIds });
  }

  // ────────────────────────────────────────────────────────────────────
  // UNDO/REDO HOOKS
  // ────────────────────────────────────────────────────────────────────

  function _installUndoHooks() {
    if (_undoHooksInstalled) return;
    _origUndo = root.undo;
    _origRedo = root.redo;
    root.undo = function () {
      if (typeof _origUndo === 'function') _origUndo.apply(this, arguments);
      _checkStampStateChanges();
    };
    root.redo = function () {
      if (typeof _origRedo === 'function') _origRedo.apply(this, arguments);
      _checkStampStateChanges();
    };
    _undoHooksInstalled = true;
  }

  function _checkStampStateChanges() {
    if (typeof buildings === 'undefined' || !buildings) return;
    const ids = new Set(buildings.map(b => b.id));
    for (const ss of _stampHistory) {
      let allPresent = true;
      for (const id of ss.ids) {
        if (!ids.has(id)) { allPresent = false; break; }
      }
      if (ss.active && !allPresent) {
        ss.active = false;
        _fireUseCount(ss.tplId, -1);
      } else if (!ss.active && allPresent) {
        ss.active = true;
        _fireUseCount(ss.tplId, +1);
      }
    }
  }

  function _fireUseCount(tplId, delta) {
    const u = (_cachedWorkerUrl || '').replace(/\/$/, '');
    if (!tplId || !u) return;
    try {
      fetch(u + '/templates/' + encodeURIComponent(tplId) + '/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  }

  function _setWorkerUrl(u) { if (u) _cachedWorkerUrl = u.replace(/\/$/, ''); }

  // ────────────────────────────────────────────────────────────────────
  // HUD
  // ────────────────────────────────────────────────────────────────────

  function _showHud() {
    let hud = document.getElementById('tplStampHud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'tplStampHud';
      hud.style.cssText = `
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
        background: rgba(13,17,23,0.94); border: 1px solid #c9a84c;
        color: #e6edf3; padding: 13px 21px; border-radius: 8px;
        font: 17px/1.4 -apple-system, Segoe UI, sans-serif;
        z-index: 9999; pointer-events: none; max-width: 90vw; text-align: center;
      `;
      document.body.appendChild(hud);
    }
    if (_state) _state._hud = hud;
    _updateHud();
  }

  function _hideHud() {
    const hud = document.getElementById('tplStampHud');
    if (hud && hud.parentNode) hud.parentNode.removeChild(hud);
  }

  function _updateHud() {
    if (!_state || !_state._hud) return;
    const tpl = _state.template;
    let droppedCount = 0;
    const willPlace = { trap: 0, banner: 0, hq: 0, city: 0 };
    if (_state.hovering && _state.hoverGX != null) {
      const r = _evalPlacement();
      for (const p of r.placements) {
        if (p.doomed) droppedCount++;
        else {
          if      (p.b.type === 'beartrap') willPlace.trap++;
          else if (p.b.type === 'banner')   willPlace.banner++;
          else if (p.b.type === 'hq')       willPlace.hq++;
          else if (p.b.type === 'city')     willPlace.city++;
        }
      }
    }
    const xfPills = [];
    if (_state.rotation) xfPills.push(`rot ${_state.rotation * 90}°`);
    if (_state.flipX)    xfPills.push('flip X');
    if (_state.flipY)    xfPills.push('flip Y');
    const xfText = xfPills.length ? ` · ${xfPills.join(' · ')}` : '';

    const placementText = (_state.hovering && _state.hoverGX != null)
      ? `Will place: ${willPlace.trap} trap · ${willPlace.hq} HQ · ${willPlace.banner} banner · ${willPlace.city} city` +
        (droppedCount > 0 ? ` <span style="color:#ff7878">— ${droppedCount} dropped</span>` : '')
      : 'Move cursor over map to preview';

    _state._hud.innerHTML = `
      <div style="font-weight:600;color:#c9a84c;">
        🐝 Stamping: ${_escape(tpl.name)} <span style="color:#8b949e;font-weight:normal;">[${_escape(_state.allianceTag)}]</span>${xfText}
      </div>
      <div style="margin-top:4px;color:#c9d1d9;">${placementText}</div>
      <div style="margin-top:6px;color:#c9d1d9;font-size:16px;font-weight:500;">
        Q/E rotate · X/Y mirror · Click commit · Alt+Drag or Middle-Drag pan · Esc cancel
      </div>`;
  }

  function _escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ── Export ─────────────────────────────────────────────────────────
  root.TemplateStamp = {
    activate, deactivate,
    _checkStampStateChanges,
    _stampHistory,
    _xform, _evalPlacement,
    _setWorkerUrl,
  };
})(typeof self !== 'undefined' ? self : this);
