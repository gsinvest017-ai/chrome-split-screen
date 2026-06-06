// TmuxTab popup

document.querySelectorAll('.layout-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'APPLY_LAYOUT', layout: btn.dataset.layout });
    window.close();
  });
});

document.getElementById('unsplit-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'UNSPLIT' });
  window.close();
});

document.getElementById('shortcut-link').addEventListener('click', e => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
});
