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
