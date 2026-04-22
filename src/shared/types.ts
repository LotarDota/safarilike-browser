export interface TabState {
  id: number;
  url: string;
  title: string;
  favicon: string | null;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isAudible?: boolean;
  isMuted?: boolean;
  isPinned?: boolean;
  isPrivate?: boolean;
  error?: string | null;
}

export interface WindowState {
  id: number;
  tabs: TabState[];
  activeTabId: number | null;
  isPrivate: boolean;
}

export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  favicon?: string | null;
  folder?: string;
  addedAt: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
  favicon?: string | null;
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  path: string;
  startedAt: number;
}

export interface SearchEngine {
  id: string;
  name: string;
  keyword: string;
  template: string;
  suggestionsTemplate?: string;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  icon?: string | null;
  path: string;
}

export interface SyncSettings {
  enabled: boolean;
  serverUrl: string;
  accountEmail: string | null;
  deviceName: string;
  lastSyncAt: number | null;
  syncBookmarks: boolean;
  syncHistory: boolean;
  syncTabs: boolean;
  syncPasswords: boolean;
}

export interface AppSettings {
  homepage: string;
  newTabPage: 'start' | 'homepage' | 'blank';
  defaultSearchEngineId: string;
  searchEngines: SearchEngine[];
  theme: 'system' | 'light' | 'dark';
  accentColor: string;
  showFavoritesBar: boolean;
  showTabPreview: boolean;
  blockPopups: boolean;
  preventCrossSiteTracking: boolean;
  askBeforeDownloading: boolean;
  downloadsDirectory: string | null;
  sync: SyncSettings;
}

export type IpcChannels =
  | 'tabs:list'
  | 'tabs:create'
  | 'tabs:close'
  | 'tabs:activate'
  | 'tabs:navigate'
  | 'tabs:reload'
  | 'tabs:go-back'
  | 'tabs:go-forward'
  | 'tabs:find'
  | 'tabs:stop'
  | 'tabs:reader'
  | 'tabs:state-changed'
  | 'bookmarks:list'
  | 'bookmarks:add'
  | 'bookmarks:remove'
  | 'bookmarks:update'
  | 'history:list'
  | 'history:search'
  | 'history:clear'
  | 'downloads:list'
  | 'downloads:cancel'
  | 'downloads:open'
  | 'downloads:changed'
  | 'settings:get'
  | 'settings:update'
  | 'extensions:list'
  | 'extensions:install'
  | 'extensions:uninstall'
  | 'extensions:set-enabled'
  | 'sync:configure'
  | 'sync:now'
  | 'sync:status'
  | 'window:new'
  | 'window:new-private'
  | 'window:minimize'
  | 'window:maximize'
  | 'window:close';
