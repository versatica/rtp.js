/**
 * Whether the given value is an integer equal or greater than 0 and, if `max`
 * is given, equal or lower than `max`.
 */
export function isUnsignedInteger(value: number, max?: number): boolean {
	return (
		Number.isInteger(value) && value >= 0 && (max === undefined || value <= max)
	);
}

/**
 * Whether the given value is an unsigned 8 bits integer.
 */
export function isUnsignedInteger8(value: number): boolean {
	return Number.isInteger(value) && value >= 0 && value <= 0xff;
}

/**
 * Whether the given value is an unsigned 16 bits integer.
 */
export function isUnsignedInteger16(value: number): boolean {
	return Number.isInteger(value) && value >= 0 && value <= 0xffff;
}

/**
 * Whether the given value is an unsigned 24 bits integer.
 */
export function isUnsignedInteger24(value: number): boolean {
	return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

/**
 * Whether the given value is an unsigned 32 bits integer.
 */
export function isUnsignedInteger32(value: number): boolean {
	return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

/**
 * Whether the given value is a signed 32 bits integer.
 */
export function isSignedInteger32(value: number): boolean {
	return Number.isInteger(value) && value >= -0x80000000 && value <= 0x7fffffff;
}
