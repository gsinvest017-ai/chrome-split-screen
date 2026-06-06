'use strict';

// ── Parse URL params ──────────────────────────────────────────────────────────
const sp     = new URLSearchParams(location.search);
const LAYOUT = sp.get('l') || 'h2';

const URLS = [];
for (let i = 0; sp.has('u' + i); i++) URLS.push(sp.get('u' + i));

const PANE_COUNTS = { h2: 2, v2: 2, quad: 4, h3: 3, 'main-right': 2, 'main-bottom': 2 };
const paneCount = PANE_COUNTS[LAYOUT] || 2;
while (URLS.length < paneCount) URLS.push('');

// Default split ratios (percent)
const DEFAULTS = {
  'h2':          { c0: 50 },
  'v2':          { r0: 50 },
  'quad':        { c0: 50, r0: 50 },
  'h3':          { c0: 33, c1: 34 },
  'main-right':  { c0: 65 },
  'main-bottom': { r0: 65 },
};

const state = Object.assign({ c0: 50, c1: 34, r0: 50 }, DEFAULTS[LAYOUT] || {});

const grid = document.getElementById('split-grid');

// ── Helpers ───────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function normalizeUrl(raw) {
  raw = (raw || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://') ||
      raw.startsWith('chrome://') || raw.startsWith('chrome-extension://')) return raw;
  if (raw.includes('.') && !raw.includes(' ')) return 'https://' + raw;
  return 'https://www.google.com/search?q=' + encodeURIComponent(raw);
}

function applyCssVars() {
  grid.style.setProperty('--c0', state.c0.toFixed(1) + '%');
  grid.style.setProperty('--c1', state.c1.toFixed(1) + '%');
  grid.style.setProperty('--r0', state.r0.toFixed(1) + '%');
}

// ── Build split grid ──────────────────────────────────────────────────────────
grid.className = LAYOUT;
applyCssVars();

// Creates one pane: pane-bar (URL input) on top + iframe below
function makePane(i) {
  const pane = document.createElement('div');
  pane.className = 'pane';
  pane.id = `pane-${i}`;

  // ── Per-pane address bar ──────────────────────────────────────────
  const bar = document.createElement('div');
  bar.className = 'pane-bar';

  const input = document.createElement('input');
  input.className   = 'url-input';
  input.id          = `url-${i}`;
  input.type        = 'text';
  input.spellcheck  = false;
  input.placeholder = 'Search or enter address';
  input.value       = URLS[i] || '';

  const newTabBtn = document.createElement('button');
  newTabBtn.className = 'tb-btn sm';
  newTabBtn.title     = 'Open in new tab';
  newTabBtn.textContent = '↗';

  bar.append(input, newTabBtn);

  // ── Iframe + loading overlay ──────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'pane-content';

  const loading = document.createElement('div');
  loading.className = 'pane-loading';
  loading.innerHTML = '<div class="spinner"></div><span>Loading…</span>';

  const iframe = document.createElement('iframe');
  const url    = normalizeUrl(URLS[i]);
  if (url) iframe.src = url;
  iframe.setAttribute('allow', 'autoplay; fullscreen; clipboard-write; microphone; camera');
  iframe.setAttribute('allowfullscreen', '');

  content.append(loading, iframe);

  // ── Event handlers ────────────────────────────────────────────────
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const u = normalizeUrl(input.value);
    input.value = u;
    iframe.src  = u;
  });

  newTabBtn.addEventListener('click', () => {
    const u = normalizeUrl(input.value);
    if (u) chrome.tabs.create({ url: u });
  });

  iframe.addEventListener('load', () => {
    loading.classList.add('done');
    // Update URL bar if same-origin (silently skip cross-origin)
    try {
      const href = iframe.contentWindow.location.href;
      if (href && href !== 'about:blank' && document.activeElement !== input) {
        input.value = href;
      }
    } catch {}
  });

  pane.append(bar, content);
  return pane;
}

function makeDrag(cls) {
  const el = document.createElement('div');
  el.className = cls;
  return el;
}

// Assemble grid
const frag = document.createDocumentFragment();

switch (LAYOUT) {
  case 'h2': case 'main-right':
    frag.append(makePane(0), makeDrag('drag-v'), makePane(1));
    break;
  case 'v2': case 'main-bottom':
    frag.append(makePane(0), makeDrag('drag-h'), makePane(1));
    break;
  case 'h3':
    frag.append(makePane(0), makeDrag('drag-v0'), makePane(1), makeDrag('drag-v1'), makePane(2));
    break;
  case 'quad':
    frag.append(
      makePane(0), makeDrag('drag-vt'), makePane(1),
      makeDrag('drag-hl'), makeDrag('drag-corner'), makeDrag('drag-hr'),
      makePane(2), makeDrag('drag-vb'), makePane(3),
    );
    break;
}

grid.appendChild(frag);

// ── Drag-to-resize ────────────────────────────────────────────────────────────
function startDrag(e, onMove) {
  e.preventDefault();
  document.querySelectorAll('.pane').forEach(p => p.style.pointerEvents = 'none');

  const up = () => {
    document.querySelectorAll('.pane').forEach(p => p.style.pointerEvents = '');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', up);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', up);
}

const gr = () => grid.getBoundingClientRect();

function attachVDrag(el) {
  el.addEventListener('mousedown', e => {
    startDrag(e, mv => {
      const r  = gr();
      state.c0 = clamp(((mv.clientX - r.left) / r.width) * 100, 10, 90);
      grid.style.setProperty('--c0', state.c0.toFixed(1) + '%');
    });
  });
}

function attachHDrag(el) {
  el.addEventListener('mousedown', e => {
    startDrag(e, mv => {
      const r  = gr();
      state.r0 = clamp(((mv.clientY - r.top) / r.height) * 100, 10, 90);
      grid.style.setProperty('--r0', state.r0.toFixed(1) + '%');
    });
  });
}

function attachCornerDrag(el) {
  el.addEventListener('mousedown', e => {
    startDrag(e, mv => {
      const r  = gr();
      state.c0 = clamp(((mv.clientX - r.left) / r.width)  * 100, 10, 90);
      state.r0 = clamp(((mv.clientY - r.top)  / r.height) * 100, 10, 90);
      grid.style.setProperty('--c0', state.c0.toFixed(1) + '%');
      grid.style.setProperty('--r0', state.r0.toFixed(1) + '%');
    });
  });
}

function attachH3V0Drag(el) {
  el.addEventListener('mousedown', e => {
    const total = state.c0 + state.c1;
    startDrag(e, mv => {
      const r     = gr();
      const newC0 = clamp(((mv.clientX - r.left) / r.width) * 100, 5, total - 5);
      state.c1    = clamp(total - newC0, 5, 90);
      state.c0    = newC0;
      grid.style.setProperty('--c0', state.c0.toFixed(1) + '%');
      grid.style.setProperty('--c1', state.c1.toFixed(1) + '%');
    });
  });
}

function attachH3V1Drag(el) {
  el.addEventListener('mousedown', e => {
    startDrag(e, mv => {
      const r    = gr();
      state.c1   = clamp(((mv.clientX - r.left) / r.width) * 100 - state.c0, 5, 90 - state.c0);
      grid.style.setProperty('--c1', state.c1.toFixed(1) + '%');
    });
  });
}

grid.querySelectorAll('.drag-v, .drag-vt, .drag-vb').forEach(el => attachVDrag(el));
grid.querySelectorAll('.drag-h, .drag-hl, .drag-hr').forEach(el => attachHDrag(el));

const corner = grid.querySelector('.drag-corner');
const v0     = grid.querySelector('.drag-v0');
const v1     = grid.querySelector('.drag-v1');
if (corner) attachCornerDrag(corner);
if (v0)     attachH3V0Drag(v0);
if (v1)     attachH3V1Drag(v1);

// ── Toolbar actions ───────────────────────────────────────────────────────────
const layoutPanel = document.getElementById('layout-panel');

document.getElementById('btn-layout').addEventListener('click', e => {
  e.stopPropagation();
  layoutPanel.classList.toggle('hidden');
});

document.addEventListener('click', () => layoutPanel.classList.add('hidden'));
layoutPanel.addEventListener('click', e => e.stopPropagation());

// Layout picker: switch layout, preserve current pane URLs
document.querySelectorAll('.lp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const newLayout = btn.dataset.layout;
    const cur = [...document.querySelectorAll('.url-input')].map(inp => inp.value);
    const p   = new URLSearchParams({ l: newLayout });
    cur.forEach((u, i) => p.set('u' + i, u));
    location.search = p.toString();
  });
});

// Unsplit: restore first pane URL
document.getElementById('btn-unsplit').addEventListener('click', () => {
  const first = document.getElementById('url-0')?.value || URLS[0] || '';
  location.href = normalizeUrl(first) || 'chrome://newtab';
});

// ── In-page hotkeys ───────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!e.ctrlKey || !e.shiftKey) return;
  const cur = [...document.querySelectorAll('.url-input')].map(i => i.value);
  const p   = (l) => { const q = new URLSearchParams({ l }); cur.forEach((u, i) => q.set('u' + i, u)); return q.toString(); };
  if (e.key === 'H') location.search = p('h2');
  if (e.key === 'V') location.search = p('v2');
  if (e.key === 'U') document.getElementById('btn-unsplit')?.click();
});
