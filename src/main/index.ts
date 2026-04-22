import { app, BrowserWindow, Menu, protocol, session, shell } from 'electron';
import path from 'node:path';
import { registerIpc } from './ipc';
import { BrowserManager } from './browser-manager';
import { SettingsStore } from './settings-store';
import { BookmarksStore } from './bookmarks-store';
import { HistoryStore } from './history-store';
import { DownloadManager } from './download-manager';
import { ExtensionsManager } from './extensions-manager';
import { SyncManager } from './sync-manager';
import { buildAppMenu } from './menu';
import { registerInternalProtocol } from './protocol';
import { INTERNAL_SCHEME } from '@shared/constants';

protocol.registerSchemesAsPrivileged([
  {
    scheme: INTERNAL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

async function bootstrap(): Promise<void> {
  await app.whenReady();

  // Preserve browsing data across runs via Electron's default `userData` path.
  const defaultSession = session.defaultSession;

  registerInternalProtocol(defaultSession);

  const settings = new SettingsStore();
  const bookmarks = new BookmarksStore();
  const history = new HistoryStore();
  const extensions = new ExtensionsManager(defaultSession);
  const sync = new SyncManager({ settings, bookmarks, history });
  const browser = new BrowserManager({ settings, bookmarks, history, extensions });
  const downloads = new DownloadManager(defaultSession);

  registerIpc({ browser, settings, bookmarks, history, downloads, extensions, sync });

  Menu.setApplicationMenu(buildAppMenu(browser));

  await extensions.loadInstalledExtensions();
  browser.createWindow({ private: false });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      browser.createWindow({ private: false });
    }
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      // Route window.open to a new tab instead of a popup.
      if (/^https?:/.test(url) || url.startsWith(`${INTERNAL_SCHEME}:`)) {
        browser.openUrlInNewTab(url);
        return { action: 'deny' };
      }
      shell.openExternal(url).catch(() => undefined);
      return { action: 'deny' };
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.setAppUserModelId('dev.lotardota.safarilike');

// Prevent second instance; focus the first window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const win = windows[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start SafariLike:', err);
    app.quit();
  });
}

// Keep TS happy about unused import.
void path;
