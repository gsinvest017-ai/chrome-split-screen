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
  raw = raw.trim();
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

// ── Build toolbar URL bars ────────────────────────────────────────────────────
const urlBars = document.getElementById('url-bars');

for (let i = 0; i < paneCount; i++) {
  const wrap  = document.createElement('div');
  wrap.className = 'url-wrap';
  wrap.dataset.pane = i;

  const input = document.createElement('input');
  input.className  = 'url-input';
  input.id         = `url-${i}`;
  input.type       = 'text';
  input.spellcheck = false;
  input.placeholder = `Pane ${i + 1}`;
  input.value      = URLS[i] || '';

  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const url = normalizeUrl(input.value);
    input.value = url;
    const iframe = document.querySelector(`#pane-${i} iframe`);
    if (iframe) iframe.src = url;
  });

  // Focus pane on input focus (visual indicator only)
  input.addEventListener('focus', () => {
    document.querySelectorAll('.url-wrap').forEach(w => w.classList.remove('active'));
    wrap.classList.add('active');
  });

  const newTabBtn = document.createElement('button');
  newTabBtn.className = 'tb-btn sm';
  newTabBtn.title = 'Open in new tab';
  newTabBtn.textContent = '↗';
  newTabBtn.addEventListener('click', () => {
    const url = normalizeUrl(input.value);
    if (url) chrome.tabs.create({ url });
  });

  wrap.append(input, newTabBtn);
  urlBars.appendChild(wrap);
}

// ── Build split grid ──────────────────────────────────────────────────────────
grid.id = 'split-grid';
grid.className = `${LAYOUT}`;   // CSS targets #split-grid.h2 etc.

applyCssVars();

// --- Helpers to create elements ---

function makePane(i) {
  const pane = document.createElement('div');
  pane.className = 'pane';
  pane.id = `pane-${i}`;

  const loading = document.createElement('div');
  loading.className = 'pane-loading';
  loading.innerHTML = '<div class="spinner"></div><span>Loading…</span>';
  pane.appendChild(loading);

  const iframe = document.createElement('iframe');
  const url    = normalizeUrl(URLS[i]);

  if (url) {
    iframe.src = url;
  }

  iframe.setAttribute('allow', 'autoplay; fullscreen; clipboard-write; microphone; camera');
  iframe.setAttribute('allowfullscreen', '');

  // Hide loading overlay once iframe loads (best effort)
  iframe.addEventListener('load', () => {
    loading.classList.add('done');
    // Try updating URL bar (only works same-origin)
    try {
      const href = iframe.contentWindow.location.href;
      if (href && href !== 'about:blank') {
        const inp = document.getElementById(`url-${i}`);
        if (inp && document.activeElement !== inp) inp.value = href;
      }
    } catch {}
  });

  pane.appendChild(iframe);
  return pane;
}

function makeDrag(cls) {
  const el = document.createElement('div');
  el.className = cls;
  return el;
}

// --- Assemble based on layout ---
const frag = document.createDocumentFragment();

switch (LAYOUT) {
  case 'h2':
  case 'main-right':
    frag.append(makePane(0), makeDrag('drag-v'), makePane(1));
    break;

  case 'v2':
  case 'main-bottom':
    frag.append(makePane(0), makeDrag('drag-h'), makePane(1));
    break;

  case 'h3':
    frag.append(
      makePane(0), makeDrag('drag-v0'),
      makePane(1), makeDrag('drag-v1'),
      makePane(2),
    );
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

// ── Drag-to-resize logic ──────────────────────────────────────────────────────

function startDrag(e, onMove) {
  e.preventDefault();

  // Disable iframe pointer capture during drag
  document.querySelectorAll('.pane').forEach(p => p.style.pointerEvents = 'none');

  const up = () => {
    document.querySelectorAll('.pane').forEach(p => p.style.pointerEvents = '');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', up);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', up);
}

function getGridRect() {
  return grid.getBoundingClientRect();
}

// Vertical drag (adjusts --c0)
function attachVDrag(el) {
  el.addEventListener('mousedown', e => {
    startDrag(e, mv => {
      const r   = getGridRect();
      const pct = clamp(((mv.clientX - r.left) / r.width) * 100, 10, 90);
      state.c0  = pct;
      grid.style.setProperty('--c0', pct.toFixed(1) + '%');
    });
  });
}

// Horizontal drag (adjusts --r0)
function attachHDrag(el) {
  el.addEventListener('mousedown', e => {
    startDrag(e, mv => {
      const r   = getGridRect();
      const pct = clamp(((mv.clientY - r.top) / r.height) * 100, 10, 90);
      state.r0  = pct;
      grid.style.setProperty('--r0', pct.toFixed(1) + '%');
    });
  });
}

// Corner drag (adjusts both --c0 and --r0)
function attachCornerDrag(el) {
  el.addEventListener('mousedown', e => {
    startDrag(e, mv => {
      const r   = getGridRect();
      state.c0  = clamp(((mv.clientX - r.left) / r.width)  * 100, 10, 90);
      state.r0  = clamp(((mv.clientY - r.top)  / r.height) * 100, 10, 90);
      grid.style.setProperty('--c0', state.c0.toFixed(1) + '%');
      grid.style.setProperty('--r0', state.r0.toFixed(1) + '%');
    });
  });
}

// H3 first handle: splits c0 from (c0+c1) — preserves c0+c1 total
function attachH3V0Drag(el) {
  el.addEventListener('mousedown', e => {
    const total = state.c0 + state.c1;
    startDrag(e, mv => {
      const r      = getGridRect();
      const newC0  = clamp(((mv.clientX - r.left) / r.width) * 100, 5, total - 5);
      state.c1     = clamp(total - newC0, 5, 90);
      state.c0     = newC0;
      grid.style.setProperty('--c0', state.c0.toFixed(1) + '%');
      grid.style.setProperty('--c1', state.c1.toFixed(1) + '%');
    });
  });
}

// H3 second handle: adjusts c1 (c0 stays fixed)
function attachH3V1Drag(el) {
  el.addEventListener('mousedown', e => {
    startDrag(e, mv => {
      const r        = getGridRect();
      const totalPct = ((mv.clientX - r.left) / r.width) * 100;
      state.c1       = clamp(totalPct - state.c0, 5, 90 - state.c0);
      grid.style.setProperty('--c1', state.c1.toFixed(1) + '%');
    });
  });
}

// Attach drag handlers
grid.querySelectorAll('.drag-v, .drag-vt, .drag-vb')
    .forEach(el => attachVDrag(el));

grid.querySelectorAll('.drag-h, .drag-hl, .drag-hr')
    .forEach(el => attachHDrag(el));

const corner = grid.querySelector('.drag-corner');
if (corner) attachCornerDrag(corner);

const v0 = grid.querySelector('.drag-v0');
const v1 = grid.querySelector('.drag-v1');
if (v0) attachH3V0Drag(v0);
if (v1) attachH3V1Drag(v1);

// ── Toolbar actions ───────────────────────────────────────────────────────────

// Layout panel toggle
const layoutPanel = document.getElementById('layout-panel');
document.getElementById('btn-layout').addEventListener('click', e => {
  e.stopPropagation();
  layoutPanel.classList.toggle('hidden');
});

// Close layout panel when clicking outside
document.addEventListener('click', () => layoutPanel.classList.add('hidden'));
layoutPanel.addEventListener('click', e => e.stopPropagation());

// Layout picker: navigate to new layout, preserve current URLs
document.querySelectorAll('.lp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const newLayout = btn.dataset.layout;
    const currentUrls = [...document.querySelectorAll('.url-input')].map(i => i.value);
    const params = new URLSearchParams({ l: newLayout });
    currentUrls.forEach((u, i) => params.set('u' + i, u));
    location.search = params.toString();
  });
});

// Unsplit: restore pane 0 URL
document.getElementById('btn-unsplit').addEventListener('click', () => {
  const firstUrl = document.getElementById('url-0')?.value || URLS[0] || '';
  const target   = firstUrl || 'chrome://newtab';
  location.href  = target;
});

// ── Keyboard shortcut within split page ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!e.ctrlKey || !e.shiftKey) return;
  if (e.key === 'H') { location.search = new URLSearchParams({ l: 'h2', u0: URLS[0] || '', u1: URLS[1] || '' }).toString(); }
  if (e.key === 'V') { location.search = new URLSearchParams({ l: 'v2', u0: URLS[0] || '', u1: URLS[1] || '' }).toString(); }
  if (e.key === 'U') { document.getElementById('btn-unsplit')?.click(); }
});
