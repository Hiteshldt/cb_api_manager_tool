'use strict';

/**
 * Get value from object using dot-notation path.
 * Supports: "temp", "device.metrics.temp", "items[0].value"
 */
function get(obj, dotPath) {
  if (!dotPath || dotPath === '') return obj;
  const parts = dotPath.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    const arrMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrMatch) {
      const [, key, idx] = arrMatch;
      cur = cur[key]?.[parseInt(idx)];
    } else {
      cur = cur[part];
    }
  }
  return cur;
}

/**
 * Set value in object using dot-notation path (mutates obj).
 * Creates nested objects as needed.
 */
function set(obj, dotPath, value) {
  if (!dotPath || dotPath === '') return;
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] === undefined || typeof cur[part] !== 'object' || cur[part] === null) {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

module.exports = { get, set };
