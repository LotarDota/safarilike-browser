import {
  BrowserWindow,
  WebContentsView,
  session,
  Session,
  ipcMain,
  nativeTheme,
} from 'electron';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import type { SettingsStore } from './settings-store';
import type { BookmarksStore } from './bookmarks-store';
import type { HistoryStore } from './history-store';
import type { ExtensionsManager } from './extensions-manager';
import { preloadPath, rendererIndex } from './paths';
import type { TabState } from '../shared/types';
import { INTERNAL_SCHEME } from '../shared/constants';

interface ManagerOpts {
  settings: SettingsStore;
  bookmarks: BookmarksStore;
  history: HistoryStore;
  extensions: ExtensionsManager;
}

interface Tab {
  id: number;
  view: WebContentsView;
  windowId: number;
  isPrivate: boolean;
  isPinned: boolean;
  lastUrl: string;
}

interface ManagedWindow {
  id: number;
  window: BrowserWindow;
  tabs: Tab[];
  activeTabId: number | null;
  isPrivate: boolean;
  chromeHeightPx: number;
  findBarVisible: boolean;
}

const DEFAULT_CHROME_HEIGHT = 88; // tabs row + toolbar row
const MIN_WIDTH = 760;
const MIN_HEIGHT = 480;

let tabIdCounter = 1;

/**
 * Orchestrates Electron BrowserWindows + WebContentsViews so the renderer only
 * renders the chrome (tabs, toolbar, sidebar) while the actual page content is
 * hosted in a native web view inset below the chrome.
 */
export class BrowserManager extends EventEmitter {
  private windows = new Map<number, ManagedWindow>();
  private readonly opts: ManagerOpts;

  constructor(opts: ManagerOpts) {
    super();
    this.opts = opts;
    this.opts.settings.on('updated', () => this.broadcastState());
    nativeTheme.on('updated', () => this.broadcastState());
  }

  createWindow(opts: { private: boolean; url?: string } = { private: false }): ManagedWindow {
    const win = new BrowserWindow({
      width: 1240,
      height: 820,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      show: false,
      backgroundColor: '#1c1c1e',
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#d0d0d3',
        height: 44,
      },
      frame: process.platform !== 'win32',
      roundedCorners: true,
      webPreferences: {
        preload: preloadPath('chrome'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    const managed: ManagedWindow = {
      id: win.id,
      window: win,
      tabs: [],
      activeTabId: null,
      isPrivate: opts.private,
      chromeHeightPx: DEFAULT_CHROME_HEIGHT,
      findBarVisible: false,
    };
    this.windows.set(win.id, managed);

    win.loadFile(rendererIndex('chrome')).catch(() => undefined);
    win.once('ready-to-show', () => {
      win.show();
      this.addTab(win.id, opts.url ?? `${INTERNAL_SCHEME}://newtab`);
    });

    win.on('resize', () => this.layoutTabs(managed));
    win.on('maximize', () => this.layoutTabs(managed));
    win.on('unmaximize', () => this.layoutTabs(managed));
    win.on('enter-full-screen', () => this.layoutTabs(managed));
    win.on('leave-full-screen', () => this.layoutTabs(managed));
    win.on('closed', () => {
      for (const tab of managed.tabs) this.destroyTab(tab);
      this.windows.delete(win.id);
    });

    return managed;
  }

  listWindows(): ManagedWindow[] {
    return [...this.windows.values()];
  }

  getWindowForSender(senderId: number): ManagedWindow | null {
    for (const win of this.windows.values()) {
      if (win.window.webContents.id === senderId) return win;
    }
    return null;
  }

  openUrlInNewTab(url: string): Tab | null {
    const focused = BrowserWindow.getFocusedWindow();
    const managed =
      (focused && this.windows.get(focused.id)) || this.listWindows()[0];
    if (!managed) return null;
    return this.addTab(managed.id, url);
  }

  addTab(windowId: number, url: string): Tab | null {
    const managed = this.windows.get(windowId);
    if (!managed) return null;

    const tabSession: Session = managed.isPrivate
      ? session.fromPartition(`private:${windowId}`, { cache: false })
      : session.defaultSession;

    // Register extension loaders for this session the first time we see it.
    this.opts.extensions.attachToSession(tabSession);

    const view = new WebContentsView({
      webPreferences: {
        session: tabSession,
        preload: preloadPath('webview'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });

    const tab: Tab = {
      id: tabIdCounter++,
      view,
      windowId,
      isPrivate: managed.isPrivate,
      isPinned: false,
      lastUrl: url,
    };

    managed.tabs.push(tab);
    managed.window.contentView.addChildView(view);
    this.wireTabEvents(managed, tab);

    void view.webContents.loadURL(url).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to load initial tab url', url, err);
    });

    this.activateTab(windowId, tab.id);
    this.broadcastState();
    return tab;
  }

  activateTab(windowId: number, tabId: number): void {
    const managed = this.windows.get(windowId);
    if (!managed) return;
    const tab = managed.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    managed.activeTabId = tab.id;
    this.layoutTabs(managed);
    this.broadcastState();
  }

  closeTab(windowId: number, tabId: number): void {
    const managed = this.windows.get(windowId);
    if (!managed) return;
    const idx = managed.tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;
    const [tab] = managed.tabs.splice(idx, 1);
    this.destroyTab(tab);
    if (managed.activeTabId === tabId) {
      const fallback = managed.tabs[idx] ?? managed.tabs[idx - 1] ?? null;
      managed.activeTabId = fallback ? fallback.id : null;
    }
    if (managed.tabs.length === 0) {
      managed.window.close();
      return;
    }
    this.layoutTabs(managed);
    this.broadcastState();
  }

  navigate(windowId: number, tabId: number, url: string): void {
    const tab = this.getTab(windowId, tabId);
    if (!tab) return;
    void tab.view.webContents.loadURL(url).catch(() => undefined);
  }

  reload(windowId: number, tabId: number, hard = false): void {
    const tab = this.getTab(windowId, tabId);
    if (!tab) return;
    if (hard) tab.view.webContents.reloadIgnoringCache();
    else tab.view.webContents.reload();
  }

  goBack(windowId: number, tabId: number): void {
    const tab = this.getTab(windowId, tabId);
    if (!tab) return;
    const wc = tab.view.webContents as Electron.WebContents & {
      canGoBack(): boolean;
      goBack(): void;
    };
    if (wc.canGoBack()) wc.goBack();
  }

  goForward(windowId: number, tabId: number): void {
    const tab = this.getTab(windowId, tabId);
    if (!tab) return;
    const wc = tab.view.webContents as Electron.WebContents & {
      canGoForward(): boolean;
      goForward(): void;
    };
    if (wc.canGoForward()) wc.goForward();
  }

  stop(windowId: number, tabId: number): void {
    const tab = this.getTab(windowId, tabId);
    if (!tab) return;
    tab.view.webContents.stop();
  }

  findInPage(windowId: number, tabId: number, query: string): void {
    const tab = this.getTab(windowId, tabId);
    if (!tab) return;
    if (query) tab.view.webContents.findInPage(query);
    else tab.view.webContents.stopFindInPage('clearSelection');
  }

  setChromeHeight(windowId: number, heightPx: number): void {
    const managed = this.windows.get(windowId);
    if (!managed) return;
    managed.chromeHeightPx = Math.max(48, Math.min(heightPx, 200));
    this.layoutTabs(managed);
  }

  private getTab(windowId: number, tabId: number): Tab | undefined {
    return this.windows.get(windowId)?.tabs.find((t) => t.id === tabId);
  }

  private destroyTab(tab: Tab): void {
    try {
      const managed = this.windows.get(tab.windowId);
      if (managed) managed.window.contentView.removeChildView(tab.view);
      (tab.view.webContents as { destroy?: () => void }).destroy?.();
    } catch {
      /* ignore */
    }
  }

  private layoutTabs(managed: ManagedWindow): void {
    const bounds = managed.window.getContentBounds();
    const top = managed.chromeHeightPx;
    for (const tab of managed.tabs) {
      const isActive = tab.id === managed.activeTabId;
      if (!isActive) {
        tab.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        continue;
      }
      tab.view.setBounds({
        x: 0,
        y: top,
        width: bounds.width,
        height: Math.max(0, bounds.height - top),
      });
    }
  }

  private wireTabEvents(managed: ManagedWindow, tab: Tab): void {
    const { webContents } = tab.view;

    webContents.on('page-title-updated', () => this.broadcastState());
    webContents.on('page-favicon-updated', () => this.broadcastState());
    webContents.on('did-start-loading', () => this.broadcastState());
    webContents.on('did-stop-loading', () => this.broadcastState());
    webContents.on('did-navigate', (_event, url) => {
      tab.lastUrl = url;
      this.broadcastState();
      if (!tab.isPrivate) {
        this.opts.history.record({
          title: webContents.getTitle() || url,
          url,
          favicon: null,
        });
      }
    });
    webContents.on('did-navigate-in-page', (_event, url) => {
      tab.lastUrl = url;
      this.broadcastState();
    });
    webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 /* ABORTED */) return;
      const body = encodeURIComponent(
        JSON.stringify({ code: errorCode, description: errorDescription, url: validatedURL })
      );
      void webContents.loadURL(`${INTERNAL_SCHEME}://error?data=${body}`);
    });

    // Open new tabs for target=_blank rather than spawning OS windows.
    webContents.setWindowOpenHandler(({ url }) => {
      this.addTab(managed.id, url);
      return { action: 'deny' };
    });
  }

  private broadcastState(): void {
    for (const managed of this.windows.values()) {
      const payload = this.serializeWindow(managed);
      if (managed.window.isDestroyed()) continue;
      managed.window.webContents.send('tabs:state-changed', payload);
    }
  }

  serializeWindow(managed: ManagedWindow): {
    id: number;
    activeTabId: number | null;
    isPrivate: boolean;
    tabs: TabState[];
  } {
    return {
      id: managed.id,
      activeTabId: managed.activeTabId,
      isPrivate: managed.isPrivate,
      tabs: managed.tabs.map((tab) => {
        const wc = tab.view.webContents as Electron.WebContents & {
          canGoBack(): boolean;
          canGoForward(): boolean;
        };
        return {
          id: tab.id,
          url: wc.getURL() || tab.lastUrl,
          title: wc.getTitle(),
          favicon: null,
          isLoading: wc.isLoading(),
          canGoBack: wc.canGoBack(),
          canGoForward: wc.canGoForward(),
          isAudible: wc.isCurrentlyAudible(),
          isMuted: wc.isAudioMuted(),
          isPinned: tab.isPinned,
          isPrivate: tab.isPrivate,
          error: null,
        };
      }),
    };
  }
}

// Preserve exported type for IPC layer.
export type { ManagedWindow, Tab };
// Unused import guard (ipcMain is used by consumers of this file via IPC registration).
void ipcMain;
void path;
