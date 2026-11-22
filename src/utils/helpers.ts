/**
 * Returns the given size padded to 4 bytes.
 *
 * @category Utils
 */
export function padTo4Bytes(size: number): number {
	return (size + 3) & ~0x03;
}

/**
 * Whether the given value is an integer equal or greater than 0 and, if `max`
 * is given, equal or lower than `max`.
 *
 * @category Utils
 * @hidden
 */
export function isUnsignedInteger(value: number, max?: number): boolean {
	return (
		Number.isInteger(value) && value >= 0 && (max === undefined || value <= max)
	);
}

/**
 * Whether two buffers contain the same data.
 *
 * @category Utils
 * @hidden
 */
export function areBuffersEqual(
	buffer1: Uint8Array,
	buffer2: Uint8Array
): boolean {
	if (buffer1 === buffer2) {
		return true;
	}

	if (buffer1.byteLength !== buffer2.byteLength) {
		return false;
	}

	for (let idx = 0; idx < buffer1.byteLength; ++idx) {
		if (buffer1[idx] !== buffer2[idx]) {
			return false;
		}
	}

	return true;
}
