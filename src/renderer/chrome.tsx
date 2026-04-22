import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { BookmarkItem, TabState } from '@shared/types';
import { INTERNAL_SCHEME } from '@shared/constants';

// Ambient types for `window.clover` live in declarations.d.ts.

interface WindowState {
  id: number;
  activeTabId: number | null;
  isPrivate: boolean;
  tabs: TabState[];
}

const api = window.clover;

function normalizeToUrl(input: string, template: string): string {
  const trimmed = input.trim();
  if (!trimmed) return `${INTERNAL_SCHEME}://newtab`;
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith(`${INTERNAL_SCHEME}:`)) return trimmed;
  // naive detection: contains a dot and no spaces → probably a URL
  if (/^[^\s]+\.[^\s]+$/.test(trimmed) && !/\s/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return template.replace('{query}', encodeURIComponent(trimmed));
}

function formatTabTitle(tab: TabState): string {
  if (tab.title && tab.title.trim()) return tab.title;
  try {
    const u = new URL(tab.url);
    return u.hostname || tab.url;
  } catch {
    return tab.url || 'New Tab';
  }
}

const ICONS = {
  back: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M10 2 4 8l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  forward: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M6 2l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  reload: (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        d="M13 8a5 5 0 1 1-1.4-3.5M13 3v2.5H10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  stop: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  sidebar: (
    <svg viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 3v10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M8 10V2M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="9" width="10" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  tabs: (
    <svg viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 4V2h6v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="4" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="12" cy="8" r="1.2" fill="currentColor" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 16 16" fill="none">
      <rect x="4" y="7" width="8" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 7V5a2 2 0 1 1 4 0v2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2.5l1.7 3.6 3.8.5-2.8 2.7.7 3.9L8 11.4l-3.4 1.8.7-3.9L2.5 6.6l3.8-.5L8 2.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M3 3h5v10H4a1 1 0 0 1-1-1V3ZM13 3H8v10h4a1 1 0 0 0 1-1V3Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
};

interface Suggestion {
  kind: 'history' | 'bookmark' | 'search' | 'url';
  label: string;
  hint?: string;
  url: string;
}

const App: React.FC = () => {
  const [state, setState] = useState<WindowState | null>(null);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof api.settings.get>> | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [findQuery, setFindQuery] = useState('');
  const [findOpen, setFindOpen] = useState(false);

  const activeTab = useMemo<TabState | null>(() => {
    if (!state) return null;
    return state.tabs.find((t) => t.id === state.activeTabId) ?? null;
  }, [state]);

  // Initial data + subscribe
  useEffect(() => {
    let cancelled = false;
    void api.tabs.list().then((s) => {
      if (!cancelled && s) setState(s);
    });
    void api.settings.get().then((s) => {
      if (!cancelled) setSettings(s);
      if (!cancelled) {
        document.documentElement.dataset.private = String(s.sync.enabled); // no-op; real flag set below
      }
    });
    void api.bookmarks.list().then((b) => {
      if (!cancelled) setBookmarks(b);
    });
    const unsub = api.tabs.onStateChanged(setState);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Reflect private-mode flag on <html>
  useEffect(() => {
    if (!state) return;
    document.documentElement.dataset.private = state.isPrivate ? 'true' : 'false';
  }, [state?.isPrivate]);

  // Sync address bar with active tab
  useEffect(() => {
    if (!inputFocused && activeTab) {
      setInput(activeTab.url.startsWith(`${INTERNAL_SCHEME}://newtab`) ? '' : activeTab.url);
    }
  }, [activeTab?.url, inputFocused]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        document.getElementById('omnibox-input')?.focus();
      } else if (ctrl && e.key.toLowerCase() === 't') {
        e.preventDefault();
        void api.tabs.create(`${INTERNAL_SCHEME}://newtab`);
      } else if (ctrl && e.key.toLowerCase() === 'w' && activeTab) {
        e.preventDefault();
        void api.tabs.close(activeTab.id);
      } else if (ctrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setFindOpen(false);
        setInputFocused(false);
        (document.activeElement as HTMLElement | null)?.blur();
      } else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'b' && settings) {
        // Toggle favorites bar
        e.preventDefault();
        void api.settings.update({ showFavoritesBar: !settings.showFavoritesBar });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab?.id, settings?.showFavoritesBar]);

  // Suggestions
  const updateSuggestions = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSuggestions([]);
        return;
      }
      const [h, bks] = await Promise.all([
        api.history.search(q, 8),
        api.bookmarks.list(),
      ]);
      const bookmarkHits = bks
        .filter(
          (b) =>
            b.title.toLowerCase().includes(q.toLowerCase()) ||
            b.url.toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 4)
        .map<Suggestion>((b) => ({
          kind: 'bookmark',
          label: b.title || b.url,
          hint: b.url,
          url: b.url,
        }));
      const historyHits = h.slice(0, 6).map<Suggestion>((hi) => ({
        kind: 'history',
        label: hi.title || hi.url,
        hint: hi.url,
        url: hi.url,
      }));
      const engine = settings ? settings.searchEngines.find((e) => e.id === settings.defaultSearchEngineId) : null;
      const searchEntry: Suggestion | null = engine
        ? {
            kind: 'search',
            label: `Search ${engine.name} for "${q}"`,
            hint: engine.name,
            url: engine.template.replace('{query}', encodeURIComponent(q)),
          }
        : null;
      const urlEntry: Suggestion | null = /\./.test(q) && !/\s/.test(q)
        ? {
            kind: 'url',
            label: q,
            hint: 'Go to website',
            url: /^https?:\/\//.test(q) ? q : `https://${q}`,
          }
        : null;
      const combined: Suggestion[] = [];
      if (urlEntry) combined.push(urlEntry);
      if (searchEntry) combined.push(searchEntry);
      combined.push(...bookmarkHits, ...historyHits);
      setSuggestions(combined.slice(0, 12));
      setHighlight(0);
    },
    [settings]
  );

  useEffect(() => {
    if (!inputFocused) {
      setSuggestions([]);
      return;
    }
    const id = setTimeout(() => void updateSuggestions(input), 80);
    return () => clearTimeout(id);
  }, [input, inputFocused, updateSuggestions]);

  const go = useCallback(
    (raw: string) => {
      if (!activeTab || !settings) return;
      const engine = settings.searchEngines.find((e) => e.id === settings.defaultSearchEngineId);
      const url = normalizeToUrl(raw, engine?.template ?? 'https://duckduckgo.com/?q={query}');
      void api.tabs.navigate(activeTab.id, url);
      setInputFocused(false);
      setSuggestions([]);
    },
    [activeTab?.id, settings]
  );

  const onOmniKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = suggestions[highlight];
      go(picked ? picked.url : input);
    }
  };

  const bookmarkCurrent = async (): Promise<void> => {
    if (!activeTab) return;
    const existing = bookmarks.find((b) => b.url === activeTab.url);
    if (existing) {
      await api.bookmarks.remove(existing.id);
    } else {
      await api.bookmarks.add({ title: activeTab.title || activeTab.url, url: activeTab.url });
    }
    setBookmarks(await api.bookmarks.list());
  };

  const isBookmarked = activeTab ? bookmarks.some((b) => b.url === activeTab.url) : false;

  return (
    <div className="app">
      <div className="chrome">
        <div className="tab-row">
          {state?.tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab${tab.id === state.activeTabId ? ' active' : ''}${tab.isPrivate ? ' private' : ''}`}
              onClick={() => void api.tabs.activate(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) void api.tabs.close(tab.id);
              }}
              title={tab.title || tab.url}
            >
              <div className="favicon">{(formatTabTitle(tab)[0] ?? '?').toUpperCase()}</div>
              <span className="title">{formatTabTitle(tab)}</span>
              <button
                className="close"
                aria-label="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  void api.tabs.close(tab.id);
                }}
              >
                {ICONS.close}
              </button>
            </div>
          ))}
          <button
            className="add-tab no-drag"
            aria-label="New tab"
            onClick={() => void api.tabs.create(`${INTERNAL_SCHEME}://newtab`)}
          >
            {ICONS.plus}
          </button>
        </div>

        <div className="toolbar">
          <div className="nav-group">
            <button
              className="icon-btn"
              disabled={!activeTab?.canGoBack}
              onClick={() => activeTab && void api.tabs.goBack(activeTab.id)}
              aria-label="Back"
            >
              {ICONS.back}
            </button>
            <button
              className="icon-btn"
              disabled={!activeTab?.canGoForward}
              onClick={() => activeTab && void api.tabs.goForward(activeTab.id)}
              aria-label="Forward"
            >
              {ICONS.forward}
            </button>
            <button
              className="icon-btn"
              onClick={() => void api.window.newWindow()}
              aria-label="New window"
              title="New window"
            >
              {ICONS.sidebar}
            </button>
          </div>

          <div className="omnibox">
            <span className="lock" title="Secure connection">
              {activeTab?.url.startsWith('https://') ? ICONS.lock : null}
            </span>
            <input
              id="omnibox-input"
              value={input}
              placeholder="Search or enter website"
              onChange={(e) => setInput(e.target.value)}
              onFocus={(e) => {
                setInputFocused(true);
                e.currentTarget.select();
              }}
              onBlur={() => setTimeout(() => setInputFocused(false), 120)}
              onKeyDown={onOmniKeyDown}
              spellCheck={false}
            />
            <button
              className="reload"
              onClick={() =>
                activeTab &&
                (activeTab.isLoading ? void api.tabs.stop(activeTab.id) : void api.tabs.reload(activeTab.id))
              }
              aria-label={activeTab?.isLoading ? 'Stop' : 'Reload'}
            >
              {activeTab?.isLoading ? ICONS.stop : ICONS.reload}
            </button>
            <button
              className={`bookmark${isBookmarked ? ' active' : ''}`}
              onClick={() => void bookmarkCurrent()}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
              title={isBookmarked ? 'Bookmarked' : 'Add to bookmarks'}
              style={isBookmarked ? { color: 'var(--accent)' } : undefined}
            >
              {ICONS.star}
            </button>
            <button
              className="reader"
              onClick={() =>
                activeTab && void api.tabs.navigate(activeTab.id, `${INTERNAL_SCHEME}://reader?src=${encodeURIComponent(activeTab.url)}`)
              }
              aria-label="Reader"
              title="Reader"
            >
              {ICONS.book}
            </button>
          </div>

          <div className="actions-group">
            <button
              className="icon-btn"
              aria-label="Share"
              title="Share"
              onClick={() => {
                if (activeTab) void navigator.clipboard.writeText(activeTab.url);
              }}
            >
              {ICONS.share}
            </button>
            <button
              className="icon-btn"
              aria-label="Tabs overview"
              onClick={() => void api.tabs.create(`${INTERNAL_SCHEME}://newtab`)}
            >
              {ICONS.tabs}
            </button>
            <button
              className="icon-btn"
              aria-label="More"
              title="Settings"
              onClick={() =>
                activeTab && void api.tabs.navigate(activeTab.id, `${INTERNAL_SCHEME}://settings`)
              }
            >
              {ICONS.more}
            </button>
          </div>
        </div>

        {settings?.showFavoritesBar && bookmarks.length > 0 && (
          <div className="favbar">
            {bookmarks.slice(0, 20).map((b) => (
              <button
                key={b.id}
                className="fav"
                onClick={() => activeTab && void api.tabs.navigate(activeTab.id, b.url)}
                title={b.url}
              >
                <span className="favicon">{(b.title[0] ?? '?').toUpperCase()}</span>
                <span className="title">{b.title}</span>
              </button>
            ))}
          </div>
        )}

        {inputFocused && suggestions.length > 0 && (
          <div className="suggestions" role="listbox">
            {suggestions.map((s, i) => (
              <div
                key={`${s.kind}:${s.url}:${i}`}
                role="option"
                aria-selected={i === highlight}
                className={`suggestion${i === highlight ? ' highlight' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(s.url);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="kind" aria-hidden>
                  {s.kind === 'search' ? '🔎' : s.kind === 'bookmark' ? '★' : s.kind === 'url' ? '↗' : '⌚'}
                </span>
                <span className="label">{s.label}</span>
                {s.hint && <span className="hint">{s.hint}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="viewport">
        {findOpen && activeTab && (
          <div className="find-bar no-drag">
            <input
              autoFocus
              value={findQuery}
              placeholder="Find on page"
              onChange={(e) => {
                setFindQuery(e.target.value);
                void api.tabs.find(activeTab.id, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setFindOpen(false);
                if (e.key === 'Enter') void api.tabs.find(activeTab.id, findQuery);
              }}
            />
            <button
              className="icon-btn"
              aria-label="Close find"
              onClick={() => {
                setFindOpen(false);
                setFindQuery('');
                void api.tabs.find(activeTab.id, '');
              }}
            >
              {ICONS.close}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
