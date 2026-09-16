import { createHash } from 'node:crypto'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/** In-memory TTL cache for identical (tool + prompt + images + options) requests. */
export class ResultCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>()

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 50
  ) {}

  get enabled(): boolean {
    return this.ttlMs > 0
  }

  get(key: string): T | undefined {
    if (!this.enabled) {
      return undefined
    }

    const entry = this.store.get(key)
    if (!entry) {
      return undefined
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return undefined
    }

    return entry.value
  }

  set(key: string, value: T): void {
    if (!this.enabled) {
      return
    }

    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey)
      }
    }

    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }
}

export function buildCacheKey(parts: unknown): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex')
}
