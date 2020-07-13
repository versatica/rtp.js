"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Clones the given object/array/Buffer/etc.
 */
function clone(data) {
    if (Buffer.isBuffer(data)) {
        return Buffer.from(data);
    }
    else if (data === undefined) {
        return undefined;
    }
    else if (Number.isNaN(data)) {
        return NaN;
    }
    else {
        return JSON.parse(JSON.stringify(data));
    }
}
exports.clone = clone;
