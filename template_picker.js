// ═══════════════════════════════════════════════════════════════════
// KINGSHOT MAPPER — TEMPLATE PICKER (Phase 5)
// ═══════════════════════════════════════════════════════════════════
// Modal that lists approved templates from the worker. Sort + filter,
// click to pick. Caller is responsible for what happens after selection
// (typically: prompt for alliance tag → activate stamp tool).
//
// Usage:
//   TemplatePicker.open({
//     workerUrl,
//     onPick:   (template) => {...},
//     onCancel: () => {...},
//   });
// ═══════════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  let _isOpen = false;
  let _state  = null;

  function open(opts) {
    if (_isOpen) return;
    opts = opts || {};
    _isOpen = true;
    _state = {
      workerUrl: (opts.workerUrl || '').replace(/\/$/, ''),
      onPick:   typeof opts.onPick   === 'function' ? opts.onPick   : () => {},
      onCancel: typeof opts.onCancel === 'function' ? opts.onCancel : () => {},
      templates: [],          // full list from /templates
      filters: {
        sort:   'most-popular',  // 'most-popular' | 'least-popular' | 'newest' | 'oldest'
        traps:  'all',           // 'all' | '1' | '2'
        cities: 'any',           // 'any' | '<30' | '31-50' | '51-70' | '71-100'
      },
      loading: true,
      error:   null,
    };
    _buildDOM();
    _fetchTemplates();
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

  function _onKeyDown(e) {
    if (!_isOpen) return;
    if (e.key === 'Escape') { _handleCancel(); e.preventDefault(); }
  }

  function _handleCancel() {
    const cb = _state.onCancel;
    close();
    cb();
  }

  function _buildDOM() {
    const root = document.createElement('div');
    root.id = 'tplPickerModal';
    root.innerHTML = _STYLE + _HTML;
    document.body.appendChild(root);

    const dom = {
      root,
      sortSel:  root.querySelector('#tplPkSort'),
      trapsSel: root.querySelector('#tplPkTraps'),
      citiesSel:root.querySelector('#tplPkCities'),
      grid:     root.querySelector('#tplPkGrid'),
      status:   root.querySelector('#tplPkStatus'),
      cancel:   root.querySelector('#tplPkCancel'),
    };
    _state.dom = dom;

    dom.sortSel.addEventListener('change',  () => { _state.filters.sort   = dom.sortSel.value;   _renderGrid(); });
    dom.trapsSel.addEventListener('change', () => { _state.filters.traps  = dom.trapsSel.value;  _renderGrid(); });
    dom.citiesSel.addEventListener('change',() => { _state.filters.cities = dom.citiesSel.value; _renderGrid(); });
    dom.cancel.addEventListener('click', _handleCancel);

    // Backdrop click cancels (but not clicks inside the dialog)
    root.addEventListener('click', e => { if (e.target === root) _handleCancel(); });

    document.addEventListener('keydown', _onKeyDown, true);
  }

  async function _fetchTemplates() {
    try {
      const resp = await fetch(_state.workerUrl + '/templates');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const body = await resp.json();
      _state.templates = (body && body.templates) || [];
      _state.loading = false;
      _renderGrid();
    } catch (e) {
      _state.loading = false;
      _state.error = e.message || 'Failed to load templates';
      _renderGrid();
    }
  }

  // ── Filter + sort ──────────────────────────────────────────────────

  function _filterAndSort(templates, f) {
    let out = templates.slice();
    if (f.traps !== 'all') {
      const want = parseInt(f.traps, 10);
      out = out.filter(t => (t.trapCount || 0) === want);
    }
    if (f.cities !== 'any') {
      out = out.filter(t => _matchesCityBucket(t.cityCount || 0, f.cities));
    }
    out.sort((a, b) => {
      switch (f.sort) {
        case 'most-popular':  return (b.useCount || 0) - (a.useCount || 0);
        case 'least-popular': return (a.useCount || 0) - (b.useCount || 0);
        case 'newest':        return (b.createdAt || 0) - (a.createdAt || 0);
        case 'oldest':        return (a.createdAt || 0) - (b.createdAt || 0);
        default: return 0;
      }
    });
    return out;
  }

  function _matchesCityBucket(n, bucket) {
    switch (bucket) {
      case '<30':    return n < 30;
      case '31-50':  return n >= 31 && n <= 50;
      case '51-70':  return n >= 51 && n <= 70;
      case '71-100': return n >= 71 && n <= 100;
      default: return true;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  function _renderGrid() {
    if (!_state.dom) return;
    const { grid, status } = _state.dom;

    if (_state.loading) {
      status.textContent = 'Loading templates…';
      grid.innerHTML = '';
      return;
    }
    if (_state.error) {
      status.textContent = '';
      grid.innerHTML = `<div class="tpl-pk-empty"><div class="tpl-pk-empty-title">Couldn't load templates</div><div class="tpl-pk-empty-sub">${_escape(_state.error)}</div></div>`;
      return;
    }

    const filtered = _filterAndSort(_state.templates, _state.filters);
    status.textContent = `${filtered.length} of ${_state.templates.length} template${_state.templates.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="tpl-pk-empty">
          <div class="tpl-pk-empty-title">No matches</div>
          <button class="tpl-pk-clear" id="_tplPkClear">Clear filters</button>
        </div>`;
      grid.querySelector('#_tplPkClear').addEventListener('click', () => {
        _state.filters = { sort: 'most-popular', traps: 'all', cities: 'any' };
        _state.dom.sortSel.value   = 'most-popular';
        _state.dom.trapsSel.value  = 'all';
        _state.dom.citiesSel.value = 'any';
        _renderGrid();
      });
      return;
    }

    grid.innerHTML = '';
    const renderer = (root.KingshotTemplateThumbnail && root.KingshotTemplateThumbnail.renderTemplateThumbnail)
                  || root.renderTemplateThumbnail;
    if (!renderer) {
      grid.innerHTML = '<div class="tpl-pk-empty"><div class="tpl-pk-empty-title">Thumbnail renderer missing</div><div class="tpl-pk-empty-sub">template_thumbnail.js not loaded</div></div>';
      return;
    }

    for (const t of filtered) {
      const card = document.createElement('div');
      card.className = 'tpl-pk-card';
      const summary = _buildSummary(t);
      card.innerHTML = `
        <div class="tpl-pk-thumb">${renderer(t, 240, { transparentBg: false, rotation: 1 })}</div>
        <div class="tpl-pk-name">${_escape(t.name || '')}</div>
        ${t.description ? `<div class="tpl-pk-desc">${_escape(t.description)}</div>` : ''}
        <div class="tpl-pk-meta">${summary}</div>
        <div class="tpl-pk-uses">Used ${t.useCount || 0} time${(t.useCount || 0) === 1 ? '' : 's'}</div>`;
      card.addEventListener('click', () => _handlePick(t));
      grid.appendChild(card);
    }
  }

  function _buildSummary(t) {
    const parts = [];
    if (t.trapCount)   parts.push(`${t.trapCount} trap${t.trapCount > 1 ? 's' : ''}`);
    if (t.hqCount)     parts.push(`${t.hqCount} HQ`);
    if (t.bannerCount) parts.push(`${t.bannerCount} banner${t.bannerCount > 1 ? 's' : ''}`);
    if (t.cityCount)   parts.push(`${t.cityCount} cit${t.cityCount > 1 ? 'ies' : 'y'}`);
    return parts.join(' · ');
  }

  function _handlePick(template) {
    const cb = _state.onPick;
    close();
    cb(template);
  }

  function _escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ── Style + HTML ───────────────────────────────────────────────────

  const _STYLE = `
<style>
#tplPickerModal {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(8,12,18,0.92); display: flex; align-items: stretch; justify-content: center;
  padding: 32px; font: 14px/1.4 -apple-system, Segoe UI, sans-serif; color: #e6edf3;
}
#tplPickerModal .tpl-pk-dialog {
  background: #161b22; border: 1px solid #30363d; border-radius: 10px;
  width: 100%; max-width: 1100px; display: flex; flex-direction: column;
  min-height: 0; max-height: 100%;
}
#tplPickerModal .tpl-pk-header {
  display: flex; gap: 14px; align-items: center; padding: 14px 18px;
  border-bottom: 1px solid #30363d;
}
#tplPickerModal .tpl-pk-title { font-weight: 600; color: #c9a84c; font-size: 16px; flex-shrink: 0; }
#tplPickerModal .tpl-pk-filters { display: flex; gap: 10px; align-items: center; flex: 1; flex-wrap: wrap; }
#tplPickerModal .tpl-pk-filters label { color: #8b949e; font-size: 12px; }
#tplPickerModal .tpl-pk-filters select {
  background: #0d1117; color: #e6edf3; border: 1px solid #30363d;
  border-radius: 4px; padding: 4px 8px; font: inherit;
}
#tplPickerModal .tpl-pk-cancel-btn {
  background: #21262d; color: #e6edf3; border: 1px solid #30363d;
  border-radius: 6px; padding: 6px 12px; cursor: pointer; font: inherit;
}
#tplPickerModal .tpl-pk-cancel-btn:hover { background: #30363d; }
#tplPickerModal .tpl-pk-status {
  padding: 8px 18px; color: #8b949e; font-size: 12px;
  border-bottom: 1px solid #21262d;
}
#tplPickerModal .tpl-pk-grid {
  padding: 18px; flex: 1; overflow-y: auto;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px; align-content: start;
}
#tplPickerModal .tpl-pk-card {
  background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
  padding: 12px; cursor: pointer; transition: border-color 0.15s, transform 0.1s;
  display: flex; flex-direction: column; gap: 6px;
}
#tplPickerModal .tpl-pk-card:hover {
  border-color: #c9a84c; transform: translateY(-1px);
}
#tplPickerModal .tpl-pk-thumb {
  background: #0a0d12; border-radius: 4px; width: 100%; height: 240px;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
#tplPickerModal .tpl-pk-thumb svg { width: 100%; height: 100%; display: block; }
#tplPickerModal .tpl-pk-name { font-weight: 600; font-size: 14px; }
#tplPickerModal .tpl-pk-desc { color: #8b949e; font-size: 12px; }
#tplPickerModal .tpl-pk-meta { color: #c9d1d9; font-size: 12px; font-family: monospace; }
#tplPickerModal .tpl-pk-uses { color: #8b949e; font-size: 11px; }
#tplPickerModal .tpl-pk-empty {
  grid-column: 1 / -1; padding: 60px 20px; text-align: center; color: #8b949e;
}
#tplPickerModal .tpl-pk-empty-title { color: #e6edf3; font-size: 16px; margin-bottom: 8px; }
#tplPickerModal .tpl-pk-empty-sub { font-size: 13px; margin-bottom: 16px; }
#tplPickerModal .tpl-pk-clear {
  background: #c9a84c; border: none; color: #0d1117; padding: 8px 16px;
  border-radius: 6px; cursor: pointer; font-weight: 600;
}
</style>`;

  const _HTML = `
<div class="tpl-pk-dialog">
  <div class="tpl-pk-header">
    <div class="tpl-pk-title">🐝 Use Hive Template</div>
    <div class="tpl-pk-filters">
      <label>Sort:
        <select id="tplPkSort">
          <option value="most-popular">Most popular</option>
          <option value="least-popular">Least popular</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </label>
      <label>Bear traps:
        <select id="tplPkTraps">
          <option value="all">All</option>
          <option value="1">1 trap</option>
          <option value="2">2 traps</option>
        </select>
      </label>
      <label>Cities:
        <select id="tplPkCities">
          <option value="any">Any</option>
          <option value="<30">&lt;30</option>
          <option value="31-50">31–50</option>
          <option value="51-70">51–70</option>
          <option value="71-100">71–100</option>
        </select>
      </label>
    </div>
    <button id="tplPkCancel" class="tpl-pk-cancel-btn">Cancel</button>
  </div>
  <div id="tplPkStatus" class="tpl-pk-status"></div>
  <div id="tplPkGrid" class="tpl-pk-grid"></div>
</div>`;

  // Export
  root.TemplatePicker = { open, close, _filterAndSort };
})(typeof self !== 'undefined' ? self : this);
