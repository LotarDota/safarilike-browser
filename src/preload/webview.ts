import { contextBridge, ipcRenderer } from 'electron';
import { cloverApi } from './api';

// Pages inside a tab's WebContentsView share this preload. For built-in
// `clover://` pages (newtab, settings, reader) we want the same rich surface
// the chrome window sees, so those pages can read bookmarks, history,
// settings, and manage extensions. For remote web pages we only ever want the
// `reader.fetch` bridge — giving a random site access to user data would be a
// security bug.
//
// Electron re-runs this preload for every top-level navigation, and
// `window.location` already reflects the destination URL here, so a protocol
// check reliably gates the privileged surface.
const isInternal = typeof window !== 'undefined' && window.location.protocol === 'clover:';

contextBridge.exposeInMainWorld('cloverTab', { version: 1 });

if (isInternal) {
  contextBridge.exposeInMainWorld('clover', cloverApi);
} else {
  contextBridge.exposeInMainWorld('clover', {
    reader: {
      fetch: (url: string): Promise<string> => ipcRenderer.invoke('reader:fetch', url),
    },
  });
}
