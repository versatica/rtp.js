/**
 * Read the value of `bit` position` of byte `byte` in `view`.
 */
export function readBit(
	{ view, byte, bit }:
	{ view: DataView; byte: number; bit: number }
): boolean
{
	return (view.getUint8(byte) & (1 << bit)) ? true : false;
}

/**
 * Write `flag` in `bit` position` of byte `byte` in `view`.
 */
export function writeBit(
	{ view, byte, bit, flag }:
	{ view: DataView; byte: number; bit: number; flag: boolean }
): void
{
	if (flag)
	{
		view.setUint8(byte, view.getUint8(byte) | (1 << bit));
	}
	else
	{
		view.setUint8(byte, view.getUint8(byte) & ~(1 << bit));
	}
}

/**
 * Toggle value of `bit` position` of byte `byte` in `view`.
 */
export function toggleBit(
	{ view, byte, bit }:
	{ view: DataView; byte: number; bit: number }
): void
{
	view.setUint8(byte, view.getUint8(byte) ^ (1 << bit));
}

/**
 * Read the value of the enabled bits of `mask` of byte `byte` in `view`.
 */
export function readBits(
	{ view, byte, mask }:
	{ view: DataView; byte: number; mask: number }
): number
{
	const bitsToShift = getFirstEnabledBitInMask(mask);

	return (view.getUint8(byte) & mask) >> bitsToShift;
}

/**
 * Write `value` in the enabled bits of `mask` of byte `byte` in `view`.
 */
export function writeBits(
	{ view, byte, mask, value }:
	{ view: DataView; byte: number; mask: number; value: number }
): void
{
	const inverseMask = mask ^ 0b11111111;
	const bitsToShift = getFirstEnabledBitInMask(mask);

	view.setUint8(
		byte,
		(view.getUint8(byte) & inverseMask) | ((value << bitsToShift) & mask)
	);
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
