import Store from 'electron-store';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { BookmarkItem } from '@shared/types';

interface BookmarksFile {
  items: BookmarkItem[];
}

export class BookmarksStore extends EventEmitter {
  private store: Store<BookmarksFile>;

  constructor() {
    super();
    this.store = new Store<BookmarksFile>({
      name: 'bookmarks',
      defaults: { items: [] },
    });
  }

  list(): BookmarkItem[] {
    return this.store.get('items');
  }

  add(input: Omit<BookmarkItem, 'id' | 'addedAt'>): BookmarkItem {
    const item: BookmarkItem = {
      id: randomUUID(),
      addedAt: Date.now(),
      ...input,
    };
    const items = [...this.list(), item];
    this.store.set('items', items);
    this.emit('changed', items);
    return item;
  }

  remove(id: string): void {
    const items = this.list().filter((b) => b.id !== id);
    this.store.set('items', items);
    this.emit('changed', items);
  }

  update(id: string, patch: Partial<BookmarkItem>): BookmarkItem | null {
    const items = this.list();
    const idx = items.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    const next = { ...items[idx], ...patch, id: items[idx].id };
    items[idx] = next;
    this.store.set('items', items);
    this.emit('changed', items);
    return next;
  }

  replaceAll(items: BookmarkItem[]): void {
    this.store.set('items', items);
    this.emit('changed', items);
  }

  findByUrl(url: string): BookmarkItem | undefined {
    return this.list().find((b) => b.url === url);
  }
}
