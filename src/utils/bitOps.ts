/**
 * Read the value of `bit` position` of `value`.
 *
 * @category Utils
 * @hidden
 */
export function readBit({ value, bit }:{ value: number; bit: number }): boolean
{
	return (value & (1 << bit)) ? true : false;
}

/**
 * Write `flag` in `bit` position` of `value` and return updated value.
 *
 * @category Utils
 * @hidden
 */
export function writeBit(
	{ value, bit, flag }:
	{ value: number; bit: number; flag: boolean }
): number
{
	if (flag)
	{
		return value | (1 << bit);
	}
	else
	{
		return value & ~(1 << bit);
	}
}

/**
 * Toggle value of `bit` position` of `value` and return update value.
 *
 * @category Utils
 * @hidden
 */
export function toggleBit(
	{ value, bit }:
	{ value: number; bit: number }
): number
{
	return value ^ (1 << bit);
}

/**
 * Read the value of the enabled bits of `mask` of byte `byte`.
 *
 * @category Utils
 * @hidden
 */
export function readBits(
	{ byte, mask }:
	{ byte: number; mask: number }
): number
{
	const bitsToShift = getFirstEnabledBitInMask(mask);

	return (byte & mask) >> bitsToShift;
}

/**
 * Write `value` in the enabled bits of `mask` of byte `byte` and return
 * updated value.
 *
 * @category Utils
 * @hidden
 */
export function writeBits(
	{ byte, mask, value }:
	{ byte: number; mask: number; value: number }
): number
{
	const inverseMask = mask ^ 0b11111111;
	const bitsToShift = getFirstEnabledBitInMask(mask);

	return (byte & inverseMask) | ((value << bitsToShift) & mask);
}

/**
 * Read the value of `bit` position` of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function readBitInDataView(
	{ view, pos, bit }:
	{ view: DataView; pos: number; bit: number }
): boolean
{
	return readBit({ value: view.getUint8(pos), bit });
}

/**
 * Write `flag` in `bit` position` of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function writeBitInDataView(
	{ view, pos, bit, flag }:
	{ view: DataView; pos: number; bit: number; flag: boolean }
): void
{
	view.setUint8(pos, writeBit({ value: view.getUint8(pos), bit, flag }));
}

/**
 * Toggle value of `bit` position` of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function toggleBitInDataView(
	{ view, pos, bit }:
	{ view: DataView; pos: number; bit: number }
): void
{
	view.setUint8(pos, toggleBit({ value: view.getUint8(pos), bit }));
}

/**
 * Read the value of the enabled bits of `mask` of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function readBitsInDataView(
	{ view, pos, mask }:
	{ view: DataView; pos: number; mask: number }
): number
{
	return readBits({ byte: view.getUint8(pos), mask });
}

/**
 * Write `value` in the enabled bits of `mask` of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function writeBitsInDataView(
	{ view, pos, mask, value }:
	{ view: DataView; pos: number; mask: number; value: number }
): void
{
	view.setUint8(pos, writeBits({ byte: view.getUint8(pos), mask, value }));
}

/**
 * Read 3 bytes starting from byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function read3BytesInDataView(
	{ view, pos }:
	{ view: DataView; pos: number }
): number
{
	return (view.getUint8(pos) << 16) + view.getUint16(pos + 1);
}

/**
 * Write 3 bytes starting from byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function write3BytesInDataView(
	{ view, pos, value }:
	{ view: DataView; pos: number; value: number }
): void
{
	view.setUint8(pos, value >> 16);
	view.setUint16(pos + 1, value);
}

function getFirstEnabledBitInMask(mask: number): number
{
	if (mask === 0 || mask > 0b11111111)
	{
		throw new TypeError(`invalid byte mask 0b${mask.toString(2)}`);
	}

	for (let bit = 0; bit < 8; ++bit)
	{
		if (mask & (1 << bit))
		{
			return bit;
		}
	}

	// This should not happen unless given mask is 0.
	throw new Error(`no enabled bit found in byte mask 0b${mask.toString(2)}`);
}
