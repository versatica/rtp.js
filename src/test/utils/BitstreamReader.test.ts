import { BitstreamReader } from '../../utils/BitstreamReader';

describe('BitstreamReader', () => {
	test('BitstreamReader.readBit()', () => {
		const reader = new BitstreamReader(
			new Uint8Array([0b01000001, 0b10110001])
		);

		// First byte.
		expect(reader.readBit()).toBe(0);
		expect(reader.readBit()).toBe(1);
		expect(reader.readBit()).toBe(0);
		expect(reader.readBit()).toBe(0);

		expect(reader.readBit()).toBe(0);
		expect(reader.readBit()).toBe(0);
		expect(reader.readBit()).toBe(0);
		expect(reader.readBit()).toBe(1);

		// Second byte.
		expect(reader.readBit()).toBe(1);
		expect(reader.readBit()).toBe(0);
		expect(reader.readBit()).toBe(1);
		expect(reader.readBit()).toBe(1);

		expect(reader.readBit()).toBe(0);
		expect(reader.readBit()).toBe(0);
		expect(reader.readBit()).toBe(0);
		expect(reader.readBit()).toBe(1);

		expect(reader.ok()).toBe(true);

		// Try to read beyond the buffer.
		expect(reader.readBit()).toBe(0);
		expect(reader.ok()).toBe(false);
	});

	test('BitstreamReader.readBits() of aligned bytes', () => {
		const reader = new BitstreamReader(
			new Uint8Array([0x0a, 0xbc, 0xde, 0xf1, 0x23, 0x45, 0x67, 0x89])
		);

		expect(reader.readBits(8)).toBe(0x0a);
		expect(reader.readBits(8)).toBe(0xbc);
		expect(reader.readBits(16)).toBe(0xdef1);
		expect(reader.readBits(32)).toBe(0x23456789);
		expect(reader.ok()).toBe(true);
	});

	test('BitstreamReader.readBits() of bytes with offset 4', () => {
		const reader = new BitstreamReader(
			new Uint8Array([0x0a, 0xbc, 0xde, 0xf1, 0x23, 0x45, 0x67, 0x89, 0x0a])
		);

		// NOTE: libwebrtc uses ConsumeBits(4), which is not ported.
		expect(reader.readBits(4)).toBe(0x0);
		expect(reader.readBits(8)).toBe(0xab);
		expect(reader.readBits(8)).toBe(0xcd);
		expect(reader.readBits(16)).toBe(0xef12);
		expect(reader.readBits(32)).toBe(0x34567890);
		expect(reader.ok()).toBe(true);
	});

	test('BitstreamReader.readBits() of bytes with offset 3', () => {
		// The pattern we'll check against is counting down from 0b1111. It looks
		// weird here because it's all offset by 3.
		const reader = new BitstreamReader(
			new Uint8Array([0x1f, 0xdb, 0x97, 0x53, 0x0e, 0xca, 0x86, 0x42])
		);

		// NOTE: libwebrtc uses ConsumeBits(3), which is not ported.
		expect(reader.readBits(3)).toBe(0b000);
		expect(reader.readBits(8)).toBe(0xfe);
		expect(reader.readBits(16)).toBe(0xdcba);
		expect(reader.readBits(32)).toBe(0x98765432);
		expect(reader.ok()).toBe(true);

		// 5 bits left unread. Not enough to read 8 bits.
		expect(reader.remainingBitCount()).toBe(5);
		expect(reader.readBits(8)).toBe(0);
		expect(reader.ok()).toBe(false);
	});

	test('BitstreamReader.readBits()', () => {
		const reader = new BitstreamReader(
			new Uint8Array([0b01001101, 0b00110010])
		);

		expect(reader.readBits(3)).toBe(0b010);
		expect(reader.readBits(2)).toBe(0b01);
		expect(reader.readBits(7)).toBe(0b1010011);
		expect(reader.readBits(2)).toBe(0b00);
		expect(reader.readBits(1)).toBe(0b1);
		expect(reader.readBits(1)).toBe(0b0);
		expect(reader.ok()).toBe(true);

		expect(reader.readBits(1)).toBe(0);
		expect(reader.ok()).toBe(false);
	});

	test('BitstreamReader.readBits() of zero bits', () => {
		const reader = new BitstreamReader(new Uint8Array(0));

		expect(reader.readBits(0)).toBe(0);
		expect(reader.ok()).toBe(true);
	});

	test('BitstreamReader.readBit() from empty array', () => {
		const reader = new BitstreamReader(new Uint8Array(0));

		expect(reader.readBit()).toBe(0);
		expect(reader.ok()).toBe(false);
	});

	test('BitstreamReader.readBits() from empty array', () => {
		const reader = new BitstreamReader(new Uint8Array(0));

		expect(reader.readBits(1)).toBe(0);
		expect(reader.ok()).toBe(false);
	});

	test('BitstreamReader.readNonSymmetric() reads the same number of bits when the number of values is a power of 2', () => {
		const reader = new BitstreamReader(new Uint8Array([0xf3, 0xa0]));

		expect(reader.remainingBitCount()).toBe(16);
		expect(reader.readNonSymmetric(/* numValues */ 1 << 4)).toBe(0xf);
		expect(reader.readNonSymmetric(/* numValues */ 1 << 4)).toBe(0x3);
		expect(reader.readNonSymmetric(/* numValues */ 1 << 4)).toBe(0xa);
		expect(reader.readNonSymmetric(/* numValues */ 1 << 4)).toBe(0x0);
		expect(reader.remainingBitCount()).toBe(0);
		expect(reader.ok()).toBe(true);
	});

	test('BitstreamReader.readNonSymmetric() of the only value consumes zero bits', () => {
		const reader = new BitstreamReader(new Uint8Array(2));

		expect(reader.remainingBitCount()).toBe(16);
		expect(reader.readNonSymmetric(/* numValues */ 1)).toBe(0);
		expect(reader.remainingBitCount()).toBe(16);
	});
});
