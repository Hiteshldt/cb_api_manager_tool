'use strict';
const vm       = require('vm');
const jsonPath = require('./jsonPath');

/**
 * Safely evaluate a math expression against source data.
 *
 * ── Variables available inside expressions ────────────────────────────────
 *   Top-level source fields (valid JS identifiers) — used directly:
 *       d1  temperature  humidity  pm25
 *
 *   Nested access — two ways:
 *       data.sensors.pm25          (dot-path on the `data` object)
 *       field('sensors.pm25')      (string-path helper)
 *
 * ── Math functions ─────────────────────────────────────────────────────────
 *   abs(x)           — absolute value
 *   round(x, d=0)    — round to d decimal places
 *   floor(x)         — floor
 *   ceil(x)          — ceiling
 *   sqrt(x)          — square root
 *   pow(base, exp)   — exponentiation  (also ** operator)
 *   log(x)           — natural log
 *   log2(x)          — log base 2
 *   log10(x)         — log base 10
 *   min(a, b, …)     — minimum of values
 *   max(a, b, …)     — maximum of values
 *   sin(x) cos(x) tan(x)  asin(x) acos(x) atan(x) atan2(y,x)
 *
 * ── Helper functions ───────────────────────────────────────────────────────
 *   clamp(v, lo, hi)       — keep v inside [lo, hi]
 *   ifNull(v, fallback)    — return fallback when v is null/undefined/NaN
 *   pct(part, total)       — percentage: (part / total) * 100
 *   scale(v, inLo, inHi, outLo, outHi) — map v from one range to another
 *   avg(...values)         — arithmetic mean
 *
 * ── Constants ──────────────────────────────────────────────────────────────
 *   PI   E
 *
 * ── Operators & syntax ─────────────────────────────────────────────────────
 *   + - * / ** %   parentheses   ternary: cond ? a : b
 *
 * @param {string} expression  — math expression to evaluate
 * @param {object} sourceData  — raw data from the source
 * @returns {{ result: *, error: string|undefined }}
 */
function evalExpr(expression, sourceData) {
  if (!expression || typeof expression !== 'string') {
    return { result: null, error: 'Empty expression' };
  }

  // Determine the correct 'data' context object.
  // If the source JSON has a nested 'data' object (very common in IoT feeds),
  // bind the 'data' context variable to that inner object instead of the root.
  let dataContext = sourceData ?? {};
  if (sourceData && typeof sourceData.data === 'object' && sourceData.data !== null && !Array.isArray(sourceData.data)) {
    dataContext = sourceData.data;
  }

  const ctx = {
    // ── Math functions ──────────────────────────────────────────────────
    abs:   (x)        => Math.abs(x),
    round: (x, d = 0) => d ? Math.round(x * 10 ** d) / 10 ** d : Math.round(x),
    floor: (x)        => Math.floor(x),
    ceil:  (x)        => Math.ceil(x),
    sqrt:  (x)        => Math.sqrt(x),
    pow:   (b, e)     => Math.pow(b, e),
    log:   (x)        => Math.log(x),
    log2:  (x)        => Math.log2(x),
    log10: (x)        => Math.log10(x),
    min:   (...a)     => Math.min(...a),
    max:   (...a)     => Math.max(...a),
    sin:   (x)        => Math.sin(x),
    cos:   (x)        => Math.cos(x),
    tan:   (x)        => Math.tan(x),
    asin:  (x)        => Math.asin(x),
    acos:  (x)        => Math.acos(x),
    atan:  (x)        => Math.atan(x),
    atan2: (y, x)     => Math.atan2(y, x),

    // ── Constants ───────────────────────────────────────────────────────
    PI: Math.PI,
    E:  Math.E,

    // ── Helper functions ────────────────────────────────────────────────
    clamp:  (v, lo, hi)                    => Math.min(Math.max(Number(v), lo), hi),
    ifNull: (v, fallback)                  => (v == null || (typeof v === 'number' && isNaN(v))) ? fallback : v,
    pct:    (part, total)                  => total !== 0 ? (Number(part) / Number(total)) * 100 : 0,
    scale:  (v, inLo, inHi, outLo, outHi) => outLo + ((Number(v) - inLo) / (inHi - inLo)) * (outHi - outLo),
    avg:    (...vals)                      => vals.reduce((s, x) => s + Number(x), 0) / vals.length,

    // ── Data access helpers ─────────────────────────────────────────────
    field: (path) => jsonPath.get(sourceData, path),  // field('nested.key')
    data:  dataContext,                               // data.sensors.pm25
  };

  // Expose top-level source fields as direct variable names
  // (only if the key is a valid JS identifier and not already taken by a helper)
  if (sourceData && typeof sourceData === 'object' && !Array.isArray(sourceData)) {
    for (const [key, val] of Object.entries(sourceData)) {
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) && !(key in ctx)) {
        ctx[key] = val;
      }
    }
  }

  // Also expose nested fields under 'data' directly as variable names if 'data' is an object
  if (sourceData && typeof sourceData.data === 'object' && sourceData.data !== null && !Array.isArray(sourceData.data)) {
    for (const [key, val] of Object.entries(sourceData.data)) {
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) && !(key in ctx)) {
        ctx[key] = val;
      }
    }
  }

  try {
    vm.createContext(ctx);
    const result = vm.runInContext(expression, ctx, { timeout: 100 });

    if (result == null)               return { result: null };
    if (typeof result === 'number') {
      if (isNaN(result))              return { result: null, error: 'Result is NaN — check divisors or sqrt of negative' };
      if (!isFinite(result))          return { result: null, error: 'Result is Infinity — check division by zero' };
      return { result };
    }
    if (typeof result === 'string' || typeof result === 'boolean') return { result };
    return { result: null, error: 'Expression must return a number, string, or boolean' };

  } catch (err) {
    return { result: null, error: err.message };
  }
}

module.exports = { evalExpr };
