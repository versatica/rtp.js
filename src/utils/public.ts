/**
 * @module utils
 *
 * @example
 * ```ts
 * import * as packets from 'rtp.js/packets';
 *
 * const {
 *   padTo4Bytes,
 *   nodeBufferToDataView,
 *   dataViewToNodeBuffer,
 *   nodeBufferToArrayBuffer,
 *   arrayBufferToNodeBuffer,
 *   numericArrayToDataView,
 *   numberToDataView,
 *   dataViewToString,
 *   arrayBufferToString,
 *   stringToDataView,
 *   getStringByteLength,
 *   // etc.
 * } = utils;
 * ```
 */

export {
	padTo4Bytes,
	nodeBufferToDataView,
	dataViewToNodeBuffer,
	nodeBufferToArrayBuffer,
	arrayBufferToNodeBuffer,
	numericArrayToDataView,
	numberToDataView,
	dataViewToString,
	arrayBufferToString,
	stringToDataView,
	getStringByteLength,
} from './helpers';
