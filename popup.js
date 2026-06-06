// TmuxTab popup logic

// ── DOM refs ──────────────────────────────────────────────────────────────────
const sessionBadge  = document.getElementById('session-badge');
const ratioSection  = document.getElementById('ratio-section');
const ratioSlider   = document.getElementById('ratio-slider');
const ratioLabelA   = document.getElementById('ratio-a');
const ratioLabelB   = document.getElementById('ratio-b');

// ── Init: query session state ─────────────────────────────────────────────────
(async () => {
  try {
    const info = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    if (info.windowCount >= 2) {
      sessionBadge.classList.remove('hidden');
      if (info.windowCount === 2) {
        ratioSection.classList.remove('hidden');
      }
    }
  } catch {}
})();

// ── Layout buttons ────────────────────────────────────────────────────────────
document.querySelectorAll('.layout-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'APPLY_LAYOUT', layout: btn.dataset.layout });
    window.close();
  });
});

// ── Ratio slider ──────────────────────────────────────────────────────────────
function updateRatioLabels(val) {
  ratioLabelA.textContent = val;
  ratioLabelB.textContent = 100 - val;
}

ratioSlider.addEventListener('input', () => {
  updateRatioLabels(parseInt(ratioSlider.value, 10));
});

ratioSlider.addEventListener('change', async () => {
  const ratio = parseInt(ratioSlider.value, 10) / 100;
  await chrome.runtime.sendMessage({ type: 'ADJUST_RATIO', ratio });
});

// ── Ratio preset buttons ──────────────────────────────────────────────────────
document.querySelectorAll('.ratio-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const ratio = parseFloat(btn.dataset.ratio);
    const pct   = Math.round(ratio * 100);
    ratioSlider.value = pct;
    updateRatioLabels(pct);
    await chrome.runtime.sendMessage({ type: 'ADJUST_RATIO', ratio });
  });
});

// ── Unsplit ───────────────────────────────────────────────────────────────────
document.getElementById('unsplit-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'UNSPLIT' });
  window.close();
});

// ── Customize shortcuts link ──────────────────────────────────────────────────
document.getElementById('shortcut-link').addEventListener('click', e => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
});
