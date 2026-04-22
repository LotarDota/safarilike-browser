import type { AppSettings, SearchEngine } from './types';

export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    keyword: 'ddg',
    template: 'https://duckduckgo.com/?q={query}',
    suggestionsTemplate: 'https://duckduckgo.com/ac/?q={query}&type=list',
  },
  {
    id: 'google',
    name: 'Google',
    keyword: 'g',
    template: 'https://www.google.com/search?q={query}',
    suggestionsTemplate:
      'https://suggestqueries.google.com/complete/search?client=firefox&q={query}',
  },
  {
    id: 'bing',
    name: 'Bing',
    keyword: 'b',
    template: 'https://www.bing.com/search?q={query}',
  },
  {
    id: 'yandex',
    name: 'Yandex',
    keyword: 'ya',
    template: 'https://yandex.com/search/?text={query}',
  },
  {
    id: 'ecosia',
    name: 'Ecosia',
    keyword: 'eco',
    template: 'https://www.ecosia.org/search?q={query}',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  homepage: 'clover://newtab',
  newTabPage: 'start',
  defaultSearchEngineId: 'duckduckgo',
  searchEngines: DEFAULT_SEARCH_ENGINES,
  theme: 'system',
  accentColor: '#0a84ff',
  showFavoritesBar: true,
  showTabPreview: true,
  blockPopups: true,
  preventCrossSiteTracking: true,
  askBeforeDownloading: true,
  downloadsDirectory: null,
  sync: {
    enabled: false,
    serverUrl: 'http://localhost:8787',
    accountEmail: null,
    deviceName: 'This PC',
    lastSyncAt: null,
    syncBookmarks: true,
    syncHistory: true,
    syncTabs: true,
    syncPasswords: false,
  },
};

export const INTERNAL_SCHEME = 'clover';
