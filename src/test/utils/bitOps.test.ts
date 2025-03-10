import {
	readBitInDataView,
	writeBitInDataView,
	readBitsInDataView,
	writeBitsInDataView,
} from '../../utils/bitOps.ts';

let view: DataView;

beforeEach(() => {
	const array = new Uint8Array([
		0b00000000, 0b00000001, 0b00000010, 0b00000011, 0b10000000, 0b01000000,
		0b00100000, 0b00010000,
	]);

	view = new DataView(array.buffer, array.byteOffset, array.byteLength);
});

test('readBitInDataView()', () => {
	expect(readBitInDataView({ view, pos: 0, bit: 0 })).toBe(false);
	expect(readBitInDataView({ view, pos: 0, bit: 7 })).toBe(false);
	expect(readBitInDataView({ view, pos: 1, bit: 0 })).toBe(true);
	expect(readBitInDataView({ view, pos: 1, bit: 7 })).toBe(false);
	expect(readBitInDataView({ view, pos: 2, bit: 0 })).toBe(false);
	expect(readBitInDataView({ view, pos: 2, bit: 1 })).toBe(true);
	expect(readBitInDataView({ view, pos: 2, bit: 7 })).toBe(false);
	expect(readBitInDataView({ view, pos: 3, bit: 0 })).toBe(true);
	expect(readBitInDataView({ view, pos: 3, bit: 1 })).toBe(true);
	expect(readBitInDataView({ view, pos: 3, bit: 7 })).toBe(false);
	expect(readBitInDataView({ view, pos: 4, bit: 0 })).toBe(false);
	expect(readBitInDataView({ view, pos: 4, bit: 7 })).toBe(true);
	expect(readBitInDataView({ view, pos: 5, bit: 6 })).toBe(true);
	expect(readBitInDataView({ view, pos: 6, bit: 5 })).toBe(true);
	expect(readBitInDataView({ view, pos: 7, bit: 4 })).toBe(true);
});

test('writeBitInDataView()', () => {
	writeBitInDataView({ view, pos: 0, bit: 0, flag: true });
	expect(readBitInDataView({ view, pos: 0, bit: 0 })).toBe(true);
	expect(readBitInDataView({ view, pos: 0, bit: 7 })).toBe(false);

	writeBitInDataView({ view, pos: 0, bit: 7, flag: true });
	expect(readBitInDataView({ view, pos: 0, bit: 0 })).toBe(true);
	expect(readBitInDataView({ view, pos: 0, bit: 7 })).toBe(true);
});

test('readBitsInDataView()', () => {
	// Must throw if mask has no enabled bit.
	expect(() => readBitsInDataView({ view, pos: 0, mask: 0b00000000 })).toThrow(
		TypeError
	);

	// Must throw if mask has is bigger than 0b11111111.
	expect(() => readBitsInDataView({ view, pos: 0, mask: 0b100000000 })).toThrow(
		TypeError
	);

	expect(readBitsInDataView({ view, pos: 0, mask: 0b00000011 })).toBe(
		0b00000000
	);
	expect(readBitsInDataView({ view, pos: 0, mask: 0b00000110 })).toBe(
		0b00000000
	);
	expect(readBitsInDataView({ view, pos: 0, mask: 0b10000000 })).toBe(
		0b00000000
	);
	expect(readBitsInDataView({ view, pos: 0, mask: 0b10000001 })).toBe(
		0b00000000
	);
});

test('writeBitsInDataView()', () => {
	// Must throw if mask has no enabled bit.
	expect(() =>
		writeBitsInDataView({ view, pos: 0, mask: 0b00000000, value: 123 })
	).toThrow(TypeError);

	// Must throw if mask has is bigger than 0b11111111.
	expect(() =>
		writeBitsInDataView({ view, pos: 0, mask: 0b100000000, value: 123 })
	).toThrow(TypeError);

	writeBitsInDataView({ view, pos: 0, mask: 0b00000001, value: 1 });
	expect(view.getUint8(0)).toBe(1);
	expect(readBitsInDataView({ view, pos: 0, mask: 0b00000011 })).toBe(1);

	writeBitsInDataView({ view, pos: 1, mask: 0b00000011, value: 2 });
	expect(view.getUint8(1)).toBe(2);
	expect(readBitsInDataView({ view, pos: 1, mask: 0b00000011 })).toBe(2);

	writeBitsInDataView({ view, pos: 2, mask: 0b00000001, value: 1 });
	expect(view.getUint8(2)).toBe(0b00000011);

	writeBitsInDataView({ view, pos: 3, mask: 0b00000111, value: 0b00000101 });
	expect(view.getUint8(3)).toBe(0b00000101);

	writeBitsInDataView({ view, pos: 4, mask: 0b00000011, value: 0b00000010 });
	expect(view.getUint8(4)).toBe(0b10000010);

	writeBitsInDataView({ view, pos: 5, mask: 0b00001110, value: 0b00000110 });
	expect(view.getUint8(5)).toBe(0b01001100);

	writeBitsInDataView({ view, pos: 6, mask: 0b11000000, value: 0b00000010 });
	expect(view.getUint8(6)).toBe(0b10100000);
});
