import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function isEnoent(err: unknown): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT';
}

export class JsonStore<T extends { id: string }> {
  private items: T[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.items = JSON.parse(raw) as T[];
    } catch (err) {
      if (isEnoent(err)) {
        this.items = [];
        await this.persist();
      } else {
        throw err;
      }
    }
  }

  async all(): Promise<T[]> {
    return [...this.items];
  }

  async find(id: string): Promise<T | undefined> {
    return this.items.find((item) => item.id === id);
  }

  async save(item: T): Promise<T> {
    const index = this.items.findIndex((existing) => existing.id === item.id);
    if (index === -1) {
      this.items.push(item);
    } else {
      this.items[index] = item;
    }
    await this.persist();
    return item;
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id !== id);
    await this.persist();
  }

  async removeMany(predicate: (item: T) => boolean): Promise<number> {
    const before = this.items.length;
    this.items = this.items.filter((item) => !predicate(item));
    const removed = before - this.items.length;
    if (removed > 0) await this.persist();
    return removed;
  }

  private persist(): Promise<void> {
    const snapshot = [...this.items];
    this.queue = this.queue.then(() => this.writeAtomic(snapshot));
    return this.queue;
  }

  private async writeAtomic(items: T[]): Promise<void> {
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(items, null, 2), 'utf8');
    await rename(tmpPath, this.filePath);
  }
}