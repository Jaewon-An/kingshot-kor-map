// ═══════════════════════════════════════════════════════════════════
// KINGSHOT MAPPER — TEMPLATE THUMBNAIL RENDERER (Phase 2)
// ═══════════════════════════════════════════════════════════════════
// Pure function. Takes a template doc and produces an SVG string.
// No DOM dependencies — runs in browser or Node.
//
// Used by:
//   • The "Use Hive Template" picker in index.html (Phase 5)
//   • The admin templates tab in admin.html (Phase 6)
//
// The projection matches the main map exactly:
//   ix = (gx - gy)
//   iy = -(gx + gy)
// Same isometric diamond — south corner at (0,0), north at (max,max).
// ═══════════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  // Match BUILDING_DEFS in core.js exactly.
  const BUILDING_SIZE = {
    city:     2,
    beartrap: 3,
    banner:   1,
    hq:       3,
  };

  // `territory` is the SIZE (side length in cells) of the t×t territory
  // square. core.js centers it on the building's center, with rounding:
  //   tx = round(gx + size/2 - t/2)  →  territory covers [tx, tx+t)
  // 0 means no territory (cities/traps/etc.).
  const TERRITORY_SIZE = {
    banner: 7,
    hq:     15,
  };

  // Compute territory bounding box in world coords (matches core.js).
  function territoryBox(b) {
    const t = TERRITORY_SIZE[b.type];
    if (!t) return null;
    const sz = BUILDING_SIZE[b.type] || 1;
    const tx = Math.round(b.gx + sz / 2 - t / 2);
    const ty = Math.round(b.gy + sz / 2 - t / 2);
    return { tx, ty, t };
  }

  // Default colors. Banner/HQ both contribute to "alliance territory" — drawn
  // in ONE unified opaque color. Opaque means overlapping rhombi don't darken
  // cumulatively, so the territory reads as a single merged region.
  const COLORS = {
    territoryFill:   '#2d5a73',     // unified alliance shading — opaque, no alpha
    banner:          '#f1c40f',     // gold — stands out against teal territory
    bannerStroke:    '#7d6608',
    hq:              '#8e44ad',     // purple — distinguishes from territory
    hqStroke:        '#5b2e75',
    city:            '#4a9edd',     // matches BUILDING_DEFS.city.defaultColor
    cityStroke:      '#1f4d6e',
    beartrap:        '#c0392b',     // matches BUILDING_DEFS.beartrap.defaultColor
    beartrapStroke:  '#7c1d12',
  };

  // Iso projection: world (gx,gy) → iso (ix,iy). y is "up-positive" here;
  // we'll flip and translate when mapping to SVG y-down coordinates.
  function projectIso(gx, gy) {
    return { ix: gx - gy, iy: -(gx + gy) };
  }

  /**
   * Render a template thumbnail to an SVG string.
   *
   * @param {object} template  — { buildings: [{type, gx, gy}], ... }
   * @param {number} sizePx    — target SVG width/height in pixels (square)
   * @param {object} [opts]
   * @param {boolean} [opts.showTerritory=true]   — shade banner/HQ territory
   * @param {boolean} [opts.transparentBg=true]   — omit background rect
   * @param {string}  [opts.bgColor='#0d1117']    — bg color when not transparent
   * @returns {string} SVG markup
   */
  function renderTemplateThumbnail(template, sizePx, opts) {
    sizePx = sizePx || 120;
    opts = opts || {};
    const showTerritory  = opts.showTerritory  !== false;
    const transparentBg  = opts.transparentBg  !== false;
    const bgColor        = opts.bgColor || '#0d1117';
    const rotation       = opts.rotation || 0;

    let buildings = (template && template.buildings) || [];
    if (buildings.length === 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}"></svg>`;
    }

    // Apply rotation to buildings if specified (matches template_stamp.js logic)
    if (rotation && rotation % 4 !== 0) {
      const bbox = template.bbox || { w: 0, h: 0 };
      const rots = rotation % 4;
      buildings = buildings.map(b => {
        let gx = b.gx, gy = b.gy;
        const sz = BUILDING_SIZE[b.type] || 1;
        let curW = bbox.w, curH = bbox.h;
        // Apply rotation transform same as stamp tool
        for (let r = 0; r < rots; r++) {
          const nx = (curH - 1) - gy;
          const ny = gx;
          gx = nx; gy = ny;
          const tmp = curW; curW = curH; curH = tmp;
        }
        return { ...b, gx, gy };
      });
    }

    // ── 1. Compute world-space bbox, including territory radii ─────
    let minGX = Infinity, minGY = Infinity, maxGX = -Infinity, maxGY = -Infinity;
    for (const b of buildings) {
      const sz = BUILDING_SIZE[b.type] || 1;
      // Building footprint
      let cellMinX = b.gx, cellMinY = b.gy;
      let cellMaxX = b.gx + sz, cellMaxY = b.gy + sz;
      // Expand to include territory if relevant
      const tb = showTerritory ? territoryBox(b) : null;
      if (tb) {
        if (tb.tx < cellMinX) cellMinX = tb.tx;
        if (tb.ty < cellMinY) cellMinY = tb.ty;
        if (tb.tx + tb.t > cellMaxX) cellMaxX = tb.tx + tb.t;
        if (tb.ty + tb.t > cellMaxY) cellMaxY = tb.ty + tb.t;
      }
      if (cellMinX < minGX) minGX = cellMinX;
      if (cellMinY < minGY) minGY = cellMinY;
      if (cellMaxX > maxGX) maxGX = cellMaxX;
      if (cellMaxY > maxGY) maxGY = cellMaxY;
    }

    // ── 2. Compute iso-space bbox (project the 4 world-bbox corners) ──
    const corners = [
      projectIso(minGX, minGY),
      projectIso(maxGX, minGY),
      projectIso(maxGX, maxGY),
      projectIso(minGX, maxGY),
    ];
    let minIX = Infinity, minIY = Infinity, maxIX = -Infinity, maxIY = -Infinity;
    for (const c of corners) {
      if (c.ix < minIX) minIX = c.ix;
      if (c.ix > maxIX) maxIX = c.ix;
      if (c.iy < minIY) minIY = c.iy;
      if (c.iy > maxIY) maxIY = c.iy;
    }

    const isoW = maxIX - minIX;
    const isoH = maxIY - minIY;

    // Padding: reserve ~5% of size on each side
    const padding = sizePx * 0.05;
    const drawW = sizePx - padding * 2;
    const drawH = sizePx - padding * 2;
    const scale = Math.min(drawW / isoW, drawH / isoH);

    const offX = (sizePx - isoW * scale) / 2;
    const offY = (sizePx - isoH * scale) / 2;

    // World → SVG screen (y flipped because SVG y-down)
    function project(gx, gy) {
      const i = projectIso(gx, gy);
      return {
        x: (i.ix - minIX) * scale + offX,
        y: (maxIY - i.iy) * scale + offY,   // flip iy
      };
    }

    // Build a rhombus path for the (gx,gy)..(gx+w,gy+h) world rect
    function rhombusPath(gx, gy, w, h) {
      const tl = project(gx,     gy);
      const tr = project(gx + w, gy);
      const br = project(gx + w, gy + h);
      const bl = project(gx,     gy + h);
      // Round to 2 decimal places to keep SVG compact
      const r = (n) => Math.round(n * 100) / 100;
      return `M${r(tl.x)},${r(tl.y)} L${r(tr.x)},${r(tr.y)} L${r(br.x)},${r(br.y)} L${r(bl.x)},${r(bl.y)} Z`;
    }

    // ── 3. Build SVG layers ────────────────────────────────────────
    const parts = [];

    // 3a. Background (optional)
    if (!transparentBg) {
      parts.push(`<rect width="${sizePx}" height="${sizePx}" fill="${bgColor}"/>`);
    }

    // 3b. Territory shading — single unified opaque alliance color. Drawn HQ
    //     first (larger), then banners over. All same color = one merged
    //     region visually. Geometry matches core.js territoryBox exactly.
    if (showTerritory) {
      for (const b of buildings) {
        if (b.type !== 'hq') continue;
        const tb = territoryBox(b);
        const path = rhombusPath(tb.tx, tb.ty, tb.t, tb.t);
        parts.push(`<path d="${path}" fill="${COLORS.territoryFill}" stroke="none"/>`);
      }
      for (const b of buildings) {
        if (b.type !== 'banner') continue;
        const tb = territoryBox(b);
        const path = rhombusPath(tb.tx, tb.ty, tb.t, tb.t);
        parts.push(`<path d="${path}" fill="${COLORS.territoryFill}" stroke="none"/>`);
      }
    }

    // 3c. Buildings — order: city < hq < banner < beartrap (trap on top)
    const drawOrder = { city: 0, hq: 1, banner: 2, beartrap: 3 };
    const sorted = buildings.slice().sort((a, b) => (drawOrder[a.type] || 0) - (drawOrder[b.type] || 0));

    // Stroke width scales with cell size on the SVG, but cap so it doesn't
    // get hairy on tiny thumbnails or chunky on large ones.
    const cellPx = scale;                        // 1 world unit = this many SVG px (in iso direction)
    const strokeW = Math.max(0.3, Math.min(1.5, cellPx * 0.08));

    for (const b of sorted) {
      const sz = BUILDING_SIZE[b.type] || 1;
      const path = rhombusPath(b.gx, b.gy, sz, sz);
      let fill, stroke;
      switch (b.type) {
        case 'city':     fill = COLORS.city;     stroke = COLORS.cityStroke;     break;
        case 'hq':       fill = COLORS.hq;       stroke = COLORS.hqStroke;       break;
        case 'banner':   fill = COLORS.banner;   stroke = COLORS.bannerStroke;   break;
        case 'beartrap': fill = COLORS.beartrap; stroke = COLORS.beartrapStroke; break;
        default:         fill = '#888';          stroke = '#444';
      }
      parts.push(`<path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`);
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}">` +
      parts.join('') +
      '</svg>'
    );
  }

  // Export for both browser (window) and Node (module.exports)
  const api = { renderTemplateThumbnail, BUILDING_SIZE, TERRITORY_SIZE, territoryBox, COLORS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.KingshotTemplateThumbnail = api;
    root.renderTemplateThumbnail   = renderTemplateThumbnail;
  }
})(typeof self !== 'undefined' ? self : this);
