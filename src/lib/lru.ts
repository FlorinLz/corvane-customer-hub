/** A small least-recently-used map. `get` and `set` mark an entry as used; when `max` is exceeded the oldest entry goes and `onEvict` sees it. */
export class LruCache<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(
    private readonly max: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {
    if (!Number.isInteger(max) || max < 1) throw new Error("LruCache needs a size of at least 1");
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  get(key: K): V | undefined {
    if (!this.entries.has(key)) return undefined;
    const value = this.entries.get(key) as V;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.max) {
      const [oldKey, oldValue] = this.entries.entries().next().value as [K, V];
      this.entries.delete(oldKey);
      this.onEvict?.(oldKey, oldValue);
    }
  }

  keys(): K[] {
    return [...this.entries.keys()];
  }
}
