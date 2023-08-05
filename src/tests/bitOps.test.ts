import { readBit, writeBit, readBits, writeBits } from '../bitOps';

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

test('readBit()', () =>
{
	expect(readBit({ view, byte: 0, bit: 0 })).toBe(false);
	expect(readBit({ view, byte: 0, bit: 7 })).toBe(false);
	expect(readBit({ view, byte: 1, bit: 0 })).toBe(true);
	expect(readBit({ view, byte: 1, bit: 7 })).toBe(false);
	expect(readBit({ view, byte: 2, bit: 0 })).toBe(false);
	expect(readBit({ view, byte: 2, bit: 1 })).toBe(true);
	expect(readBit({ view, byte: 2, bit: 7 })).toBe(false);
	expect(readBit({ view, byte: 3, bit: 0 })).toBe(true);
	expect(readBit({ view, byte: 3, bit: 1 })).toBe(true);
	expect(readBit({ view, byte: 3, bit: 7 })).toBe(false);
	expect(readBit({ view, byte: 4, bit: 0 })).toBe(false);
	expect(readBit({ view, byte: 4, bit: 7 })).toBe(true);
	expect(readBit({ view, byte: 5, bit: 6 })).toBe(true);
	expect(readBit({ view, byte: 6, bit: 5 })).toBe(true);
	expect(readBit({ view, byte: 7, bit: 4 })).toBe(true);
});

test('writeBit()', () =>
{
	writeBit({ view, byte: 0, bit: 0, flag: true });
	expect(readBit({ view, byte: 0, bit: 0 })).toBe(true);
	expect(readBit({ view, byte: 0, bit: 7 })).toBe(false);

	writeBit({ view, byte: 0, bit: 7, flag: true });
	expect(readBit({ view, byte: 0, bit: 0 })).toBe(true);
	expect(readBit({ view, byte: 0, bit: 7 })).toBe(true);
});

test('readBits()', () =>
{
	// Must throw if mask has no enabled bit.
	expect(() => (readBits({ view, byte: 0, mask: 0b00000000 })))
		.toThrowError(TypeError);

	// Must throw if mask has is bigger than 0b11111111.
	expect(() => (readBits({ view, byte: 0, mask: 0b100000000 })))
		.toThrowError(TypeError);

	expect(readBits({ view, byte: 0, mask: 0b00000011 })).toBe(0b00000000);
	expect(readBits({ view, byte: 0, mask: 0b00000110 })).toBe(0b00000000);
	expect(readBits({ view, byte: 0, mask: 0b10000000 })).toBe(0b00000000);
	expect(readBits({ view, byte: 0, mask: 0b10000001 })).toBe(0b00000000);
});

test('writeBits()', () =>
{
	// Must throw if mask has no enabled bit.
	expect(() => (writeBits({ view, byte: 0, mask: 0b00000000, value: 123 })))
		.toThrowError(TypeError);

	// Must throw if mask has is bigger than 0b11111111.
	expect(() => (writeBits({ view, byte: 0, mask: 0b100000000, value: 123 })))
		.toThrowError(TypeError);

	writeBits({ view, byte: 0, mask: 0b00000001, value: 1 });
	expect(view.getUint8(0)).toBe(1);
	expect(readBits({ view, byte: 0, mask: 0b00000011 })).toBe(1);

	writeBits({ view, byte: 1, mask: 0b00000011, value: 2 });
	expect(view.getUint8(1)).toBe(2);
	expect(readBits({ view, byte: 1, mask: 0b00000011 })).toBe(2);

	writeBits({ view, byte: 2, mask: 0b00000001, value: 1 });
	expect(view.getUint8(2)).toBe(0b00000011);

	writeBits({ view, byte: 3, mask: 0b00000111, value: 0b00000101 });
	expect(view.getUint8(3)).toBe(0b00000101);

	writeBits({ view, byte: 4, mask: 0b00000011, value: 0b00000010 });
	expect(view.getUint8(4)).toBe(0b10000010);

	writeBits({ view, byte: 5, mask: 0b00001110, value: 0b00000110 });
	expect(view.getUint8(5)).toBe(0b01001100);

	writeBits({ view, byte: 6, mask: 0b11000000, value: 0b00000010 });
	expect(view.getUint8(6)).toBe(0b10100000);
});
