// KSMapper performance instrumentation.
// Off by default. Enable via ?perf=1 or localStorage.setItem('ksm-perf','1').
// When disabled, mark() and measure() are no-op stubs to keep instrumented
// call sites cheap (one indirect call ~10ns).

(function () {
  'use strict';

  const RING_SIZE = 60;
  const SLOW_FRAME_MS = 16;

  // URL param ?perf=1 also sticks via localStorage so a refresh keeps the HUD.
  let enabled = false;
  try {
    const url = new URL(location.href);
    if (url.searchParams.get('perf') === '1') {
      localStorage.setItem('ksm-perf', '1');
      enabled = true;
    } else if (url.searchParams.get('perf') === '0') {
      localStorage.removeItem('ksm-perf');
      enabled = false;
    } else {
      enabled = localStorage.getItem('ksm-perf') === '1';
    }
  } catch (_) { /* private mode etc. */ }

  // marks: label -> startTime (most-recent only; instrumentation pairs mark+measure)
  const marks = new Map();
  // samples: label -> ring buffer of durations (ms)
  const samples = new Map();
  // counters: label -> integer
  const counters = new Map();
  // last single value (for non-windowed readouts like bldgs count)
  const gauges = new Map();

  function _push(label, value) {
    let r = samples.get(label);
    if (!r) { r = { buf: new Float32Array(RING_SIZE), n: 0, head: 0 }; samples.set(label, r); }
    r.buf[r.head] = value;
    r.head = (r.head + 1) % RING_SIZE;
    if (r.n < RING_SIZE) r.n++;
  }

  function _stats(label) {
    const r = samples.get(label);
    if (!r || r.n === 0) return null;
    const arr = new Array(r.n);
    for (let i = 0; i < r.n; i++) arr[i] = r.buf[i];
    arr.sort((a, b) => a - b);
    const p = (q) => arr[Math.min(arr.length - 1, Math.floor(arr.length * q))];
    return { n: r.n, p50: p(0.5), p95: p(0.95), max: arr[arr.length - 1] };
  }

  function mark(label) {
    if (!enabled) return;
    marks.set(label, performance.now());
  }

  function measure(label, startLabel) {
    if (!enabled) return 0;
    const s = marks.get(startLabel || label);
    if (s == null) return 0;
    const dt = performance.now() - s;
    _push(label, dt);
    return dt;
  }

  function count(label, n) {
    if (!enabled) return;
    counters.set(label, (counters.get(label) || 0) + (n == null ? 1 : n));
  }

  function gauge(label, value) {
    if (!enabled) return;
    gauges.set(label, value);
  }

  function snapshot() {
    const out = { enabled, labels: {}, counters: {}, gauges: {} };
    for (const label of samples.keys()) out.labels[label] = _stats(label);
    for (const [k, v] of counters) out.counters[k] = v;
    for (const [k, v] of gauges) out.gauges[k] = v;
    return out;
  }

  function dump() {
    const snap = snapshot();
    const rows = [];
    for (const [k, s] of Object.entries(snap.labels)) {
      rows.push({ label: k, n: s.n, p50: +s.p50.toFixed(2), p95: +s.p95.toFixed(2), max: +s.max.toFixed(2) });
    }
    // eslint-disable-next-line no-console
    console.table(rows);
    if (Object.keys(snap.counters).length) console.table(snap.counters);
    if (Object.keys(snap.gauges).length)   console.table(snap.gauges);
    return snap;
  }

  function setEnabled(on) {
    enabled = !!on;
    try {
      if (enabled) localStorage.setItem('ksm-perf', '1');
      else         localStorage.removeItem('ksm-perf');
    } catch (_) {}
    _refreshHud();
  }

  // ── HUD ─────────────────────────────────────────────────
  // A pill in .map-overlay-bar. Created lazily after DOM is ready.
  let hudEl = null;
  let hudInner = null;
  let hudDirty = false;

  function _ensureHud() {
    if (hudEl || !enabled) return;
    if (typeof document === 'undefined') return;
    const bar = document.querySelector('.map-overlay-bar');
    if (!bar) return;
    hudEl = document.createElement('div');
    hudEl.className = 'map-overlay-pill perf-pill';
    hudEl.id = 'perfDisplay';
    hudEl.title = 'KSMapper perf — toggle with ?perf=0 in URL, or __perf.setEnabled(false)';
    hudInner = document.createElement('span');
    hudEl.appendChild(hudInner);
    bar.appendChild(hudEl);
  }

  function _refreshHud() {
    if (!enabled) {
      if (hudEl) hudEl.style.display = 'none';
      return;
    }
    _ensureHud();
    if (!hudEl || !hudInner) return;
    hudEl.style.display = '';
    const draw = _stats('draw');
    const bfs  = _stats('bfs');
    const hooks = _stats('hooks');
    const bldgs = gauges.get('bldgs');
    const fmt = (s) => s ? `${s.p50.toFixed(1)}/${s.p95.toFixed(1)}/${s.max.toFixed(1)}` : '—';
    const drawTxt = draw ? fmt(draw) : '—';
    const slow = draw && draw.p95 > SLOW_FRAME_MS ? ' ⚠' : '';
    hudInner.textContent =
      `draw ${drawTxt}ms${slow}` +
      `  ·  bfs ${bfs ? bfs.p95.toFixed(1) : '—'}` +
      `  ·  hooks ${hooks ? hooks.p95.toFixed(1) : '—'}` +
      `  ·  bldgs ${bldgs == null ? '—' : bldgs}`;
  }

  // Called once per draw() — but cheap, and only does DOM work at most every
  // ~250ms to avoid the HUD itself becoming a hotspot.
  let _lastHudWrite = 0;
  function tick() {
    if (!enabled) return;
    const now = performance.now();
    if (now - _lastHudWrite < 250) return;
    _lastHudWrite = now;
    _refreshHud();
  }

  window.__perf = {
    get enabled() { return enabled; },
    setEnabled,
    mark, measure, count, gauge,
    snapshot, dump, tick,
    lastTrace: null,    // last X-Trace-Id seen on any fetch response
  };

  // One-time fetch wrapper: capture X-Trace-Id from any Worker response so a
  // user filing a bug can run `__perf.lastTrace` in the console.
  // Cost per call: one header lookup (negligible). Always installed so the
  // trace is available even when the HUD is hidden.
  if (typeof window.fetch === 'function' && !window.__perf._fetchWrapped) {
    const _origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      return _origFetch(input, init).then((resp) => {
        try {
          const t = resp.headers && resp.headers.get && resp.headers.get('X-Trace-Id');
          if (t) window.__perf.lastTrace = t;
        } catch (_) {}
        return resp;
      });
    };
    window.__perf._fetchWrapped = true;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _refreshHud, { once: true });
    } else {
      _refreshHud();
    }
  }
})();
