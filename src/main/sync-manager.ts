import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { SettingsStore } from './settings-store';
import type { BookmarksStore } from './bookmarks-store';
import type { HistoryStore } from './history-store';
import type { BookmarkItem, HistoryItem, SyncSettings } from '../shared/types';

interface SyncPayload {
  version: 1;
  deviceName: string;
  updatedAt: number;
  bookmarks?: BookmarkItem[];
  history?: HistoryItem[];
}

interface SyncManagerDeps {
  settings: SettingsStore;
  bookmarks: BookmarksStore;
  history: HistoryStore;
}

/**
 * iCloud-like sync: symmetric AES-256-GCM over a user-supplied passphrase
 * (never sent to the server), talking to a tiny self-hostable REST endpoint
 * (see scripts/sync-server.mjs). The server stores encrypted blobs only.
 *
 * On Windows, the device-derived key is encrypted at rest via `safeStorage`
 * (DPAPI), similar to how Safari uses Keychain for iCloud keys.
 */
export class SyncManager extends EventEmitter {
  private readonly keyPath: string;
  private cachedKey: Buffer | null = null;

  constructor(private readonly deps: SyncManagerDeps) {
    super();
    this.keyPath = path.join(app.getPath('userData'), 'sync-key.bin');
    this.loadKeyFromDisk();
  }

  get status(): SyncSettings {
    return this.deps.settings.get().sync;
  }

  configure(patch: Partial<SyncSettings> & { passphrase?: string }): SyncSettings {
    const current = this.status;
    const next: SyncSettings = { ...current, ...patch };
    delete (next as Partial<SyncSettings> & { passphrase?: string }).passphrase;
    this.deps.settings.update({ sync: next });
    if (patch.passphrase) {
      this.setPassphrase(patch.passphrase);
    }
    return next;
  }

  private setPassphrase(passphrase: string): void {
    const derived = crypto.scryptSync(passphrase, 'safarilike-sync', 32);
    this.cachedKey = derived;
    try {
      fs.mkdirSync(path.dirname(this.keyPath), { recursive: true });
      if (safeStorage.isEncryptionAvailable()) {
        fs.writeFileSync(this.keyPath, safeStorage.encryptString(derived.toString('base64')));
      } else {
        fs.writeFileSync(this.keyPath, derived);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to persist sync key:', err);
    }
  }

  private loadKeyFromDisk(): void {
    try {
      if (!fs.existsSync(this.keyPath)) return;
      const data = fs.readFileSync(this.keyPath);
      if (safeStorage.isEncryptionAvailable()) {
        const base64 = safeStorage.decryptString(data);
        this.cachedKey = Buffer.from(base64, 'base64');
      } else {
        this.cachedKey = data;
      }
    } catch {
      this.cachedKey = null;
    }
  }

  private encrypt(payload: SyncPayload): { iv: string; data: string; tag: string } {
    if (!this.cachedKey) throw new Error('Sync passphrase not configured');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.cachedKey, iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      data: enc.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  private decrypt(blob: { iv: string; data: string; tag: string }): SyncPayload {
    if (!this.cachedKey) throw new Error('Sync passphrase not configured');
    const iv = Buffer.from(blob.iv, 'base64');
    const data = Buffer.from(blob.data, 'base64');
    const tag = Buffer.from(blob.tag, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.cachedKey, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(dec.toString('utf8')) as SyncPayload;
  }

  async syncNow(): Promise<{ pushed: number; pulled: number }> {
    const s = this.status;
    if (!s.enabled) throw new Error('Sync is disabled');
    if (!s.accountEmail) throw new Error('Sync account email required');
    if (!this.cachedKey) throw new Error('Sync passphrase not configured');

    const payload: SyncPayload = {
      version: 1,
      deviceName: s.deviceName,
      updatedAt: Date.now(),
      bookmarks: s.syncBookmarks ? this.deps.bookmarks.list() : undefined,
      history: s.syncHistory ? this.deps.history.list(5000) : undefined,
    };

    const account = encodeURIComponent(s.accountEmail);
    const base = s.serverUrl.replace(/\/+$/, '');

    // Push
    const pushRes = await fetch(`${base}/v1/accounts/${account}/blob`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(this.encrypt(payload)),
    });
    if (!pushRes.ok) throw new Error(`Sync push failed: ${pushRes.status}`);

    // Pull (for multi-device merge on next sync)
    const pullRes = await fetch(`${base}/v1/accounts/${account}/blob`, { method: 'GET' });
    let pulled = 0;
    if (pullRes.ok) {
      const blob = (await pullRes.json()) as { iv: string; data: string; tag: string } | null;
      if (blob && blob.iv) {
        const remote = this.decrypt(blob);
        if (s.syncBookmarks && remote.bookmarks) {
          this.deps.bookmarks.replaceAll(
            dedupeBy(
              [...this.deps.bookmarks.list(), ...remote.bookmarks],
              (b) => `${b.url}|${b.title}`
            )
          );
          pulled += remote.bookmarks.length;
        }
        if (s.syncHistory && remote.history) {
          this.deps.history.replaceAll(
            dedupeBy(
              [...this.deps.history.list(5000), ...remote.history],
              (h) => `${h.url}|${h.visitedAt}`
            ).sort((a, b) => b.visitedAt - a.visitedAt)
          );
          pulled += remote.history.length;
        }
      }
    }

    this.deps.settings.update({ sync: { ...s, lastSyncAt: Date.now() } });
    return { pushed: 1, pulled };
  }
}

function dedupeBy<T>(arr: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
