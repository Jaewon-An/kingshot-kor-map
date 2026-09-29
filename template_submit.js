// ═══════════════════════════════════════════════════════════════════
// KINGSHOT MAPPER — TEMPLATE SUBMIT (Phase 4)
// ═══════════════════════════════════════════════════════════════════
// Pure submission logic. No DOM. Returns a structured result the UI can
// branch on. Tested in node with mocked fetch.
//
// Usage:
//   const result = await TemplateSubmit.submitTemplate(payload, {
//     workerUrl:      'https://...',     // required
//     adminKey:       'xxx' | null,      // if set → admin path (publishes immediately)
//     submitterMapId: 'abc' | null,      // required for user path; ignored for admin
//     fetchFn:        fetch,             // optional injection for tests
//   });
//
// Result shape:
//   { ok: true, id, status, isAdmin }
//   { ok: false, kind, error, status? }
// where `kind` ∈ {'name-taken','unauthorized','validation','server','network'}
// ═══════════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  /**
   * Convert a saved payload's relative-coord buildings back to absolute
   * 99×99 coords, suitable for re-loading into the editor on retry.
   */
  function payloadToAbsoluteBuildings(payload) {
    if (!payload || !Array.isArray(payload.buildings) || !payload.anchor) return [];
    // anchor.gx = 49 - bboxMinX  →  bboxMinX = 49 - anchor.gx
    const ox = 49 - payload.anchor.gx;
    const oy = 49 - payload.anchor.gy;
    return payload.buildings.map(b => ({
      type: b.type,
      gx: b.gx + ox,
      gy: b.gy + oy,
    }));
  }

  async function submitTemplate(payload, opts) {
    opts = opts || {};
    const workerUrl = (opts.workerUrl || '').replace(/\/$/, '');
    const fetchFn   = opts.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!workerUrl) return { ok: false, kind: 'validation', error: 'workerUrl이 없습니다' };
    if (!fetchFn)   return { ok: false, kind: 'validation', error: 'fetch를 사용할 수 없습니다' };
    if (!payload || !payload.name) return { ok: false, kind: 'validation', error: '템플릿 이름이 없습니다' };

    const adminKey = opts.adminKey || null;
    const isAdmin  = !!adminKey;

    let url, body, headers = { 'Content-Type': 'application/json' };

    if (isAdmin) {
      // Admin path: publish immediately as approved.
      url = workerUrl + '/admin/templates/save';
      headers['X-Admin-Key'] = adminKey;
      body = JSON.stringify(Object.assign({}, payload, { status: 'approved' }));
    } else {
      // User path: goes to pending queue. submitterMapId is optional —
      // include it if the user has published a map (so /templates/mine
      // continues to work for them), otherwise submit anonymously.
      const mapId = opts.submitterMapId || null;
      url = workerUrl + '/templates/submit';
      const userBody = Object.assign({}, payload);
      if (mapId) userBody.submitterMapId = mapId;
      body = JSON.stringify(userBody);
    }

    let resp, respBody;
    try {
      resp = await fetchFn(url, { method: 'POST', headers, body });
    } catch (e) {
      return { ok: false, kind: 'network', error: '네트워크 오류: ' + (e && e.message ? e.message : '알 수 없음') };
    }

    try { respBody = await resp.json(); } catch { respBody = {}; }

    if (resp.ok) {
      return {
        ok: true,
        id: respBody.id,
        status: respBody.status || (isAdmin ? 'approved' : 'pending'),
        isAdmin,
      };
    }
    if (resp.status === 401) return { ok: false, kind: 'unauthorized', error: respBody.error || '관리자 키가 올바르지 않습니다', status: 401 };
    if (resp.status === 409) return { ok: false, kind: 'name-taken',  error: respBody.error || '같은 이름의 템플릿이 이미 있습니다.', status: 409 };
    if (resp.status === 400) return { ok: false, kind: 'validation',  error: respBody.error || '올바르지 않은 템플릿입니다', status: 400 };
    return { ok: false, kind: 'server', error: respBody.error || ('HTTP ' + resp.status), status: resp.status };
  }

  // ── Export for both browser and Node ───────────────────────────────
  const api = { submitTemplate, payloadToAbsoluteBuildings };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.TemplateSubmit = api;
  }
})(typeof self !== 'undefined' ? self : this);
