/**
 * Structural sharing for refetched data. `stabilize(prev, next)` returns `prev` itself when `next` is
 * deeply equal to it, and otherwise a copy of `next` in which every unchanged subtree is the very same
 * object as in `prev`. Passed to a state setter, an unchanged refetch then keeps every reference, so React
 * bails out and nothing re-renders; a refetch with one new value re-renders only what reads that value.
 *
 * Handles the shapes the dashboard fetches: plain objects, arrays, Maps, Sets, Dates and primitives.
 */
export function stabilize<T>(prev: T, next: T): T {
  if (Object.is(prev, next)) return prev;
  return share(prev, next) as T;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

function share(prev: unknown, next: unknown): unknown {
  if (Object.is(prev, next)) return prev;
  if (prev === null || next === null || typeof prev !== "object" || typeof next !== "object") return next;

  if (prev instanceof Date && next instanceof Date) return prev.getTime() === next.getTime() ? prev : next;

  if (Array.isArray(prev) && Array.isArray(next)) {
    let same = prev.length === next.length;
    const out = next.map((item, i) => {
      const shared = i < prev.length ? share(prev[i], item) : item;
      if (same && !Object.is(shared, prev[i])) same = false;
      return shared;
    });
    return same ? prev : out;
  }

  if (prev instanceof Map && next instanceof Map) {
    let same = prev.size === next.size;
    const out = new Map<unknown, unknown>();
    for (const [key, value] of next) {
      const shared = prev.has(key) ? share(prev.get(key), value) : value;
      if (same && (!prev.has(key) || !Object.is(shared, prev.get(key)))) same = false;
      out.set(key, shared);
    }
    return same ? prev : out;
  }

  if (prev instanceof Set && next instanceof Set) {
    if (prev.size === next.size && [...next].every((v) => prev.has(v))) return prev;
    return next;
  }

  if (isPlainObject(prev) && isPlainObject(next)) {
    const nextKeys = Object.keys(next);
    let same = Object.keys(prev).length === nextKeys.length;
    const out: Record<string, unknown> = {};
    for (const key of nextKeys) {
      const shared = key in prev ? share(prev[key], next[key]) : next[key];
      if (same && (!(key in prev) || !Object.is(shared, prev[key]))) same = false;
      out[key] = shared;
    }
    return same ? prev : out;
  }

  return next;
}
