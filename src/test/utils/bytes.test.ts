import {
	read3BytesInDataView,
	write3BytesInDataView,
	readSigned3BytesInDataView,
	writeSigned3BytesInDataView,
} from '../../utils/bytes';

let view: DataView;

beforeEach(() => {
	const array = new Uint8Array([
		0b00000000, 0b00000001, 0b00000010, 0b00000011, 0b10000000, 0b01000000,
		0b00100000, 0b00010000, 0b01111111, 0b11111111, 0b11111111, 0b00000000,
		0b11111111, 0b11111111, 0b11111111, 0b00000000, 0b10000000, 0b00000000,
		0b00000000, 0b00000000,
	]);

	view = new DataView(array.buffer, array.byteOffset, array.byteLength);
});

test('read3BytesInDataView()', () => {
	// Bytes 4, 5 and 6 in the array are number 8405024.
	expect(read3BytesInDataView(view, 4)).toBe(8405024);
});

test('write3BytesInDataView()', () => {
	write3BytesInDataView(view, 4, 5666777);

	expect(read3BytesInDataView(view, 4)).toBe(5666777);
});

test('readSigned3BytesInDataView()', () => {
	// Bytes 8, 9 and 10 in the array are number 8388607 since first bit is 0
	// and all other bits are 1, so it must be maximum positive 24 bits signed
	// integer, which is Math.pow(2, 23) - 1 = 8388607.
	expect(readSigned3BytesInDataView(view, 8)).toBe(8388607);

	// Bytes 12, 13 and 14 in the array are number -1.
	expect(readSigned3BytesInDataView(view, 12)).toBe(-1);

	// Bytes 16, 17 and 18 in the array are number -8388608 since first bit is
	// 1 and all other bits are 0, so it must be minimum negative 24 bits signed
	// integer, which is -1 * Math.pow(2, 23) = -8388608.
	expect(readSigned3BytesInDataView(view, 16)).toBe(-8388608);
});

test('writeSigned3BytesInDataView()', () => {
	writeSigned3BytesInDataView(view, 0, 8388607);

	expect(readSigned3BytesInDataView(view, 0)).toBe(8388607);

	writeSigned3BytesInDataView(view, 0, -1);

	expect(readSigned3BytesInDataView(view, 0)).toBe(-1);

	writeSigned3BytesInDataView(view, 0, -8388608);

	expect(readSigned3BytesInDataView(view, 0)).toBe(-8388608);
});
