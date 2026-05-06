// Applies util polyfill before tfjs-node loads, then runs the training script.
// CommonJS wrapper so the patch runs synchronously before ESM imports hoist.
const util = require('util');
if (!util.isNullOrUndefined) {
  util.isNullOrUndefined = (v) => v === null || v === undefined;
}
if (!util.isNull) util.isNull = (v) => v === null;
if (!util.isUndefined) util.isUndefined = (v) => v === undefined;

// Now import the ESM training script
import('/Users/sawx/Documents/Coding/drumia/scripts/trainDrumModel.ts').catch(err => {
  console.error(err);
  process.exit(1);
});
