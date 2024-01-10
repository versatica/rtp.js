import { Logger } from '../Logger';

const logger = new Logger('utils/helpers');

/**
 * Clones the given object/array/Buffer/etc.
 *
 * @category Utils
 * @hidden
 */
export function clone<T>(data: T): T {
	if (data instanceof ArrayBuffer) {
		return data.slice(0) as unknown as T;
	} else if (data instanceof DataView) {
		return new DataView(
			data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
		) as unknown as T;
	} else if (data === undefined) {
		return undefined as unknown as T;
	} else if (Number.isNaN(data)) {
		return NaN as unknown as T;
	} else if (typeof structuredClone === 'function') {
		// Available in Node >= 18.
		return structuredClone(data);
	} else {
		return JSON.parse(JSON.stringify(data));
	}
}

/**
 * TypeScript utility to assert that no `case X` is missing in a `switch()`
 * block.
 *
 * @category Utils
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assertUnreachable(_x: never): never {
	throw new Error(`we should not get here: ${_x}`);
}

/**
 * Returns the given size padded to 4 bytes.
 *
 * @category Utils
 */
export function padTo4Bytes(size: number): number {
	// If size is not multiple of 32 bits then pad it.
	if (size & 0x03) {
		return (size & 0xfffc) + 4;
	} else {
		return size;
	}
}

/**
 * Whether two DataViews contain the same data.
 *
 * @category Utils
 * @hidden
 */
export function areDataViewsEqual(view1: DataView, view2: DataView) {
	if (view1 === view2) {
		logger.debug(
			'areDataViewsEqual() | view1 and view2 are the same DataView instance',
		);

		return true;
	}

	if (view1.byteLength !== view2.byteLength) {
		if (logger.debug.enabled) {
			logger.debug(
				`areDataViewsEqual() | different byte length [view1.byteLength:${view1.byteLength}, view2.byteLength:${view2.byteLength}]`,
			);
			logger.debug('areDataViewsEqual() | view1:', view1);
			logger.debug('areDataViewsEqual() | view2:', view2);
		}

		return false;
	}

	let i = 0;

	while (i < view1.byteLength) {
		if (view1.getUint8(i) !== view2.getUint8(i)) {
			if (logger.debug.enabled) {
				logger.debug(
					`areDataViewsEqual() | different byte [idx:${i}, view1:${view1
						.getUint8(i)
						.toString(16)}, view2:${view2.getUint8(i).toString(16)}]`,
				);
				logger.debug('areDataViewsEqual() | view1:', view1);
				logger.debug('areDataViewsEqual() | view2:', view2);
			}

			return false;
		}

		i++;
	}

	return true;
}

/**
 * Convert Node.js Buffer to DataView using the same underlying ArrayBuffer.
 *
 * @category Utils
 * @remarks
 * - Just for Node.js.
 */
export function nodeBufferToDataView(nodeBuffer: Buffer): DataView {
	return new DataView(
		nodeBuffer.buffer,
		nodeBuffer.byteOffset,
		nodeBuffer.byteLength,
	);
}

/**
 * Convert DataView to Node.js Buffer using the same underlying ArrayBuffer.
 *
 * @category Utils
 * @remarks
 * - Just for Node.js.
 */
export function dataViewToNodeBuffer(view: DataView): Buffer {
	return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

/**
 * Convert Node.js Buffer to a new allocated ArrayBuffer.
 *
 * @category Utils
 * @remarks
 * - Just for Node.js.
 */
export function nodeBufferToArrayBuffer(nodeBuffer: Buffer): ArrayBuffer {
	return nodeBuffer.buffer.slice(
		nodeBuffer.byteOffset,
		nodeBuffer.byteOffset + nodeBuffer.byteLength,
	);
}

/**
 * Convert ArrayBuffer to Node.js Buffer.
 *
 * @category Utils
 * @remarks
 * - Just for Node.js.
 */
export function arrayBufferToNodeBuffer(arrayBuffer: ArrayBuffer): Buffer {
	return Buffer.from(arrayBuffer, 0, arrayBuffer.byteLength);
}

/**
 * Convert array of integers to DataView.
 *
 * @category Utils
 */
export function numericArrayToDataView(array: number[]): DataView {
	return new DataView(new Uint8Array(array).buffer);
}

/**
 * Convert number to DataView.
 *
 * @category Utils
 */
export function numberToDataView(number: number): DataView {
	const array: number[] = [];

	array.unshift(number & 255);

	while (number >= 256) {
		number = number >>> 8;

		array.unshift(number & 255);
	}

	const uint8Array = new Uint8Array(array);

	return new DataView(
		uint8Array.buffer,
		uint8Array.byteOffset,
		uint8Array.byteLength,
	);
}

/**
 * Convert DataView to string.
 *
 * @category Utils
 */
export function dataViewToString(view: DataView): string {
	const decoder = new TextDecoder();

	return decoder.decode(view);
}

/**
 * Convert ArrayBuffer to string.
 *
 * @category Utils
 */
export function arrayBufferToString(arrayBuffer: ArrayBuffer): string {
	const decoder = new TextDecoder();

	return decoder.decode(arrayBuffer);
}

/**
 * Convert string to DataView.
 *
 * @category Utils
 */
export function stringToDataView(string: string): DataView {
	const encoder = new TextEncoder();
	const uint8Array = encoder.encode(string);

	return new DataView(
		uint8Array.buffer,
		uint8Array.byteOffset,
		uint8Array.byteLength,
	);
}

/**
 * Convert string to ArrayBuffer.
 *
 * @category Utils
 * @hidden
 */
export function stringToArrayBuffer(string: string): ArrayBuffer {
	const encoder = new TextEncoder();

	return encoder.encode(string).buffer;
}

/**
 * Convert string to Uint8Array.
 *
 * @category Utils
 * @hidden
 */
export function stringToUint8Array(string: string): Uint8Array {
	const encoder = new TextEncoder();
	const uint8Array = encoder.encode(string);

	return new Uint8Array(
		uint8Array.buffer,
		uint8Array.byteOffset,
		uint8Array.byteLength,
	);
}

/**
 * Get the byte length of a string.
 *
 * @category Utils
 */
export function getStringByteLength(string: string): number {
	const encoder = new TextEncoder();
	const uint8Array = encoder.encode(string);

	return uint8Array.byteLength;
}
