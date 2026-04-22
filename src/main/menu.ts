import { Menu, MenuItemConstructorOptions, BrowserWindow, shell } from 'electron';
import type { BrowserManager } from './browser-manager';
import { INTERNAL_SCHEME } from '../shared/constants';

export function buildAppMenu(browser: BrowserManager): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) browser.addTab(win.id, `${INTERNAL_SCHEME}://newtab`);
          },
        },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => browser.createWindow({ private: false }),
        },
        {
          label: 'New Private Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => browser.createWindow({ private: true }),
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return;
            const managed = browser.listWindows().find((w) => w.id === win.id);
            if (managed && managed.activeTabId != null) browser.closeTab(win.id, managed.activeTabId);
          },
        },
        { role: 'close', label: 'Close Window' },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return;
            const managed = browser.listWindows().find((w) => w.id === win.id);
            if (managed && managed.activeTabId != null) browser.reload(win.id, managed.activeTabId);
          },
        },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return;
            const managed = browser.listWindows().find((w) => w.id === win.id);
            if (managed && managed.activeTabId != null)
              browser.reload(win.id, managed.activeTabId, true);
          },
        },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '&History',
      submenu: [
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return;
            const managed = browser.listWindows().find((w) => w.id === win.id);
            if (managed && managed.activeTabId != null) browser.goBack(win.id, managed.activeTabId);
          },
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return;
            const managed = browser.listWindows().find((w) => w.id === win.id);
            if (managed && managed.activeTabId != null) browser.goForward(win.id, managed.activeTabId);
          },
        },
      ],
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Project README',
          click: () =>
            void shell.openExternal('https://github.com/LotarDota/safarilike-browser'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
