/**
 * Read 3 bytes starting from byte `pos` in `view` as unsigned value.
 */
export function read3BytesInDataView(view: DataView, pos: number): number {
	return (view.getUint8(pos) << 16) + view.getUint16(pos + 1);
}

/**
 * Write an unsigned value in 3 bytes starting from byte `pos` in `view`.
 */
export function write3BytesInDataView(
	view: DataView,
	pos: number,
	value: number
): void {
	view.setUint8(pos, value >> 16);
	view.setUint16(pos + 1, value);
}

/**
 * Read 3 bytes starting from byte `pos` in `view` as signed value.
 */
export function readSigned3BytesInDataView(
	view: DataView,
	pos: number
): number {
	const byte2 = view.getUint8(pos);
	const byte1 = view.getUint8(pos + 1);
	const byte0 = view.getUint8(pos + 2);

	// Check bit 7 (sign).
	const extension = byte2 & 0b10000000 ? 0b11111111 : 0b00000000;

	return byte0 | (byte1 << 8) | (byte2 << 16) | (extension << 24);
}

/**
 * Write a signed value in 3 bytes starting from byte `pos` in `view`.
 */
export function writeSigned3BytesInDataView(
	view: DataView,
	pos: number,
	value: number
): void {
	view.setInt8(pos, value >> 16);
	view.setUint16(pos + 1, value);
}
