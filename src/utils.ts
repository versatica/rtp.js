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
			return false;
		}
	}

	return true;
}
