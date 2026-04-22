import { ipcRenderer } from 'electron';
import type {
  AppSettings,
  BookmarkItem,
  DownloadItem,
  ExtensionInfo,
  HistoryItem,
  SyncSettings,
  TabState,
} from '../shared/types';

export interface WindowState {
  id: number;
  activeTabId: number | null;
  isPrivate: boolean;
  tabs: TabState[];
}

// Full IPC surface shared by the main chrome window and built-in `clover://`
// pages. Defined here (rather than at top-level in a preload file) so both
// preloads can import it without triggering duplicate contextBridge exposures.
export const cloverApi = {
  tabs: {
    list: (): Promise<WindowState | null> => ipcRenderer.invoke('tabs:list'),
    create: (url?: string): Promise<number | null> => ipcRenderer.invoke('tabs:create', url),
    close: (tabId: number): Promise<void> => ipcRenderer.invoke('tabs:close', tabId),
    activate: (tabId: number): Promise<void> => ipcRenderer.invoke('tabs:activate', tabId),
    navigate: (tabId: number, url: string): Promise<void> =>
      ipcRenderer.invoke('tabs:navigate', tabId, url),
    reload: (tabId: number, hard?: boolean): Promise<void> =>
      ipcRenderer.invoke('tabs:reload', tabId, hard),
    goBack: (tabId: number): Promise<void> => ipcRenderer.invoke('tabs:go-back', tabId),
    goForward: (tabId: number): Promise<void> => ipcRenderer.invoke('tabs:go-forward', tabId),
    stop: (tabId: number): Promise<void> => ipcRenderer.invoke('tabs:stop', tabId),
    find: (tabId: number, query: string): Promise<void> =>
      ipcRenderer.invoke('tabs:find', tabId, query),
    setChromeHeight: (heightPx: number): Promise<void> =>
      ipcRenderer.invoke('tabs:chrome-height', heightPx),
    onStateChanged: (handler: (state: WindowState) => void): (() => void) => {
      const listener = (_e: unknown, s: WindowState): void => handler(s);
      ipcRenderer.on('tabs:state-changed', listener);
      return () => ipcRenderer.removeListener('tabs:state-changed', listener);
    },
  },
  bookmarks: {
    list: (): Promise<BookmarkItem[]> => ipcRenderer.invoke('bookmarks:list'),
    add: (item: { title: string; url: string; folder?: string }): Promise<BookmarkItem> =>
      ipcRenderer.invoke('bookmarks:add', item),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke('bookmarks:remove', id),
    update: (
      id: string,
      patch: Partial<{ title: string; url: string; folder: string }>
    ): Promise<BookmarkItem | null> => ipcRenderer.invoke('bookmarks:update', id, patch),
  },
  history: {
    list: (limit?: number): Promise<HistoryItem[]> => ipcRenderer.invoke('history:list', limit),
    search: (query: string, limit?: number): Promise<HistoryItem[]> =>
      ipcRenderer.invoke('history:search', query, limit),
    clear: (): Promise<boolean> => ipcRenderer.invoke('history:clear'),
  },
  downloads: {
    list: (): Promise<DownloadItem[]> => ipcRenderer.invoke('downloads:list'),
    cancel: (id: string): Promise<boolean> => ipcRenderer.invoke('downloads:cancel', id),
    open: (id: string): Promise<boolean> => ipcRenderer.invoke('downloads:open', id),
    onChanged: (handler: (items: DownloadItem[]) => void): (() => void) => {
      const listener = (_e: unknown, items: DownloadItem[]): void => handler(items);
      ipcRenderer.on('downloads:changed', listener);
      return () => ipcRenderer.removeListener('downloads:changed', listener);
    },
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:update', patch),
  },
  extensions: {
    list: (): Promise<ExtensionInfo[]> => ipcRenderer.invoke('extensions:list'),
    install: (): Promise<ExtensionInfo | null> => ipcRenderer.invoke('extensions:install'),
    installFromStore: (extensionId: string): Promise<ExtensionInfo | null> =>
      ipcRenderer.invoke('extensions:install-from-store', extensionId),
    openStore: (): Promise<void> => ipcRenderer.invoke('extensions:open-store'),
    uninstall: (id: string): Promise<boolean> => ipcRenderer.invoke('extensions:uninstall', id),
    setEnabled: (id: string, enabled: boolean): Promise<boolean> =>
      ipcRenderer.invoke('extensions:set-enabled', id, enabled),
  },
  sync: {
    status: (): Promise<SyncSettings> => ipcRenderer.invoke('sync:status'),
    configure: (patch: Partial<SyncSettings> & { passphrase?: string }): Promise<SyncSettings> =>
      ipcRenderer.invoke('sync:configure', patch),
    now: (): Promise<{ pushed: number; pulled: number }> => ipcRenderer.invoke('sync:now'),
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    newWindow: (): Promise<void> => ipcRenderer.invoke('window:new'),
    newPrivate: (): Promise<void> => ipcRenderer.invoke('window:new-private'),
  },
  reader: {
    fetch: (url: string): Promise<string> => ipcRenderer.invoke('reader:fetch', url),
  },
};

export type CloverApi = typeof cloverApi;
