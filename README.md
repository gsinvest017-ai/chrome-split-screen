# TmuxTab — Split Screen Chrome Extension

類 tmux 的瀏覽器分割螢幕 extension。一個熱鍵把 Chrome 視窗分成多格；
每格是獨立的 OS 視窗，不受 `X-Frame-Options` 限制，所有網站都能用。

---

## 功能

| 功能 | 說明 |
|------|------|
| 熱鍵分割 | `Ctrl+Shift+H/V/4/U` 直接分割或恢復 |
| Popup UI | 點擊 toolbar 圖示，6 種 layout 一鍵套用 |
| 比例調整 | 2-pane session 可用 slider 或 preset 按鈕（30/40/50/60/70%）微調 |
| Session 管理 | 同一 session 的視窗統一管理；關一個自動從 session 移除 |
| 跨 SW 持久化 | 用 `chrome.storage.session` 存狀態，service worker 被暫停不影響 |

---

## 安裝

### 方法一：載入未封裝擴充功能（開發測試用）

1. **產生 icons**（只需執行一次）：
   ```powershell
   cd C:\Users\User\chrome-split-screen
   pwsh -File generate_icons.ps1
   ```

2. 開啟 Chrome → 網址列輸入 `chrome://extensions`

3. 右上角開啟 **「開發人員模式」**（Developer mode）

4. 點 **「載入未封裝擴充功能」**（Load unpacked）

5. 選擇 `C:\Users\User\chrome-split-screen` 資料夾

6. 完成！toolbar 出現 ⬜ 圖示

### 方法二：打包 .crx（內部發佈）

```
chrome://extensions → Pack extension → 選資料夾 → 產生 .crx
```

---

## 熱鍵

| 熱鍵 | 動作 |
|------|------|
| `Ctrl+Shift+H` | 左右分割（L \| R，各 50%） |
| `Ctrl+Shift+V` | 上下分割（T / B，各 50%） |
| `Ctrl+Shift+4` | 4 宮格（Quad） |
| `Ctrl+Shift+U` | 取消分割，當前視窗最大化 |

> 熱鍵衝突？到 `chrome://extensions/shortcuts` 自訂。

---

## Layout 一覽

```
h2          v2         quad        h3         main-right   main-bottom
┌──┬──┐    ┌────┐    ┌──┬──┐    ┌─┬─┬─┐    ┌───┬──┐     ┌──────┐
│  │  │    │    │    │  │  │    │ │ │ │    │   │  │     │      │
│  │  │    ├────┤    ├──┼──┤    │ │ │ │    │   │  │     ├──────┤
│  │  │    │    │    │  │  │    └─┴─┴─┘    └───┴──┘     │      │
└──┴──┘    └────┘    └──┴──┘                             └──────┘
 50/50      50/50     25x25      33/33/33    65/35        65/35
```

---

## 技術說明

- **Manifest V3**，`background.js` 為 service worker
- 分割使用 `chrome.windows.create` / `chrome.windows.update`（OS-level window）
- 螢幕尺寸取自 `chrome.system.display.getInfo()`（含工作列扣除）
- Session state 儲存於 `chrome.storage.session`（關閉瀏覽器後清除）
- 新視窗預設複製當前 tab 的 URL（`http://` / `https://`），其餘開 `chrome://newtab`

---

## 檔案結構

```
chrome-split-screen/
├── manifest.json       # MV3，commands 熱鍵定義
├── background.js       # 視窗分割引擎，session 管理
├── popup.html/css/js   # Popup UI
├── icons/              # 16/48/128 px PNG（generate_icons.ps1 產生）
├── generate_icons.ps1  # 用 System.Drawing 繪製 icon
└── docs/
    └── progress-chrome-split-screen.md
```
