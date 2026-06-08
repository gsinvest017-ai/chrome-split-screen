'use strict';

// ── Parse URL params ──────────────────────────────────────────────────────────
const sp     = new URLSearchParams(location.search);
const LAYOUT = sp.get('l') || 'h2';

const URLS = [];
for (let i = 0; sp.has('u' + i); i++) URLS.push(sp.get('u' + i));

const PANE_COUNTS = { h2: 2, v2: 2, quad: 4, h3: 3, 'main-right': 2, 'main-bottom': 2 };
const paneCount = PANE_COUNTS[LAYOUT] || 2;
while (URLS.length < paneCount) URLS.push('');

// Labels (aliases) — persisted in URL params a0, a1, ...
const LABELS = [];
for (let i = 0; i < paneCount; i++) LABELS.push(sp.get('a' + i) || '');

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

// Update URL param without page reload (labels + URLs stored in address bar)
function updateUrlParam(key, value) {
  const p = new URLSearchParams(location.search);
  if (value) p.set(key, value); else p.delete(key);
  history.replaceState(null, '', '?' + p.toString());
}

// Build a URLSearchParams for layout navigation, preserving current URLs + labels
function buildLayoutParams(newLayout) {
  const curUrls   = [...document.querySelectorAll('.url-input')].map(i => i.value);
  const p = new URLSearchParams({ l: newLayout });
  curUrls.forEach((u, i) => p.set('u' + i, u));
  LABELS.forEach((a, i) => { if (a) p.set('a' + i, a); });
  return p;
}

// ── Build split grid ──────────────────────────────────────────────────────────
grid.className = LAYOUT;
applyCssVars();

// ── Label chip ────────────────────────────────────────────────────────────────
function makeLabelWrap(paneIdx) {
  const wrap = document.createElement('div');
  wrap.className = 'label-wrap';

  function render(val) {
    wrap.innerHTML = '';

    if (val) {
      // Chip mode: [label text ×]
      const chip = document.createElement('div');
      chip.className = 'label-chip';
      chip.title = 'Click to edit label';

      const txt = document.createElement('span');
      txt.className = 'label-text';
      txt.textContent = val;

      const del = document.createElement('button');
      del.className = 'label-del';
      del.title = 'Remove label';
      del.textContent = '×';
      del.addEventListener('click', e => {
        e.stopPropagation();
        LABELS[paneIdx] = '';
        updateUrlParam('a' + paneIdx, '');
        render('');
      });

      chip.append(txt, del);
      chip.addEventListener('click', () => activateEdit(val));
      wrap.appendChild(chip);

    } else {
      // Add button: faint [+]
      const add = document.createElement('button');
      add.className = 'label-add';
      add.title = 'Add label to this pane';
      add.textContent = '+';
      add.addEventListener('click', () => activateEdit(''));
      wrap.appendChild(add);
    }
  }

  function activateEdit(current) {
    wrap.innerHTML = '';

    const inp = document.createElement('input');
    inp.className   = 'label-edit';
    inp.type        = 'text';
    inp.value       = current;
    inp.placeholder = 'Label…';
    inp.maxLength   = 24;

    function commit() {
      const val = inp.value.trim();
      LABELS[paneIdx] = val;
      updateUrlParam('a' + paneIdx, val);
      render(val);
    }

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') { inp.value = current; inp.blur(); }
      e.stopPropagation(); // don't trigger split-page hotkeys while typing
    });

    inp.addEventListener('blur', commit);
    wrap.appendChild(inp);
    inp.focus();
    inp.select();
  }

  render(LABELS[paneIdx]);
  return wrap;
}

// ── Build pane ────────────────────────────────────────────────────────────────
function makePane(i) {
  const pane = document.createElement('div');
  pane.className = 'pane';
  pane.id = `pane-${i}`;

  // ── Pane address bar ──────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.className = 'pane-bar';

  // Label chip (left)
  const labelWrap = makeLabelWrap(i);

  // URL input (flex fill)
  const input = document.createElement('input');
  input.className   = 'url-input';
  input.id          = `url-${i}`;
  input.type        = 'text';
  input.spellcheck  = false;
  input.placeholder = 'Search or enter address';
  input.value       = URLS[i] || '';

  // Open in new tab (right)
  const newTabBtn = document.createElement('button');
  newTabBtn.className   = 'tb-btn sm';
  newTabBtn.title       = 'Open in new tab';
  newTabBtn.textContent = '↗';

  bar.append(labelWrap, input, newTabBtn);

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
    updateUrlParam('u' + i, u);
  });

  newTabBtn.addEventListener('click', () => {
    const u = normalizeUrl(input.value);
    if (u) chrome.tabs.create({ url: u });
  });

  iframe.addEventListener('load', () => {
    loading.classList.add('done');
    try {
      const href = iframe.contentWindow.location.href;
      if (href && href !== 'about:blank' && document.activeElement !== input) {
        input.value = href;
        updateUrlParam('u' + i, href);
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

// Layout picker: switch layout, preserve current URLs + labels
document.querySelectorAll('.lp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    location.search = buildLayoutParams(btn.dataset.layout).toString();
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
  // Don't fire when typing in a label-edit or url-input
  if (e.target.classList.contains('label-edit') ||
      e.target.classList.contains('url-input')) return;

  if (e.key === 'H') location.search = buildLayoutParams('h2').toString();
  if (e.key === 'V') location.search = buildLayoutParams('v2').toString();
  if (e.key === 'U') document.getElementById('btn-unsplit')?.click();
});
