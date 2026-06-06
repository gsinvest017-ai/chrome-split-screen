# Chrome Split Screen Extension — Progress

## 目標
建立 Chrome extension，提供類 tmux/PowerShell 的分割螢幕功能：
熱鍵（Ctrl+Shift+H/V/4/U）+ Popup UI 按鈕，分割 OS 視窗為水平/垂直 pane，
支援 layout 切換（2欄、2列、4宮格、3欄、主欄+側欄）與比例微調。

## 計畫 Milestones

| # | 標題 | 預期產出 |
|---|------|----------|
| M1 | Scaffolding | manifest.json, generate_icons.ps1, icons/*.png, git init |
| M2 | Background core | background.js：window splitting engine, session 管理, chrome.commands |
| M3 | Popup UI | popup.html/css/js：layout picker, ratio slider, session status |
| M4 | README + 收尾 | README.md, 安裝說明, edge case 修補 |

## 進度日誌

<!-- 各 milestone 完成後追加 -->

## Fallback 指引

若需 rollback：
```
git log --oneline
git checkout <hash> -- <files>
```
Extension 在 chrome://extensions → 開啟「開發人員模式」→ 載入未封裝擴充功能 即可測試。
