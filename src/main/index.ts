import { app, BrowserWindow, Menu, dialog, protocol, session, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
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
import { INTERNAL_SCHEME } from '../shared/constants';

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

  // Enable "Add to Chrome" flow on chromewebstore.google.com — intercepts the
  // inline-install click, pulls the .crx through the public update2 endpoint,
  // unpacks it, and registers the extension with the session.
  //
  // Loaded lazily so a bug or missing file in the web-store module can't
  // prevent the browser window from opening.
  void (async () => {
    try {
      const mod = await import('electron-chrome-web-store');
      await mod.installChromeWebStore({ session: defaultSession });
    } catch (err) {
      logStartupWarning('Chrome Web Store bridge failed to initialize', err);
    }
  })();

  // Seed default extensions (ad blocker) on first launch. Fire-and-forget so
  // we don't block window creation on a network call.
  void extensions.seedDefaultsIfNeeded().catch((err) => {
    logStartupWarning('Failed to seed default extensions', err);
  });

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

app.setAppUserModelId('dev.lotardota.clover');

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
    fatalStartupError(err);
  });
}

function fatalStartupError(err: unknown): void {
  const message = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  // eslint-disable-next-line no-console
  console.error('Failed to start Clover:', err);
  try {
    const logPath = path.join(app.getPath('userData'), 'clover-startup.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n\n`);
  } catch {
    /* ignore log write errors */
  }
  try {
    dialog.showErrorBox(
      'Clover failed to start',
      `${message}\n\nA copy of this error was written to clover-startup.log in the user-data folder.`
    );
  } catch {
    /* dialog may not be available if app isn't ready */
  }
  app.quit();
}

function logStartupWarning(label: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(`${label}:`, err);
  try {
    const logPath = path.join(app.getPath('userData'), 'clover-startup.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(
      logPath,
      `[${new Date().toISOString()}] WARN ${label}: ${
        err instanceof Error ? err.stack ?? err.message : String(err)
      }\n\n`
    );
  } catch {
    /* ignore */
  }
}

process.on('uncaughtException', (err) => {
  fatalStartupError(err);
});
