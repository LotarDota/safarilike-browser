import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { BookmarkItem, HistoryItem, AppSettings } from '@shared/types';
import { INTERNAL_SCHEME } from '@shared/constants';

const api = window.safarilike;

const NewTab: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void api.bookmarks.list().then(setBookmarks);
    void api.history.list(12).then(setHistory);
    void api.settings.get().then(setSettings);
  }, []);

  const engine = settings?.searchEngines.find((e) => e.id === settings.defaultSearchEngineId);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!query.trim() || !engine) return;
    const url = /\./.test(query) && !/\s/.test(query)
      ? /^https?:\/\//.test(query)
        ? query
        : `https://${query}`
      : engine.template.replace('{query}', encodeURIComponent(query));
    window.location.href = url;
  };

  const topFavs = bookmarks.slice(0, 12);

  return (
    <div className="newtab">
      <h1>Good to see you.</h1>
      <form className="searchbox" onSubmit={submit}>
        <span>🔎</span>
        <input
          autoFocus
          placeholder={`Search with ${engine?.name ?? 'the web'} or enter a URL`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
      </form>

      <div className="section-title">Favorites</div>
      <div className="favorites">
        {topFavs.length === 0 && (
          <div style={{ color: 'var(--muted)', gridColumn: '1 / -1' }}>
            Add bookmarks from the address bar to see them here.
          </div>
        )}
        {topFavs.map((b) => (
          <a key={b.id} className="favorite" href={b.url}>
            <div className="icon">{(b.title[0] ?? '?').toUpperCase()}</div>
            <div className="title">{b.title || b.url}</div>
          </a>
        ))}
      </div>

      <div className="section-title">Recently Visited</div>
      <div className="history-list">
        {history.length === 0 && (
          <div className="history-row" style={{ color: 'var(--muted)' }}>
            Browsing history will appear here.
          </div>
        )}
        {history.map((h) => (
          <a key={h.id} className="history-row" href={h.url}>
            <div className="title">{h.title || h.url}</div>
            <div className="url">{new URL(h.url).hostname}</div>
          </a>
        ))}
      </div>

      <div style={{ marginTop: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
        <a href={`${INTERNAL_SCHEME}://settings`} style={{ color: 'inherit' }}>
          Open Settings
        </a>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root') as HTMLElement).render(<NewTab />);
