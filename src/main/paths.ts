import { app } from 'electron';
import path from 'node:path';

/**
 * Absolute path helpers derived from where the packaged/unpacked app lives.
 * In development we run from the project root; in production we run from the
 * asar/unpacked `resources/app` directory.
 */
export const appRoot = (): string => app.getAppPath();

export const distPath = (...parts: string[]): string =>
  path.join(appRoot(), 'dist', ...parts);

export const rendererIndex = (page: 'chrome' | 'newtab' | 'settings' | 'reader'): string =>
  distPath('renderer', `${page}.html`);

export const preloadPath = (name: 'chrome' | 'webview'): string =>
  distPath('preload', `${name}.js`);

export const resourcesPath = (...parts: string[]): string =>
  path.join(appRoot(), 'resources', ...parts);
