// Position of the lowest enabled bit of each byte mask (index), or -1 for mask
// 0. Computed once so masks are not inspected on every call.
const FIRST_ENABLED_BIT_IN_MASK = new Int8Array(256).map((_, mask) =>
	mask === 0 ? -1 : 31 - Math.clz32(mask & -mask)
);

/**
 * Read the value of `bit` position of `value`.
 *
 * @category Utils
 * @hidden
 */
export function readBit(value: number, bit: number): boolean {
	return (value & (1 << bit)) !== 0;
}

/**
 * Write `flag` in `bit` position of `value` and return updated value.
 *
 * @category Utils
 * @hidden
 */
export function writeBit(value: number, bit: number, flag: boolean): number {
	if (flag) {
		return value | (1 << bit);
	} else {
		return value & ~(1 << bit);
	}
}

/**
 * Toggle value of `bit` position of `value` and return updated value.
 *
 * @category Utils
 * @hidden
 */
export function toggleBit(value: number, bit: number): number {
	return value ^ (1 << bit);
}

/**
 * Read the value of the enabled bits of `mask` of byte `byte`.
 *
 * @category Utils
 * @hidden
 */
export function readBits(byte: number, mask: number): number {
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
export function writeBits(byte: number, mask: number, value: number): number {
	const inverseMask = mask ^ 0b11111111;
	const bitsToShift = getFirstEnabledBitInMask(mask);

	return (byte & inverseMask) | ((value << bitsToShift) & mask);
}

/**
 * Read the value of `bit` position of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function readBitInDataView(
	view: DataView,
	pos: number,
	bit: number
): boolean {
	return readBit(view.getUint8(pos), bit);
}

/**
 * Write `flag` in `bit` position of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function writeBitInDataView(
	view: DataView,
	pos: number,
	bit: number,
	flag: boolean
): void {
	view.setUint8(pos, writeBit(view.getUint8(pos), bit, flag));
}

/**
 * Toggle value of `bit` position of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function toggleBitInDataView(
	view: DataView,
	pos: number,
	bit: number
): void {
	view.setUint8(pos, toggleBit(view.getUint8(pos), bit));
}

/**
 * Read the value of the enabled bits of `mask` of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function readBitsInDataView(
	view: DataView,
	pos: number,
	mask: number
): number {
	return readBits(view.getUint8(pos), mask);
}

/**
 * Write `value` in the enabled bits of `mask` of byte `pos` in `view`.
 *
 * @category Utils
 * @hidden
 */
export function writeBitsInDataView(
	view: DataView,
	pos: number,
	mask: number,
	value: number
): void {
	view.setUint8(pos, writeBits(view.getUint8(pos), mask, value));
}

function getFirstEnabledBitInMask(mask: number): number {
	// NOTE: Mask 0 gives -1, and a negative, greater than 0b11111111 or not
	// integer mask gives undefined.
	const bit = FIRST_ENABLED_BIT_IN_MASK[mask];

	if (bit === undefined || bit === -1) {
		throw new TypeError(`invalid byte mask ${mask}`);
	}

	return bit;
}
