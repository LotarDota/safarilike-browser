# SafariLike Browser — Test Plan (PR #1)

## What changed (user-visible)
Entire v0.1 of SafariLike, a Safari-inspired Electron/Chromium desktop browser:
- Safari-like chrome: top tab row + centered omnibox + toolbar
- Tabs, navigation (forward/back/reload), bookmarks (star), history, reader mode, private window, settings

## Scope
Run the packaged app and verify the single primary flow:
**Launch → open new tab → navigate to an HTTPS site → bookmark it → open reader mode → open a Private window with a distinct theme.**

If any of these fail, the "fixed" output-path commit is invalid and the PR should not merge.

## Pre-test setup (already complete; do NOT record)
- `npm run build` (exits 0, produces `dist/main/index.js`, `dist/preload/chrome.js`, `dist/renderer/*.html`)
- Maximize the Electron window so chrome is visible

## Test cases

### T1 — App launches (PROVES tsconfig/output-path fix)
- Action: `DISPLAY=:0 ./node_modules/.bin/electron . --no-sandbox`
- **Pass**: SafariLike window is visible with a tab labeled "New Tab", centered omnibox with placeholder "Search or enter website", reload/star/reader icons inside the omnibox, back/forward icons on the left.
- **Fail** if process exits with "Cannot find module .../dist/main/index.js" or omnibox/tab strip does not render.

### T2 — Navigate in omnibox (PROVES BrowserManager + IPC + WebContentsView layout)
- Action: click the omnibox, type `https://example.com`, press Enter.
- **Pass (all must hold)**:
  - The tab label becomes `Example Domain` (document.title of example.com).
  - Page body shows the heading "Example Domain" rendered by the embedded WebContentsView below the chrome.
  - Back button becomes enabled after navigating a second time to `https://example.org`.
- **Fail** if tab keeps saying "New Tab", page stays blank, or title does not update.

### T3 — Bookmark current page (PROVES bookmarks-store + IPC bookmarks:add)
- Action: with example.com active, click the star icon in the omnibox.
- **Pass**: star turns filled/highlighted; re-clicking removes bookmark (star unfills). `bookmarks.json` in userData contains an entry with URL `https://example.com/`.
- **Fail** if star never changes state or store file is never written.

### T4 — Reader mode (PROVES Readability pipeline + reader.tsx)
- Action: navigate active tab to `https://en.wikipedia.org/wiki/Web_browser` (long article). Click the reader icon in the omnibox (book icon).
- **Pass**: address bar shows a `safarilike://reader?url=…` URL, page content switches to simplified article view with a large title "Web browser" and plain-text body paragraphs (no Wikipedia sidebar, no ads, no navigation). Background is off-white (light theme).
- **Fail** if page is blank, raw HTML is visible, or the URL never changes to `safarilike://reader…`.

### T5 — Private window (PROVES session.fromPartition + private theme)
- Action: File menu → New Private Window (or Ctrl+Shift+N).
- **Pass**: a new window opens with visibly different chrome — purple/dark tint, "Private" pill visible in tab row. Navigating example.com in the private window does not add an entry to the main window's history (verify by opening `safarilike://settings` → Privacy tab in main window, or inspect `history.json` file — it should only contain main-window visits).
- **Fail** if new window looks identical to main window OR history.json contains the private visit.

## Scope-excluded (NOT testing this round, low-signal for this PR)
- Sync server round-trip (requires running `scripts/sync-server.mjs` + entering passphrase; covered in README docs)
- Extension loading (requires user-provided unpacked extension path)
- Downloads (no reliable CI-friendly download target)
- Windows NSIS installer (built by CI workflow, separate artifact)

## Adversarial check
Each assertion fails visibly if broken:
- T1 asserts a *specific* file path is produced by the tsc fix; it would have hard-crashed before this commit.
- T2/T3/T4 all depend on main↔preload↔renderer IPC chain; if `@shared/*` alias were still un-resolvable at runtime, all IPC calls would throw at app boot and none of these would even render past T1.
- T5 requires the private session partition flag; if absent, private window would share cookies/history with main.
