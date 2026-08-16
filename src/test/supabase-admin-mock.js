import { vi } from "vitest";

// Lightweight stand-in for the @supabase/supabase-js query builder.
// `tables[tableName]` is a function `(calls) => ({ data, error })` where `calls`
// is the ordered list of { method, args } invoked on that particular
// `.from(tableName)` chain — lets a single test disambiguate multiple queries
// against the same table by inspecting which columns/filters were used.
// `rpc[fnName]` is a function `(args) => ({ data, error })`.
export function createSupabaseAdminMock({ tables = {}, rpc = {} } = {}) {
  function eqValue(calls, key) {
    return calls.find((c) => c.method === "eq" && c.args[0] === key)?.args[1];
  }

  function makeBuilder(table) {
    const calls = [];
    const builder = {};
    const chainMethods = [
      "select", "eq", "neq", "in", "order", "limit", "insert", "update", "delete", "upsert",
      "gt", "gte", "lt", "lte", "or", "is", "not", "ilike",
    ];
    for (const method of chainMethods) {
      builder[method] = vi.fn((...args) => {
        calls.push({ method, args });
        return builder;
      });
    }
    const resolve = () => {
      const handler = tables[table];
      const result = typeof handler === "function"
        ? handler({ calls, eqValue: (key) => eqValue(calls, key) })
        : (handler || { data: null, error: null });
      return Promise.resolve(result ?? { data: null, error: null });
    };
    builder.maybeSingle = vi.fn(() => resolve());
    builder.single = vi.fn(() => resolve());
    builder.then = (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected);
    builder.catch = (onRejected) => resolve().catch(onRejected);
    return builder;
  }

  return {
    from: vi.fn((table) => makeBuilder(table)),
    rpc: vi.fn((name, args) => {
      const handler = rpc[name];
      const result = typeof handler === "function" ? handler(args) : (handler || { data: null, error: null });
      return Promise.resolve(result ?? { data: null, error: null });
    }),
  };
}
