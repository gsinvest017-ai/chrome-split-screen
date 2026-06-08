// TmuxTab v2 — background service worker (single-tab iframe approach)
// No window management needed; just navigate the active tab to split.html.

const SPLIT_ORIGIN = `chrome-extension://${chrome.runtime.id}`;
const SPLIT_PAGE   = `${SPLIT_ORIGIN}/split.html`;

const PANE_COUNTS = {
  h2: 2, v2: 2, quad: 4, h3: 3, 'main-right': 2, 'main-bottom': 2,
};

function buildSplitUrl(layout, urls, labels) {
  const p = new URLSearchParams({ l: layout });
  urls.forEach((u, i) => p.set('u' + i, u || ''));
  if (labels) labels.forEach((a, i) => { if (a) p.set('a' + i, a); });
  return `${SPLIT_PAGE}?${p}`;
}

function safeUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith(SPLIT_ORIGIN)) return url;
  return '';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function applyLayout(layout, tab) {
  const count = PANE_COUNTS[layout] || 2;

  // If already on a split page, reuse existing pane URLs + labels
  let existingUrls   = [];
  let existingLabels = [];
  if (tab.url.startsWith(SPLIT_PAGE)) {
    const sp = new URLSearchParams(new URL(tab.url).search);
    for (let i = 0; sp.has('u' + i); i++) existingUrls.push(sp.get('u' + i));
    for (let i = 0; i < existingUrls.length; i++) existingLabels.push(sp.get('a' + i) || '');
  }

  const urls   = [];
  const labels = [];
  for (let i = 0; i < count; i++) {
    if (i < existingUrls.length) {
      urls.push(existingUrls[i]);
    } else if (i === 0 && existingUrls.length === 0) {
      urls.push(safeUrl(tab.url));
    } else {
      urls.push('');
    }
    labels.push(existingLabels[i] || '');
  }

  await chrome.tabs.update(tab.id, { url: buildSplitUrl(layout, urls, labels) });
}

async function unsplit(tab) {
  if (!tab.url.startsWith(SPLIT_PAGE)) return;
  const sp  = new URLSearchParams(new URL(tab.url).search);
  const url = sp.get('u0') || '';
  await chrome.tabs.update(tab.id, { url: safeUrl(url) || 'chrome://newtab' });
}

// ── Hotkeys ───────────────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  const tab = await getActiveTab();
  if (!tab) return;

  const map = { 'split-h': 'h2', 'split-v': 'v2', 'split-quad': 'quad' };
  if (command === 'unsplit') {
    await unsplit(tab);
  } else if (map[command]) {
    await applyLayout(map[command], tab);
  }
});

// ── Message API (popup → background) ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const tab = await getActiveTab();
    if (!tab) { sendResponse({ ok: false }); return; }

    if (msg.type === 'APPLY_LAYOUT') {
      await applyLayout(msg.layout, tab);
      sendResponse({ ok: true });
    } else if (msg.type === 'UNSPLIT') {
      await unsplit(tab);
      sendResponse({ ok: true });
    }
  })();
  return true;
});
