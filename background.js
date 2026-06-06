// TmuxTab — background service worker
// Manages split-window sessions; state persisted to chrome.storage.session
// so it survives service worker suspension within the same browser session.

// ── State ────────────────────────────────────────────────────────────────────
const sessions = new Map();       // windowId  -> sessionId
const sessionWindows = new Map(); // sessionId -> windowId[]
let sessionCounter = 0;

async function persistState() {
  await chrome.storage.session.set({
    sessions: [...sessions.entries()],
    sessionWindows: [...sessionWindows.entries()],
    sessionCounter,
  });
}

async function restoreState() {
  const data = await chrome.storage.session.get(['sessions', 'sessionWindows', 'sessionCounter']);
  if (data.sessions)       data.sessions.forEach(([k, v]) => sessions.set(k, v));
  if (data.sessionWindows) data.sessionWindows.forEach(([k, v]) => sessionWindows.set(k, v));
  if (data.sessionCounter) sessionCounter = data.sessionCounter;
}

restoreState();

// ── Layout presets ────────────────────────────────────────────────────────────
// Each pane: [fracX, fracY, fracW, fracH]  (fractions of work-area)
const LAYOUTS = {
  'h2':          [[0,    0,    0.5,  1   ], [0.5,  0,    0.5,  1   ]],
  'v2':          [[0,    0,    1,    0.5 ], [0,    0.5,  1,    0.5 ]],
  'quad':        [[0,    0,    0.5,  0.5 ], [0.5,  0,    0.5,  0.5 ],
                  [0,    0.5,  0.5,  0.5 ], [0.5,  0.5,  0.5,  0.5 ]],
  'h3':          [[0,    0,    0.333,1   ], [0.333,0,    0.334,1   ], [0.667,0,    0.333,1   ]],
  'main-right':  [[0,    0,    0.65, 1   ], [0.65, 0,    0.35, 1   ]],
  'main-bottom': [[0,    0,    1,    0.65], [0,    0.65, 1,    0.35]],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getScreenBounds() {
  try {
    const displays = await chrome.system.display.getInfo();
    const primary  = displays.find(d => d.isPrimary) || displays[0];
    if (primary?.workArea) return primary.workArea;
  } catch {}
  return { left: 0, top: 0, width: 1920, height: 1040 };
}

async function getFocusedWindow() {
  const wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
  return wins.find(w => w.focused) || wins[0] || null;
}

function safeUrl(url) {
  if (!url) return 'chrome://newtab';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url === 'chrome://newtab/' || url === 'chrome://newtab') return 'chrome://newtab';
  return 'chrome://newtab';
}

// ── Core: apply layout ────────────────────────────────────────────────────────
async function applyLayout(layoutName, focusedWindowId) {
  const panes = LAYOUTS[layoutName];
  if (!panes) return;

  const screen = await getScreenBounds();

  // Find or create session
  let sessionId = sessions.get(focusedWindowId);
  if (!sessionId) {
    sessionId = ++sessionCounter;
    sessions.set(focusedWindowId, sessionId);
    sessionWindows.set(sessionId, [focusedWindowId]);
  }

  const existing = [...(sessionWindows.get(sessionId) || [focusedWindowId])];

  // URL for new windows — clone the focused window's active tab
  let templateUrl = 'chrome://newtab';
  try {
    const tabs = await chrome.tabs.query({ windowId: focusedWindowId, active: true });
    templateUrl = safeUrl(tabs[0]?.url);
  } catch {}

  // Build pixel bounds for each pane
  const bounds = panes.map(([fx, fy, fw, fh]) => ({
    left:   Math.round(screen.left + fx * screen.width),
    top:    Math.round(screen.top  + fy * screen.height),
    width:  Math.round(fw * screen.width),
    height: Math.round(fh * screen.height),
  }));

  const newIds = [];

  for (let i = 0; i < panes.length; i++) {
    const b = bounds[i];
    if (i < existing.length) {
      await chrome.windows.update(existing[i], { ...b, state: 'normal' });
      newIds.push(existing[i]);
    } else {
      const w = await chrome.windows.create({ url: templateUrl, ...b, focused: false });
      sessions.set(w.id, sessionId);
      newIds.push(w.id);
    }
  }

  // Remove excess windows from smaller previous layout
  for (let i = panes.length; i < existing.length; i++) {
    sessions.delete(existing[i]);
    try { await chrome.windows.remove(existing[i]); } catch {}
  }

  sessionWindows.set(sessionId, newIds);

  // Re-focus the original window
  try { await chrome.windows.update(focusedWindowId, { focused: true }); } catch {}

  await persistState();
}

// ── Core: unsplit ─────────────────────────────────────────────────────────────
async function unsplit(windowId) {
  const sessionId = sessions.get(windowId);
  if (!sessionId) {
    await chrome.windows.update(windowId, { state: 'maximized' });
    return;
  }

  const wins = [...(sessionWindows.get(sessionId) || [])];

  await chrome.windows.update(windowId, { state: 'maximized' });

  for (const id of wins) {
    if (id === windowId) continue;
    sessions.delete(id);
    try { await chrome.windows.remove(id); } catch {}
  }

  sessions.delete(windowId);
  sessionWindows.delete(sessionId);
  await persistState();
}

// ── Core: adjust ratio for 2-pane sessions ────────────────────────────────────
async function adjustRatio(ratio, windowId) {
  const sessionId = sessions.get(windowId);
  if (!sessionId) return;

  const wins = sessionWindows.get(sessionId);
  if (!wins || wins.length !== 2) return;

  const screen = await getScreenBounds();
  const [w0info, w1info] = await Promise.all(wins.map(id => chrome.windows.get(id)));

  // Detect orientation: windows with similar top → horizontal (L|R)
  const isHorizontal = Math.abs(w0info.top - w1info.top) < 100;

  if (isHorizontal) {
    const splitX = Math.round(ratio * screen.width);
    await chrome.windows.update(wins[0], {
      left: screen.left, top: screen.top,
      width: splitX, height: screen.height, state: 'normal',
    });
    await chrome.windows.update(wins[1], {
      left: screen.left + splitX, top: screen.top,
      width: screen.width - splitX, height: screen.height, state: 'normal',
    });
  } else {
    const splitY = Math.round(ratio * screen.height);
    await chrome.windows.update(wins[0], {
      left: screen.left, top: screen.top,
      width: screen.width, height: splitY, state: 'normal',
    });
    await chrome.windows.update(wins[1], {
      left: screen.left, top: screen.top + splitY,
      width: screen.width, height: screen.height - splitY, state: 'normal',
    });
  }

  await persistState();
}

// ── Hotkeys ───────────────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  const win = await getFocusedWindow();
  if (!win) return;

  switch (command) {
    case 'split-h':    await applyLayout('h2',   win.id); break;
    case 'split-v':    await applyLayout('v2',   win.id); break;
    case 'split-quad': await applyLayout('quad', win.id); break;
    case 'unsplit':    await unsplit(win.id);             break;
  }
});

// ── Message API (used by popup) ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const win = await getFocusedWindow();

    switch (msg.type) {
      case 'APPLY_LAYOUT': {
        if (win) await applyLayout(msg.layout, win.id);
        sendResponse({ ok: true });
        break;
      }
      case 'UNSPLIT': {
        if (win) await unsplit(win.id);
        sendResponse({ ok: true });
        break;
      }
      case 'ADJUST_RATIO': {
        if (win) await adjustRatio(msg.ratio, win.id);
        sendResponse({ ok: true });
        break;
      }
      case 'GET_SESSION': {
        if (!win) { sendResponse({ sessionId: null, windowCount: 0, isHorizontal: true }); break; }
        const sessionId   = sessions.get(win.id) || null;
        const windowIds   = sessionId ? (sessionWindows.get(sessionId) || []) : [];
        let isHorizontal  = true;
        if (windowIds.length === 2) {
          try {
            const [a, b] = await Promise.all(windowIds.map(id => chrome.windows.get(id)));
            isHorizontal  = Math.abs(a.top - b.top) < 100;
          } catch {}
        }
        sendResponse({ sessionId, windowCount: windowIds.length, isHorizontal });
        break;
      }
      case 'GET_LAYOUTS': {
        sendResponse({ layouts: Object.keys(LAYOUTS) });
        break;
      }
    }
  })();
  return true; // keep async message channel open
});

// ── Cleanup on window close ───────────────────────────────────────────────────
chrome.windows.onRemoved.addListener(async (windowId) => {
  const sessionId = sessions.get(windowId);
  if (!sessionId) return;

  const wins    = sessionWindows.get(sessionId) || [];
  const updated = wins.filter(id => id !== windowId);

  if (updated.length === 0) {
    sessionWindows.delete(sessionId);
  } else {
    sessionWindows.set(sessionId, updated);
    // Update remaining windows' session map
    updated.forEach(id => sessions.set(id, sessionId));
  }

  sessions.delete(windowId);
  await persistState();
});
