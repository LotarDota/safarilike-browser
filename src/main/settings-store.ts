import Store from 'electron-store';
import { EventEmitter } from 'node:events';
import type { AppSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';

export class SettingsStore extends EventEmitter {
  private store: Store<AppSettings>;

  constructor() {
    super();
    this.store = new Store<AppSettings>({
      name: 'settings',
      defaults: DEFAULT_SETTINGS,
    });
  }

  get(): AppSettings {
    // electron-store merges with defaults on read.
    return this.store.store;
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const next = { ...this.get(), ...patch };
    this.store.store = next;
    this.emit('updated', next);
    return next;
  }

  getSearchEngine(): AppSettings['searchEngines'][number] {
    const s = this.get();
    return (
      s.searchEngines.find((e) => e.id === s.defaultSearchEngineId) ?? s.searchEngines[0]
    );
  }
}
