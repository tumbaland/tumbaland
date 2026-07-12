// Jest's CJS module loader can't require the real `uuid` package (ESM-only
// since v9), which @tumbaland/backend-core pulls in transitively. Node itself
// supports require(esm) at runtime, but Jest doesn't — swap in Node's
// built-in UUID generator for tests only.
const crypto = require('crypto');

module.exports = {
  v4: () => crypto.randomUUID()
};
