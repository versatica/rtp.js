/**
 * Clones the given object/array/Buffer/etc.
 */
export function clone(data: any): any
{
	if (Buffer.isBuffer(data))
	{
		return Buffer.from(data);
	}
	else if (data === undefined)
	{
		return undefined;
	}
	else if (Number.isNaN(data))
	{
		return NaN;
	}
	else
	{
		return JSON.parse(JSON.stringify(data));
	}
}
