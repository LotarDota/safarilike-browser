import { ipcMain, BrowserWindow, net } from 'electron';
import type { BrowserManager } from './browser-manager';
import type { SettingsStore } from './settings-store';
import type { BookmarksStore } from './bookmarks-store';
import type { HistoryStore } from './history-store';
import type { DownloadManager } from './download-manager';
import type { ExtensionsManager } from './extensions-manager';
import type { SyncManager } from './sync-manager';
import type { SyncSettings } from '../shared/types';

interface IpcDeps {
  browser: BrowserManager;
  settings: SettingsStore;
  bookmarks: BookmarksStore;
  history: HistoryStore;
  downloads: DownloadManager;
  extensions: ExtensionsManager;
  sync: SyncManager;
}

function senderWindowId(webContentsId: number): number | null {
  const wc =
    BrowserWindow.getAllWindows()
      .map((w) => w.webContents)
      .find((c) => c.id === webContentsId) ?? BrowserWindow.getFocusedWindow()?.webContents;
  const win = wc ? BrowserWindow.fromWebContents(wc) : null;
  return win ? win.id : BrowserWindow.getFocusedWindow()?.id ?? null;
}

export function registerIpc(deps: IpcDeps): void {
  const { browser, settings, bookmarks, history, downloads, extensions, sync } = deps;

  // Tabs
  ipcMain.handle('tabs:list', (event) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId == null) return null;
    const managed = browser.listWindows().find((w) => w.id === windowId);
    return managed ? browser.serializeWindow(managed) : null;
  });
  ipcMain.handle('tabs:create', (event, url?: string) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId == null) return null;
    return browser.addTab(windowId, url ?? 'safarilike://newtab')?.id ?? null;
  });
  ipcMain.handle('tabs:close', (event, tabId: number) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId != null) browser.closeTab(windowId, tabId);
  });
  ipcMain.handle('tabs:activate', (event, tabId: number) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId != null) browser.activateTab(windowId, tabId);
  });
  ipcMain.handle('tabs:navigate', (event, tabId: number, url: string) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId != null) browser.navigate(windowId, tabId, url);
  });
  ipcMain.handle('tabs:reload', (event, tabId: number, hard?: boolean) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId != null) browser.reload(windowId, tabId, !!hard);
  });
  ipcMain.handle('tabs:go-back', (event, tabId: number) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId != null) browser.goBack(windowId, tabId);
  });
  ipcMain.handle('tabs:go-forward', (event, tabId: number) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId != null) browser.goForward(windowId, tabId);
  });
  ipcMain.handle('tabs:stop', (event, tabId: number) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId != null) browser.stop(windowId, tabId);
  });
  ipcMain.handle('tabs:find', (event, tabId: number, query: string) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId != null) browser.findInPage(windowId, tabId, query);
  });
  ipcMain.handle('tabs:chrome-height', (event, heightPx: number) => {
    const windowId = senderWindowId(event.sender.id);
    if (windowId != null) browser.setChromeHeight(windowId, heightPx);
  });

  // Bookmarks
  ipcMain.handle('bookmarks:list', () => bookmarks.list());
  ipcMain.handle('bookmarks:add', (_event, item: { title: string; url: string; folder?: string }) =>
    bookmarks.add(item)
  );
  ipcMain.handle('bookmarks:remove', (_event, id: string) => {
    bookmarks.remove(id);
    return true;
  });
  ipcMain.handle('bookmarks:update', (_event, id: string, patch: Partial<{ title: string; url: string; folder: string }>) =>
    bookmarks.update(id, patch)
  );

  // History
  ipcMain.handle('history:list', (_event, limit?: number) => history.list(limit));
  ipcMain.handle('history:search', (_event, query: string, limit?: number) =>
    history.search(query, limit)
  );
  ipcMain.handle('history:clear', () => {
    history.clear();
    return true;
  });

  // Downloads
  ipcMain.handle('downloads:list', () => downloads.list());
  ipcMain.handle('downloads:cancel', (_event, id: string) => {
    downloads.cancel(id);
    return true;
  });
  ipcMain.handle('downloads:open', (_event, id: string) => {
    downloads.openInShell(id);
    return true;
  });

  // Settings
  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:update', (_event, patch: Record<string, unknown>) =>
    settings.update(patch as Parameters<typeof settings.update>[0])
  );

  // Extensions
  ipcMain.handle('extensions:list', () => extensions.list());
  ipcMain.handle('extensions:install', async (event) => {
    const windowId = senderWindowId(event.sender.id);
    const win = windowId != null ? BrowserWindow.fromId(windowId) : null;
    return extensions.installFromFolder(win ?? undefined);
  });
  ipcMain.handle('extensions:uninstall', async (_event, id: string) => {
    await extensions.uninstall(id);
    return true;
  });
  ipcMain.handle('extensions:set-enabled', async (_event, id: string, enabled: boolean) => {
    await extensions.setEnabled(id, enabled);
    return true;
  });

  // Sync
  ipcMain.handle('sync:status', () => sync.status);
  ipcMain.handle('sync:configure', (_event, patch: Partial<SyncSettings> & { passphrase?: string }) =>
    sync.configure(patch)
  );
  ipcMain.handle('sync:now', async () => sync.syncNow());

  // Window controls
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });
  ipcMain.handle('window:new', () => browser.createWindow({ private: false }));
  ipcMain.handle('window:new-private', () => browser.createWindow({ private: true }));

  // Reader — fetch remote HTML via the main process so the custom safarilike://
  // scheme does not need to satisfy cross-origin restrictions in the renderer.
  ipcMain.handle('reader:fetch', async (_event, url: string): Promise<string> => {
    const res = await net.fetch(url, { credentials: 'omit', redirect: 'follow' });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    return res.text();
  });
}
