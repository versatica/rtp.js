import {
	readBit,
	writeBit,
	toggleBit,
	readBits,
	writeBits,
	readBitInDataView,
	writeBitInDataView,
	readBitsInDataView,
	writeBitsInDataView,
} from '../../utils/bits';

let view: DataView;

beforeEach(() => {
	const array = new Uint8Array([
		0b00000000, 0b00000001, 0b00000010, 0b00000011, 0b10000000, 0b01000000,
		0b00100000, 0b00010000,
	]);

	view = new DataView(array.buffer, array.byteOffset, array.byteLength);
});

test('readBit()', () => {
	expect(readBit(0b0101, 0)).toBe(true);
	expect(readBit(0b0101, 1)).toBe(false);
	expect(readBit(0b0101, 2)).toBe(true);
	expect(readBit(0b0101, 3)).toBe(false);
	expect(readBit(0x8000, 15)).toBe(true);
	expect(readBit(0x8000, 14)).toBe(false);
});

test('writeBit()', () => {
	expect(writeBit(0, 0, true)).toBe(1);
	expect(writeBit(1, 0, true)).toBe(1);
	expect(writeBit(1, 0, false)).toBe(0);
	expect(writeBit(0b1111, 1, false)).toBe(0b1101);
	expect(writeBit(0, 15, true)).toBe(0x8000);
	expect(writeBit(0xffff, 15, false)).toBe(0x7fff);
});

test('toggleBit()', () => {
	expect(toggleBit(0, 0)).toBe(1);
	expect(toggleBit(1, 0)).toBe(0);
	expect(toggleBit(0b1010, 1)).toBe(0b1000);
	expect(toggleBit(0b1010, 2)).toBe(0b1110);
	expect(toggleBit(0, 15)).toBe(0x8000);
	expect(toggleBit(0x8000, 15)).toBe(0);
});

test('readBits()', () => {
	// Must throw if mask has no enabled bit.
	expect(() => readBits(0, 0b00000000)).toThrow(TypeError);

	// Must throw if mask has is bigger than 0b11111111.
	expect(() => readBits(0, 0b100000000)).toThrow(TypeError);

	// Must throw if mask is negative.
	expect(() => readBits(0, -1)).toThrow(TypeError);

	// Must throw if mask is not an integer.
	expect(() => readBits(0, 1.5)).toThrow(TypeError);

	expect(readBits(0b10110100, 0b00111100)).toBe(0b1101);
	expect(readBits(0b10110100, 0b11000000)).toBe(0b10);
	expect(readBits(0b10110100, 0b00000001)).toBe(0);
	expect(readBits(0b10110100, 0b11111111)).toBe(0b10110100);
});

test('writeBits()', () => {
	// Must throw if mask has no enabled bit.
	expect(() => writeBits(0, 0b00000000, 1)).toThrow(TypeError);

	// Must throw if mask has is bigger than 0b11111111.
	expect(() => writeBits(0, 0b100000000, 1)).toThrow(TypeError);

	// Must throw if mask is negative.
	expect(() => writeBits(0, -1, 1)).toThrow(TypeError);

	// Must throw if mask is not an integer.
	expect(() => writeBits(0, 1.5, 1)).toThrow(TypeError);

	expect(writeBits(0b10110100, 0b00111100, 0b0011)).toBe(0b10001100);
	expect(writeBits(0b00000000, 0b11000000, 0b11)).toBe(0b11000000);
	expect(writeBits(0b11111111, 0b00010000, 0)).toBe(0b11101111);
	// Bits of value that don't fit into the mask are ignored.
	expect(writeBits(0b00000000, 0b00000110, 0b111)).toBe(0b00000110);
});

test('readBitInDataView()', () => {
	expect(readBitInDataView(view, 0, 0)).toBe(false);
	expect(readBitInDataView(view, 0, 7)).toBe(false);
	expect(readBitInDataView(view, 1, 0)).toBe(true);
	expect(readBitInDataView(view, 1, 7)).toBe(false);
	expect(readBitInDataView(view, 2, 0)).toBe(false);
	expect(readBitInDataView(view, 2, 1)).toBe(true);
	expect(readBitInDataView(view, 2, 7)).toBe(false);
	expect(readBitInDataView(view, 3, 0)).toBe(true);
	expect(readBitInDataView(view, 3, 1)).toBe(true);
	expect(readBitInDataView(view, 3, 7)).toBe(false);
	expect(readBitInDataView(view, 4, 0)).toBe(false);
	expect(readBitInDataView(view, 4, 7)).toBe(true);
	expect(readBitInDataView(view, 5, 6)).toBe(true);
	expect(readBitInDataView(view, 6, 5)).toBe(true);
	expect(readBitInDataView(view, 7, 4)).toBe(true);
});

test('writeBitInDataView()', () => {
	writeBitInDataView(view, 0, 0, true);
	expect(readBitInDataView(view, 0, 0)).toBe(true);
	expect(readBitInDataView(view, 0, 7)).toBe(false);

	writeBitInDataView(view, 0, 7, true);
	expect(readBitInDataView(view, 0, 0)).toBe(true);
	expect(readBitInDataView(view, 0, 7)).toBe(true);
});

test('readBitsInDataView()', () => {
	// Must throw if mask has no enabled bit.
	expect(() => readBitsInDataView(view, 0, 0b00000000)).toThrow(TypeError);

	// Must throw if mask has is bigger than 0b11111111.
	expect(() => readBitsInDataView(view, 0, 0b100000000)).toThrow(TypeError);

	// Must throw if mask is negative.
	expect(() => readBitsInDataView(view, 0, -1)).toThrow(TypeError);

	// Must throw if mask is not an integer.
	expect(() => readBitsInDataView(view, 0, 1.5)).toThrow(TypeError);

	expect(readBitsInDataView(view, 0, 0b00000011)).toBe(0b00000000);
	expect(readBitsInDataView(view, 0, 0b00000110)).toBe(0b00000000);
	expect(readBitsInDataView(view, 0, 0b10000000)).toBe(0b00000000);
	expect(readBitsInDataView(view, 0, 0b10000001)).toBe(0b00000000);
});

test('writeBitsInDataView()', () => {
	// Must throw if mask has no enabled bit.
	expect(() => writeBitsInDataView(view, 0, 0b00000000, 123)).toThrow(
		TypeError
	);

	// Must throw if mask has is bigger than 0b11111111.
	expect(() => writeBitsInDataView(view, 0, 0b100000000, 123)).toThrow(
		TypeError
	);

	writeBitsInDataView(view, 0, 0b00000001, 1);
	expect(view.getUint8(0)).toBe(1);
	expect(readBitsInDataView(view, 0, 0b00000011)).toBe(1);

	writeBitsInDataView(view, 1, 0b00000011, 2);
	expect(view.getUint8(1)).toBe(2);
	expect(readBitsInDataView(view, 1, 0b00000011)).toBe(2);

	writeBitsInDataView(view, 2, 0b00000001, 1);
	expect(view.getUint8(2)).toBe(0b00000011);

	writeBitsInDataView(view, 3, 0b00000111, 0b00000101);
	expect(view.getUint8(3)).toBe(0b00000101);

	writeBitsInDataView(view, 4, 0b00000011, 0b00000010);
	expect(view.getUint8(4)).toBe(0b10000010);

	writeBitsInDataView(view, 5, 0b00001110, 0b00000110);
	expect(view.getUint8(5)).toBe(0b01001100);

	writeBitsInDataView(view, 6, 0b11000000, 0b00000010);
	expect(view.getUint8(6)).toBe(0b10100000);
});
