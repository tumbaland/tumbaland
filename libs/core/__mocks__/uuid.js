// Jest's CJS module loader can't require the real `uuid` package (ESM-only
// since v9) — Node itself supports require(esm) at runtime, but Jest doesn't.
// Swap in Node's built-in UUID generator for tests only.
const crypto = require('crypto');

module.exports = {
  v4: () => crypto.randomUUID()
};
