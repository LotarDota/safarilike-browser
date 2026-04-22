import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppSettings, ExtensionInfo, SyncSettings } from '@shared/types';

const api = window.safarilike;

type Tab = 'general' | 'search' | 'appearance' | 'privacy' | 'extensions' | 'sync';

const TABS: { key: Tab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'search', label: 'Search' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'extensions', label: 'Extensions' },
  { key: 'sync', label: 'iCloud-like Sync' },
];

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [tab, setTab] = useState<Tab>('general');
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.settings.get().then(setSettings);
    void api.extensions.list().then(setExtensions);
  }, []);

  if (!settings) return <div style={{ padding: 32 }}>Loading…</div>;

  const patch = async (p: Partial<AppSettings>): Promise<void> => {
    const next = await api.settings.update(p);
    setSettings(next);
  };

  const patchSync = async (p: Partial<SyncSettings> & { passphrase?: string }): Promise<void> => {
    await api.sync.configure(p);
    const fresh = await api.settings.get();
    setSettings(fresh);
  };

  const runSync = async (): Promise<void> => {
    setSyncBusy(true);
    setSyncMessage(null);
    try {
      const res = await api.sync.now();
      setSyncMessage(`Synced. Pushed ${res.pushed}, pulled ${res.pulled} items.`);
      const fresh = await api.settings.get();
      setSettings(fresh);
    } catch (err) {
      setSyncMessage(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncBusy(false);
    }
  };

  const engines = settings.searchEngines;

  return (
    <div className="settings">
      <aside className="sidebar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`pill${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </aside>
      <main className="content">
        {tab === 'general' && (
          <>
            <h2>General</h2>
            <div className="card">
              <div className="row">
                <label>Homepage</label>
                <input
                  type="url"
                  value={settings.homepage}
                  onChange={(e) => void patch({ homepage: e.target.value })}
                />
              </div>
              <div className="row">
                <label>New tabs open with</label>
                <select
                  value={settings.newTabPage}
                  onChange={(e) =>
                    void patch({ newTabPage: e.target.value as AppSettings['newTabPage'] })
                  }
                >
                  <option value="start">Start page</option>
                  <option value="homepage">Homepage</option>
                  <option value="blank">Blank page</option>
                </select>
              </div>
              <div className="row">
                <label>Show Favorites bar</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.showFavoritesBar}
                    onChange={(e) => void patch({ showFavoritesBar: e.target.checked })}
                  />
                </label>
              </div>
              <div className="row">
                <label>Ask before downloading</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.askBeforeDownloading}
                    onChange={(e) => void patch({ askBeforeDownloading: e.target.checked })}
                  />
                </label>
              </div>
            </div>
          </>
        )}

        {tab === 'search' && (
          <>
            <h2>Search</h2>
            <div className="card">
              <div className="row">
                <label>Default search engine</label>
                <select
                  value={settings.defaultSearchEngineId}
                  onChange={(e) => void patch({ defaultSearchEngineId: e.target.value })}
                >
                  {engines.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {tab === 'appearance' && (
          <>
            <h2>Appearance</h2>
            <div className="card">
              <div className="row">
                <label>Theme</label>
                <select
                  value={settings.theme}
                  onChange={(e) => void patch({ theme: e.target.value as AppSettings['theme'] })}
                >
                  <option value="system">Match system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="row">
                <label>Accent color</label>
                <input
                  type="text"
                  value={settings.accentColor}
                  onChange={(e) => void patch({ accentColor: e.target.value })}
                />
              </div>
              <div className="row">
                <label>Show tab preview on hover</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.showTabPreview}
                    onChange={(e) => void patch({ showTabPreview: e.target.checked })}
                  />
                </label>
              </div>
            </div>
          </>
        )}

        {tab === 'privacy' && (
          <>
            <h2>Privacy</h2>
            <div className="card">
              <div className="row">
                <label>Block pop-ups</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.blockPopups}
                    onChange={(e) => void patch({ blockPopups: e.target.checked })}
                  />
                </label>
              </div>
              <div className="row">
                <label>Prevent cross-site tracking</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.preventCrossSiteTracking}
                    onChange={(e) => void patch({ preventCrossSiteTracking: e.target.checked })}
                  />
                </label>
              </div>
              <div className="row">
                <label>Clear browsing history</label>
                <button
                  className="secondary"
                  onClick={async () => {
                    await api.history.clear();
                    setSyncMessage('History cleared.');
                  }}
                >
                  Clear History…
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'extensions' && (
          <>
            <h2>Extensions</h2>
            <div className="card">
              <div className="row">
                <label>Install unpacked</label>
                <div>
                  <button
                    className="primary"
                    onClick={async () => {
                      const installed = await api.extensions.install();
                      if (installed) setExtensions(await api.extensions.list());
                    }}
                  >
                    Load extension folder…
                  </button>
                  <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                    Select a folder containing a Chrome-compatible manifest.json (MV2/MV3).
                  </p>
                </div>
              </div>
            </div>
            <div className="extensions">
              {extensions.length === 0 && (
                <div style={{ color: 'var(--muted)' }}>No extensions installed.</div>
              )}
              {extensions.map((ext) => (
                <div key={ext.id} className="ext">
                  <div className="ico">{ext.name[0]?.toUpperCase() ?? 'E'}</div>
                  <div className="meta">
                    <h4>
                      {ext.name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{ext.version}</span>
                    </h4>
                    <p>{ext.description ?? ext.path}</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={ext.enabled}
                      onChange={async (e) => {
                        await api.extensions.setEnabled(ext.id, e.target.checked);
                        setExtensions(await api.extensions.list());
                      }}
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={async () => {
                      await api.extensions.uninstall(ext.id);
                      setExtensions(await api.extensions.list());
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'sync' && (
          <>
            <h2>iCloud-like Sync</h2>
            <div className="card">
              <div className="row">
                <label>Enable sync</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.sync.enabled}
                    onChange={(e) => void patchSync({ enabled: e.target.checked })}
                  />
                </label>
              </div>
              <div className="row">
                <label>Account email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={settings.sync.accountEmail ?? ''}
                  onChange={(e) => void patchSync({ accountEmail: e.target.value })}
                />
              </div>
              <div className="row">
                <label>Sync server</label>
                <input
                  type="url"
                  value={settings.sync.serverUrl}
                  onChange={(e) => void patchSync({ serverUrl: e.target.value })}
                />
              </div>
              <div className="row">
                <label>Device name</label>
                <input
                  type="text"
                  value={settings.sync.deviceName}
                  onChange={(e) => void patchSync({ deviceName: e.target.value })}
                />
              </div>
              <div className="row">
                <label>Passphrase (end-to-end)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    placeholder="Set or change…"
                    value={syncPassphrase}
                    onChange={(e) => setSyncPassphrase(e.target.value)}
                  />
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (!syncPassphrase) return;
                      await patchSync({ passphrase: syncPassphrase });
                      setSyncPassphrase('');
                      setSyncMessage('Passphrase saved locally.');
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="row">
                <label>Sync bookmarks</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.sync.syncBookmarks}
                    onChange={(e) => void patchSync({ syncBookmarks: e.target.checked })}
                  />
                </label>
              </div>
              <div className="row">
                <label>Sync history</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.sync.syncHistory}
                    onChange={(e) => void patchSync({ syncHistory: e.target.checked })}
                  />
                </label>
              </div>
              <div className="row">
                <label>Sync open tabs</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.sync.syncTabs}
                    onChange={(e) => void patchSync({ syncTabs: e.target.checked })}
                  />
                </label>
              </div>
              <div className="row">
                <label>Last sync</label>
                <div>
                  {settings.sync.lastSyncAt
                    ? new Date(settings.sync.lastSyncAt).toLocaleString()
                    : 'Never'}
                </div>
              </div>
              <div className="row">
                <label>Actions</label>
                <div>
                  <button className="primary" disabled={syncBusy} onClick={() => void runSync()}>
                    {syncBusy ? 'Syncing…' : 'Sync Now'}
                  </button>
                  {syncMessage && (
                    <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                      {syncMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

createRoot(document.getElementById('root') as HTMLElement).render(<Settings />);
