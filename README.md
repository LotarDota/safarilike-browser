# SafariLike

A Safari-inspired desktop web browser for **Windows 11**, built with
[Electron](https://www.electronjs.org/) and Chromium. Brings Safari's
signature look — translucent frosted chrome, pill-shaped tabs, centered
combined address/search bar, Reader mode, and end-to-end encrypted
sync — to Windows.

> ⚠️ Heads up: this is a new project under active development, not a
> production-grade Safari clone. It leans on Chromium (via Electron) for
> rendering, so there is no WebKit parity.

## Highlights

- 🪟 **Native-feeling Windows 11 chrome** with Mica-style blur, rounded
  corners, and custom tab strip that uses the OS caption-button overlay.
- 🔎 **Unified smart address bar** — searches with DuckDuckGo / Google /
  Bing / Yandex / Ecosia, opens history + bookmark matches as you type.
- ⭐ **Favorites bar, bookmarks, history, downloads**, full context menus,
  find-in-page, keyboard shortcuts (`Ctrl+T/W/L/F/R`, `Ctrl+Shift+N` for
  Private Browsing, etc.).
- 📖 **Reader mode** (Mozilla Readability) — strips away clutter and
  renders articles in a typography-optimized view.
- 🕶 **Private windows** — fresh, non-persistent session partitions so
  nothing is written to history, cookies, or cache.
- 🧩 **Chrome extension support** via Electron's built-in unpacked
  extension loader (load any MV2/MV3 extension folder).
- ☁️ **iCloud-like end-to-end encrypted sync** of bookmarks and history
  to a self-hostable sync server (AES-256-GCM with a passphrase-derived
  key that never leaves your device; stored at rest via Windows DPAPI).
- ⚙️ **Settings panel** with General / Search / Appearance / Privacy /
  Extensions / Sync sections — switches styled after Safari's.

## Screenshots

Chrome-style toolbar, tabs row, and new-tab start page are all rendered
in the `renderer/` process. See `src/renderer/styles/chrome.css` for the
full theme token set (light, dark, and private-browsing variants).

## Getting started

```bash
# clone and install
git clone https://github.com/LotarDota/safarilike-browser.git
cd safarilike-browser
npm install

# run in dev (Vite + tsc --watch + Electron)
npm run dev

# build production bundles
npm run build

# package a Windows 11 installer (.exe) + portable build
#   Run this on Windows (GitHub Actions has a `package-windows` job
#   that produces artifacts automatically on every push to main).
npm run package:win
```

## Architecture

```
src/
├── main/              # Electron main process (Node)
│   ├── browser-manager.ts   # Tabs, windows, BrowserView layout
│   ├── ipc.ts               # IPC handlers
│   ├── settings-store.ts    # Preferences (electron-store)
│   ├── bookmarks-store.ts   # Bookmarks
│   ├── history-store.ts     # History
│   ├── download-manager.ts  # Downloads tracking
│   ├── extensions-manager.ts# Chrome extension loader
│   ├── sync-manager.ts      # Encrypted sync client
│   ├── protocol.ts          # `safarilike://` internal scheme
│   └── menu.ts              # Application menu
├── preload/           # Context-bridged IPC surfaces
├── renderer/          # React UI (chrome, new tab, settings, reader)
│   ├── chrome.tsx           # Main window chrome (tabs, toolbar, etc.)
│   ├── newtab.tsx           # Start page
│   ├── settings.tsx         # Settings panel
│   └── reader.tsx           # Reader mode
└── shared/            # Types + constants shared between processes
```

The main process owns real page rendering (each tab is a
`WebContentsView`), while the renderer draws only the chrome
(tabs, toolbar, favorites bar, find-in-page, suggestions). The chrome
sits above the tab view and resizes it on layout changes.

## Sync server

`scripts/sync-server.mjs` is a tiny self-hostable REST endpoint that
stores per-account ciphertext blobs. Passphrases are never sent over
the wire; the client encrypts locally with AES-256-GCM and a
scrypt-derived key. On Windows, the local copy of the key is protected
by DPAPI via Electron's `safeStorage`.

```bash
node scripts/sync-server.mjs              # localhost:8787
PORT=9090 DATA_DIR=./sync-data node scripts/sync-server.mjs
```

In Settings → iCloud-like Sync, set your server URL, email, passphrase,
and toggle `Enable sync`. Click **Sync Now** — do the same on another
device with the same email + passphrase to merge bookmarks/history.

## Keyboard shortcuts (subset)

| Shortcut                 | Action                       |
| ------------------------ | ---------------------------- |
| `Ctrl+T`                 | New tab                      |
| `Ctrl+W`                 | Close tab                    |
| `Ctrl+N` / `Ctrl+Shift+N`| New window / Private window  |
| `Ctrl+L`                 | Focus address bar            |
| `Ctrl+F`                 | Find in page                 |
| `Ctrl+R` / `Ctrl+Shift+R`| Reload / Hard reload         |
| `Alt+Left` / `Alt+Right` | Back / Forward               |
| `Ctrl+Shift+B`           | Toggle Favorites bar         |

## License

[MIT](./LICENSE)
