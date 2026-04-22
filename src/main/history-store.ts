import Store from 'electron-store';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { HistoryItem } from '@shared/types';

interface HistoryFile {
  items: HistoryItem[];
}

const MAX_HISTORY = 10_000;

export class HistoryStore extends EventEmitter {
  private store: Store<HistoryFile>;

  constructor() {
    super();
    this.store = new Store<HistoryFile>({
      name: 'history',
      defaults: { items: [] },
    });
  }

  list(limit = 500): HistoryItem[] {
    return this.store.get('items').slice(0, limit);
  }

  search(query: string, limit = 50): HistoryItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list(limit);
    return this.store
      .get('items')
      .filter(
        (h) =>
          h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q)
      )
      .slice(0, limit);
  }

  record(input: Omit<HistoryItem, 'id' | 'visitedAt'>): HistoryItem | null {
    if (!input.url || input.url.startsWith('about:') || input.url.startsWith('safarilike:')) {
      return null;
    }
    const item: HistoryItem = {
      id: randomUUID(),
      visitedAt: Date.now(),
      ...input,
    };
    const items = [item, ...this.store.get('items')].slice(0, MAX_HISTORY);
    this.store.set('items', items);
    this.emit('changed', items);
    return item;
  }

  clear(): void {
    this.store.set('items', []);
    this.emit('changed', []);
  }

  replaceAll(items: HistoryItem[]): void {
    this.store.set('items', items.slice(0, MAX_HISTORY));
    this.emit('changed', this.store.get('items'));
  }
}
