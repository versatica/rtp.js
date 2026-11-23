import { BitBufferWriter } from '../../utils/BitBufferWriter';
import { BitstreamReader } from '../../utils/BitstreamReader';

describe('BitBufferWriter', () => {
	test('BitBufferWriter.writeNonSymmetric() writes the same number of bits when the number of values is a power of 2', () => {
		const bytes = new Uint8Array(2);
		const writer = new BitBufferWriter(bytes);

		expect(writer.remainingBitCount()).toBe(16);
		expect(writer.writeNonSymmetric(0xf, /* numValues */ 1 << 4)).toBe(true);
		expect(writer.remainingBitCount()).toBe(12);
		expect(writer.writeNonSymmetric(0x3, /* numValues */ 1 << 4)).toBe(true);
		expect(writer.remainingBitCount()).toBe(8);
		expect(writer.writeNonSymmetric(0xa, /* numValues */ 1 << 4)).toBe(true);
		expect(writer.remainingBitCount()).toBe(4);
		expect(writer.writeNonSymmetric(0x0, /* numValues */ 1 << 4)).toBe(true);
		expect(writer.remainingBitCount()).toBe(0);
		expect(Array.from(bytes)).toEqual([0xf3, 0xa0]);
	});

	test('BitBufferWriter.writeNonSymmetric() reads match writes', () => {
		const bytes = new Uint8Array(2);
		const writer = new BitBufferWriter(bytes);

		expect(
			BitBufferWriter.sizeNonSymmetricBits(/* value */ 1, /* numValues */ 6)
		).toBe(2);
		expect(
			BitBufferWriter.sizeNonSymmetricBits(/* value */ 2, /* numValues */ 6)
		).toBe(3);

		// Values [0, 1] can fit into two bits.
		expect(writer.remainingBitCount()).toBe(16);
		expect(writer.writeNonSymmetric(/* value */ 0, /* numValues */ 6)).toBe(
			true
		);
		expect(writer.remainingBitCount()).toBe(14);
		expect(writer.writeNonSymmetric(/* value */ 1, /* numValues */ 6)).toBe(
			true
		);
		expect(writer.remainingBitCount()).toBe(12);

		// Values [2, 5] require 3 bits.
		expect(writer.writeNonSymmetric(/* value */ 2, /* numValues */ 6)).toBe(
			true
		);
		expect(writer.remainingBitCount()).toBe(9);
		expect(writer.writeNonSymmetric(/* value */ 3, /* numValues */ 6)).toBe(
			true
		);
		expect(writer.remainingBitCount()).toBe(6);
		expect(writer.writeNonSymmetric(/* value */ 4, /* numValues */ 6)).toBe(
			true
		);
		expect(writer.remainingBitCount()).toBe(3);
		expect(writer.writeNonSymmetric(/* value */ 5, /* numValues */ 6)).toBe(
			true
		);
		expect(writer.remainingBitCount()).toBe(0);

		// Bit values are 00.01.100.101.110.111 = 00011001|01110111 = 0x19|77.
		expect(Array.from(bytes)).toEqual([0x19, 0x77]);

		const reader = new BitstreamReader(bytes);

		expect(reader.readNonSymmetric(/* numValues */ 6)).toBe(0);
		expect(reader.readNonSymmetric(/* numValues */ 6)).toBe(1);
		expect(reader.readNonSymmetric(/* numValues */ 6)).toBe(2);
		expect(reader.readNonSymmetric(/* numValues */ 6)).toBe(3);
		expect(reader.readNonSymmetric(/* numValues */ 6)).toBe(4);
		expect(reader.readNonSymmetric(/* numValues */ 6)).toBe(5);
		expect(reader.ok()).toBe(true);
	});

	test('BitBufferWriter.writeNonSymmetric() of the only value consumes no bits', () => {
		const writer = new BitBufferWriter(new Uint8Array(2));

		expect(writer.remainingBitCount()).toBe(16);
		expect(writer.writeNonSymmetric(0, /* numValues */ 1)).toBe(true);
		expect(writer.remainingBitCount()).toBe(16);
	});

	test('BitBufferWriter.writeBits() reads match writes', () => {
		const bytes = new Uint8Array(16);
		const writer = new BitBufferWriter(bytes.subarray(0, 4));

		// Write some bit data at various sizes.
		expect(writer.writeBits(0x2, 3)).toBe(true);
		expect(writer.writeBits(0x1, 2)).toBe(true);
		expect(writer.writeBits(0x53, 7)).toBe(true);
		expect(writer.writeBits(0x0, 2)).toBe(true);
		expect(writer.writeBits(0x1, 1)).toBe(true);
		expect(writer.writeBits(0x1abcd, 17)).toBe(true);
		// That should be all that fits in the buffer.
		expect(writer.writeBits(1, 1)).toBe(false);

		const reader = new BitstreamReader(bytes.subarray(0, 4));

		expect(reader.readBits(3)).toBe(0x2);
		expect(reader.readBits(2)).toBe(0x1);
		expect(reader.readBits(7)).toBe(0x53);
		expect(reader.readBits(2)).toBe(0x0);
		expect(reader.readBits(1)).toBe(0x1);
		expect(reader.readBits(17)).toBe(0x1abcd);
		// And there should be nothing left.
		expect(reader.remainingBitCount()).toBe(0);
	});
});
