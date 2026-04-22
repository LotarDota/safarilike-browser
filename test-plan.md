# SafariLike Browser — Test Plan (PR #1, re-run after reader fix)

## What changed since last test run
- New `reader:fetch` IPC in `src/main/ipc.ts:165` runs `net.fetch` in the main process
- `src/preload/chrome.ts:93` exposes `window.safarilike.reader.fetch`
- `src/renderer/reader.tsx:13-16` uses it instead of renderer-side `fetch` (which silently failed from the `safarilike://` scheme)

## Scope
Re-verify the primary flow with special focus on Reader Mode:
**Launch → navigate to example.com → click Reader → assert article body renders.**
Plus quick regression pass on T1/T2/T3/T5 that already passed once.

## Test cases

### T1 — App launches (regression)
- Action: `DISPLAY=:0 ./node_modules/.bin/electron . --no-sandbox`
- **Pass**: window renders Safari chrome (tab pill + centered omnibox).

### T2 — Navigate in omnibox (regression)
- Action: type `https://example.com` in omnibox, Enter.
- **Pass**: tab title becomes "Example Domain"; body shows "Example Domain" heading.

### T3 — Bookmark (regression)
- Action: click star icon.
- **Pass**: star turns filled; `~/.config/safarilike-browser/bookmarks.json` contains `{url: "https://example.com/"}`.

### T4 — Reader mode (PRIMARY, fix verification)
- Action: while on example.com, click the reader icon (rightmost omnibox icon, ~x=855).
- **Pass (all three must hold)**:
  - Omnibox shows `safarilike://reader/?src=https%3A%2F%2Fexample.com%2F`.
  - Tab title becomes "Reader".
  - Article body renders with an `<h1>Example Domain</h1>` and a paragraph "This domain is for use in documentation examples…" in Readability's simplified typography.
- **Fail** if the article body is empty (this was the pre-fix behavior).

### T5 — Private window (regression)
- Action: Ctrl+Shift+N (in focused SafariLike window).
- **Pass**: new window with purple-tinted chrome; navigating there does not write to `history.json`.

## Adversarial check
T4's assertion cannot pass if the IPC/preload/net.fetch chain is broken — pre-fix gave a blank body despite the URL routing correctly. The old test (T4 before fix) already demonstrated this is a non-vacuous test.
