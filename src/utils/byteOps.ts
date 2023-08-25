/**
 * Read 3 bytes starting from byte `pos` in `view` as unsigned value.
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
 * Write a unsigned value in 3 bytes starting from byte `pos` in `view`.
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
