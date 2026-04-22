import { Session, BrowserWindow, shell } from 'electron';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { DownloadItem as DownloadState } from '@shared/types';

export class DownloadManager extends EventEmitter {
  private downloads = new Map<string, DownloadState>();

  constructor(sess: Session) {
    super();
    sess.on('will-download', (_event, item) => {
      const id = randomUUID();
      const entry: DownloadState = {
        id,
        filename: item.getFilename(),
        url: item.getURL(),
        totalBytes: item.getTotalBytes(),
        receivedBytes: item.getReceivedBytes(),
        state: 'progressing',
        path: item.getSavePath(),
        startedAt: Date.now(),
      };
      this.downloads.set(id, entry);
      this.notify();

      item.on('updated', (_e, state) => {
        entry.receivedBytes = item.getReceivedBytes();
        entry.totalBytes = item.getTotalBytes();
        entry.path = item.getSavePath();
        entry.state = state === 'progressing' ? 'progressing' : 'interrupted';
        this.notify();
      });
      item.once('done', (_e, state) => {
        entry.state =
          state === 'completed'
            ? 'completed'
            : state === 'cancelled'
              ? 'cancelled'
              : 'interrupted';
        entry.path = item.getSavePath();
        this.notify();
      });
    });
  }

  list(): DownloadState[] {
    return [...this.downloads.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  cancel(id: string): void {
    const d = this.downloads.get(id);
    if (!d) return;
    d.state = 'cancelled';
    this.notify();
  }

  openInShell(id: string): void {
    const d = this.downloads.get(id);
    if (!d || !d.path) return;
    void shell.openPath(d.path);
  }

  private notify(): void {
    const payload = this.list();
    this.emit('changed', payload);
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      win.webContents.send('downloads:changed', payload);
    }
  }
}
