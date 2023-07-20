/**
 * Clones the given object/array/Buffer/etc.
 */
export function clone<T>(data: T): T
{
	if (data instanceof ArrayBuffer)
	{
		return data.slice(0, data.byteLength) as unknown as T;
	}
	else if (data instanceof DataView)
	{
		return new DataView(data.buffer) as unknown as T;
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
 */
export function areBuffersEqual(buffer1: ArrayBuffer, buffer2: ArrayBuffer)
{
	if (buffer1 === buffer2)
	{
		return true;
	}

	if (buffer1.byteLength !== buffer2.byteLength)
	{
		return false;
	}

	const view1 = new DataView(buffer1);
	const view2 = new DataView(buffer2);

	let i = buffer1.byteLength;

	while (i--)
	{
		if (view1.getUint8(i) !== view2.getUint8(i))
		{
			console.log('buffer1:', buffer1);
			console.log('buffer2:', buffer2);
			console.log('i:%s, buffer1:0x%s, buffer2:0x%s', i, view1.getUint8(i).toString(16), view2.getUint8(i).toString(16))
			return false;
		}
	}

	return true;
}

/**
 * Convert Node.js Buffer into ArrayBuffer.
 * NOTE: Just for Node.js.
 */
export function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer
{
	return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Convert Array into ArrayBuffer.
 * NOTE: Only used by tests.
 */
export function numericArrayToArrayBuffer(array: number[]): ArrayBuffer
{
	return (new Uint8Array(array)).buffer;
}

/**
 * Convert ArrayBuffer into string.
 */
export function arrayBufferToString(buffer: ArrayBuffer): string
{
	const decoder = new TextDecoder();

	return decoder.decode(buffer);
}

/**
 * Convert string into ArrayBuffer.
 */
export function stringToArrayBuffer(string: string): ArrayBuffer
{
	const encoder = new TextEncoder();

	return encoder.encode(string).buffer;
}
