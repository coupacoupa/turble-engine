/**
 * TEL value model — JSON values only. This is the portability contract with the
 * future Rust engine: no undefined, no functions, no Date. Numbers are IEEE-754 f64.
 */
export type Value = null | boolean | number | string | Value[] | { [key: string]: Value };

/** Falsy: null, false, 0, NaN, ''. Everything else (including [] and {}) is truthy. */
export function truthy(v: Value): boolean {
  if (v === null || v === false) return false;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (typeof v === 'string') return v.length > 0;
  return true;
}

export function typeName(v: Value): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v; // 'boolean' | 'number' | 'string' | 'object'
}

/** Structural equality. Same-type only — number 1 never equals string '1' in TEL. */
export function deepEquals(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((el, i) => deepEquals(el, b[i] as Value));
  }
  if (typeof a === 'object') {
    if (typeof b !== 'object' || Array.isArray(b)) return false;
    const ak = Object.keys(a);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEquals(a[k] as Value, (b as { [key: string]: Value })[k] as Value));
  }
  return false;
}

/** Coerce an arbitrary host value (e.g. user JSON input) into the TEL value space. */
export function toValue(v: unknown): Value {
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === 'boolean' || t === 'string') return v as Value;
  if (t === 'number') return Number.isFinite(v as number) ? (v as number) : null;
  if (Array.isArray(v)) return v.map(toValue);
  if (t === 'object') {
    const out: { [key: string]: Value } = {};
    for (const [k, val] of Object.entries(v as object)) out[k] = toValue(val);
    return out;
  }
  return null;
}
