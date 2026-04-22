import { contextBridge, ipcRenderer } from 'electron';

// Minimal surface for pages running inside tab WebContentsViews. Nothing
// privileged is exposed to remote content; the `reader.fetch` bridge is only
// useful from the built-in `safarilike://reader` page, which needs to fetch
// the target article's HTML without running into custom-scheme fetch limits.
contextBridge.exposeInMainWorld('safarilikeTab', {
  version: 1,
});

contextBridge.exposeInMainWorld('safarilike', {
  reader: {
    fetch: (url: string): Promise<string> => ipcRenderer.invoke('reader:fetch', url),
  },
});
