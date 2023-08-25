import {
	read3BytesInDataView,
	write3BytesInDataView
} from '../../utils/byteOps';

let view: DataView;

beforeEach(() =>
{
	const array = new Uint8Array(
		[
			0b00000000, 0b00000001, 0b00000010, 0b00000011,
			0b10000000, 0b01000000, 0b00100000, 0b00010000
		]
	);

	view = new DataView(
		array.buffer,
		array.byteOffset,
		array.byteLength
	);
});

test('read3BytesInDataView()', () =>
{
	// Bytes 4,5 and 6 in the array are number 8405024.
	expect(read3BytesInDataView({ view, pos: 4 })).toBe(8405024);
});

test('write3BytesInDataView()', () =>
{
	write3BytesInDataView({ view, pos: 1, value: 8405024 });
	expect(read3BytesInDataView({ view, pos: 1 })).toBe(8405024);
});
