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
/**
 * Returns the given size padded to 4 bytes.
 */
function padTo4Bytes(size) {
    // If size is not multiple of 32 bits then pad it.
    if (size & 0x03) {
        return (size & 0xFFFC) + 4;
    }
    else {
        return size;
    }
}
exports.padTo4Bytes = padTo4Bytes;
