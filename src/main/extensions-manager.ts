import { Session, app, dialog, BrowserWindow } from 'electron';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ExtensionInfo } from '../shared/types';

interface ExtensionsFile {
  installed: ExtensionInfo[];
}

/**
 * Electron's Session loads unpacked Chrome extensions via `loadExtension` /
 * `removeExtension`. Electron 31 supports MV2 and (mostly) MV3 via its
 * electron-chrome-extensions-style API surface. We persist installed paths
 * so they can be reloaded on next launch, and re-attach them to new sessions
 * (e.g. private-window partitions) lazily.
 */
export class ExtensionsManager extends EventEmitter {
  private readonly registryPath: string;
  private readonly attachedSessions = new WeakSet<Session>();
  private cache: ExtensionsFile = { installed: [] };

  constructor(private readonly defaultSession: Session) {
    super();
    this.registryPath = path.join(app.getPath('userData'), 'extensions-registry.json');
    this.readRegistry();
  }

  private readRegistry(): void {
    try {
      if (fs.existsSync(this.registryPath)) {
        this.cache = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
      }
    } catch {
      this.cache = { installed: [] };
    }
  }

  private writeRegistry(): void {
    try {
      fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
      fs.writeFileSync(this.registryPath, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to persist extensions registry:', err);
    }
  }

  attachToSession(sess: Session): void {
    if (this.attachedSessions.has(sess)) return;
    this.attachedSessions.add(sess);
    for (const ext of this.cache.installed) {
      if (!ext.enabled || !fs.existsSync(ext.path)) continue;
      void sess
        .loadExtension(ext.path, { allowFileAccess: true })
        .catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn(`Failed to load extension ${ext.name}:`, err);
        });
    }
  }

  async loadInstalledExtensions(): Promise<void> {
    this.attachToSession(this.defaultSession);
  }

  list(): ExtensionInfo[] {
    return [...this.cache.installed];
  }

  async installFromFolder(parent?: BrowserWindow): Promise<ExtensionInfo | null> {
    const result = parent
      ? await dialog.showOpenDialog(parent, {
          title: 'Select unpacked extension folder (must contain manifest.json)',
          properties: ['openDirectory'],
        })
      : await dialog.showOpenDialog({
          title: 'Select unpacked extension folder',
          properties: ['openDirectory'],
        });
    if (result.canceled || result.filePaths.length === 0) return null;
    const dir = result.filePaths[0];
    return this.installFromPath(dir);
  }

  async installFromPath(dir: string): Promise<ExtensionInfo | null> {
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`No manifest.json found at ${dir}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      name?: string;
      version?: string;
      description?: string;
    };

    const loaded = await this.defaultSession.loadExtension(dir, {
      allowFileAccess: true,
    });
    const info: ExtensionInfo = {
      id: loaded.id || randomUUID(),
      name: manifest.name ?? loaded.name ?? path.basename(dir),
      version: manifest.version ?? loaded.version ?? '0.0.0',
      description: manifest.description,
      enabled: true,
      icon: null,
      path: dir,
    };
    this.cache.installed = this.cache.installed.filter((e) => e.path !== dir);
    this.cache.installed.push(info);
    this.writeRegistry();
    this.emit('changed', this.list());
    return info;
  }

  async uninstall(id: string): Promise<void> {
    const ext = this.cache.installed.find((e) => e.id === id);
    if (!ext) return;
    try {
      this.defaultSession.removeExtension(id);
    } catch {
      /* ignore */
    }
    this.cache.installed = this.cache.installed.filter((e) => e.id !== id);
    this.writeRegistry();
    this.emit('changed', this.list());
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const ext = this.cache.installed.find((e) => e.id === id);
    if (!ext) return;
    ext.enabled = enabled;
    try {
      if (enabled) {
        await this.defaultSession.loadExtension(ext.path, { allowFileAccess: true });
      } else {
        this.defaultSession.removeExtension(id);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to toggle extension:', err);
    }
    this.writeRegistry();
    this.emit('changed', this.list());
  }
}
