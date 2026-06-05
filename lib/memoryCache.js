/**
 * Simple in-memory TTL cache for expensive loaders (Google Sheets CSV, scoring context).
 */
function createMemoryCache(ttlMs, label = "cache") {
  const store = new Map();
  const ttl = Math.max(1000, Number(ttlMs) || 60_000);

  return {
    async get(key, loader) {
      const k = String(key);
      const hit = store.get(k);
      if (hit && Date.now() < hit.expiresAt) {
        return hit.value;
      }
      const value = await loader();
      store.set(k, { value, expiresAt: Date.now() + ttl });
      return value;
    },
    clear() {
      store.clear();
    },
    invalidate(key) {
      store.delete(String(key));
    },
    stats() {
      return { label, entries: store.size, ttlMs: ttl };
    },
  };
}

module.exports = { createMemoryCache };
