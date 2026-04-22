import { contextBridge } from 'electron';

// Minimal surface for pages running inside tab BrowserViews. We expose nothing
// privileged; this preload exists so future reader-mode injection / extension
// host scripts have a known stable context.
contextBridge.exposeInMainWorld('safarilikeTab', {
  version: 1,
});
