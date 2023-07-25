import { Logger } from './Logger';

const logger = new Logger('utils');

export function readBit(byte: number, bitPosition: number): boolean
{
	return (byte & (1 << bitPosition)) !== 0;
}

export function setBit(byte: number, bitPosition: number, bit: boolean): number
{
	if (bit)
	{
		return byte | (1 << bitPosition);
	}
	else
	{
		return byte & ~(1 << bitPosition);
	}
}

export function toggleBit(byte: number, bitPosition: number): number
{
	return byte ^ (1 << bitPosition);
}

/**
 * Clones the given object/array/Buffer/etc.
 */
export function clone<T>(data: T): T
{
	if (data instanceof ArrayBuffer)
	{
		return data.slice(0) as unknown as T;
	}
	else if (data instanceof DataView)
	{
		return new DataView(
			data.buffer.slice(
				data.byteOffset, data.byteOffset + data.byteLength
			)
		) as unknown as T;
	}
	else if (data === undefined)
	{
		return undefined as unknown as T;
	}
	else if (Number.isNaN(data))
	{
		return NaN as unknown as T;
	}
	else if (typeof structuredClone === 'function')
	{
		// Available in Node >= 18.
		return structuredClone(data);
	}
	else
	{
		return JSON.parse(JSON.stringify(data));
	}
}

/**
 * Returns the given size padded to 4 bytes.
 */
export function padTo4Bytes(size: number): number
{
	// If size is not multiple of 32 bits then pad it.
	if (size & 0x03)
	{
		return (size & 0xFFFC) + 4;
	}
	else
	{
		return size;
	}
}

/**
 * Whether two ArrayBuffers contain the same data.
 * NOTE: Only used by tests.
 * TODO: Probably remove.
 */
export function areBuffersEqual(buffer1: ArrayBuffer, buffer2: ArrayBuffer)
{
	if (buffer1 === buffer2)
	{
		logger.debug(
			'areBuffersEqual() | buffer1 and buffer2 are the same ArrayBuffer instance'
		);

		return true;
	}

	if (buffer1.byteLength !== buffer2.byteLength)
	{
		if (logger.debug.enabled)
		{
			logger.debug(
				`areBuffersEqual() | different buffer length [buffer1.byteLength:${buffer1.byteLength}, buffer2.byteLength:${buffer2.byteLength}]`
			);
			logger.debug('areBuffersEqual() | buffer1:', buffer1);
			logger.debug('areBuffersEqual() | buffer2:', buffer2);
		}

		return false;
	}

	const view1 = new DataView(buffer1);
	const view2 = new DataView(buffer2);

	let i = 0;

	while (i < view1.byteLength)
	{
		if (view1.getUint8(i) !== view2.getUint8(i))
		{
			if (logger.debug.enabled)
			{
				logger.debug(
					`areBuffersEqual() | different byte [idx:${i}, buffer1 byte:${view1.getUint8(i).toString(16)}, buffer2 byte:${view2.getUint8(i).toString(16)}]`
				);
				logger.debug('areBuffersEqual() | buffer1:', buffer1);
				logger.debug('areBuffersEqual() | buffer2:', buffer2);
			}

			return false;
		}

		i++;
	}

	return true;
}

/**
 * Whether two DataViews contain the same data.
 * NOTE: Only used by tests.
 */
export function areDataViewsEqual(view1: DataView, view2: DataView)
{
	if (view1 === view2)
	{
		logger.debug(
			'areDataViewsEqual() | view1 and view2 are the same DataView instance'
		);

		return true;
	}

	if (view1.byteLength !== view2.byteLength)
	{
		if (logger.debug.enabled)
		{
			logger.debug(
				`areDataViewsEqual() | different byte length [view1.byteLength:${view1.byteLength}, view2.byteLength:${view2.byteLength}]`
			);
			logger.debug('areDataViewsEqual() | view1:', view1);
			logger.debug('areDataViewsEqual() | view2:', view2);
		}

		return false;
	}

	let i = 0;

	while (i < view1.byteLength)
	{
		if (view1.getUint8(i) !== view2.getUint8(i))
		{
			if (logger.debug.enabled)
			{
				logger.debug(
					`areDataViewsEqual() | different byte [idx:${i}, view1:${view1.getUint8(i).toString(16)}, view2:${view2.getUint8(i).toString(16)}]`
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
 * Convert Node.js Buffer into ArrayBuffer.
 * NOTE: Just for Node.js.
 *
 * TODO: Remove in favour of bufferToDataView().
 */
export function nodeBufferToArrayBuffer(buffer: Buffer): ArrayBuffer
{
	return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Convert Node.js Buffer into DataView.
 * NOTE: Just for Node.js.
 */
export function nodeBufferToDataView(buffer: Buffer): DataView
{
	return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * Convert array of integers into ArrayBuffer.
 * NOTE: Only used by tests.
 * TODO: Probably remove.
 */
export function numericArrayToArrayBuffer(array: number[]): ArrayBuffer
{
	return (new Uint8Array(array)).buffer;
}

/**
 * Convert array of integers into DataView.
 * NOTE: Only used by tests.
 * TODO: Probably remove.
 */
export function numericArrayToDataView(array: number[]): DataView
{
	return new DataView((new Uint8Array(array)).buffer);
}

/**
 * Convert ArrayBuffer into string.
 * TODO: Probably remove.
 */
export function arrayBufferToString(buffer: ArrayBuffer): string
{
	const decoder = new TextDecoder();

	return decoder.decode(buffer);
}

/**
 * Convert string into ArrayBuffer.
 * TODO: Probably remove.
 */
export function stringToArrayBuffer(string: string): ArrayBuffer
{
	const encoder = new TextEncoder();

	return encoder.encode(string).buffer;
}

/**
 * Convert string into DataView.
 */
export function stringToDataView(string: string): DataView
{
	const encoder = new TextEncoder();
	const uint8Array = encoder.encode(string);

	return new DataView(
		uint8Array.buffer,
		uint8Array.byteOffset,
		uint8Array.byteLength
	);
}
