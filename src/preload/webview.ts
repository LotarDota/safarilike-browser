import { contextBridge, ipcRenderer } from 'electron';

// Minimal surface for pages running inside tab WebContentsViews. Nothing
// privileged is exposed to remote content; the `reader.fetch` bridge is only
// useful from the built-in `clover://reader` page, which needs to fetch
// the target article's HTML without running into custom-scheme fetch limits.
contextBridge.exposeInMainWorld('cloverTab', {
  version: 1,
});

contextBridge.exposeInMainWorld('clover', {
  reader: {
    fetch: (url: string): Promise<string> => ipcRenderer.invoke('reader:fetch', url),
  },
});
