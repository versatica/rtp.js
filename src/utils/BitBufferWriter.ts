/**
 * Writes bits into a buffer, from the highest to the lowest bit of each byte.
 *
 * @remarks
 * - Writes of up to 32 bits are supported.
 */
export class BitBufferWriter {
	readonly #bytes: Uint8Array;
	// Offset (in bytes) of the byte the next bit is written into.
	#byteOffset = 0;
	// Offset (in bits) into the current byte, in the range [0, 7].
	#bitOffset = 0;

	/**
	 * Number of bits needed to write `value` in range [0, `numValues` - 1]
	 * with the non-symmetric encoding (`ns(n)` in the AV1 RTP specification).
	 */
	static sizeNonSymmetricBits(value: number, numValues: number): number {
		const countBits = 32 - Math.clz32(numValues);
		const numMinBitsValues = 2 ** countBits - numValues;

		return value < numMinBitsValues ? countBits - 1 : countBits;
	}

	constructor(bytes: Uint8Array) {
		this.#bytes = bytes;
	}

	/**
	 * Number of bits left to write.
	 */
	remainingBitCount(): number {
		return (this.#bytes.byteLength - this.#byteOffset) * 8 - this.#bitOffset;
	}

	/**
	 * Write `bitCount` zero bits. Returns `false` if there aren't enough bits
	 * left in the buffer.
	 *
	 * @remarks
	 * - Bits in the last partially written byte are assumed to be zero already.
	 */
	zeroBits(bitCount: number): boolean {
		if (bitCount > this.remainingBitCount()) {
			return false;
		}

		const oldEnd = this.#byteOffset + (this.#bitOffset > 0 ? 1 : 0);

		this.#consumeBits(bitCount);

		const newEnd = this.#byteOffset + (this.#bitOffset > 0 ? 1 : 0);

		if (newEnd > oldEnd) {
			// Zero bytes considered newly written, including the last one that can
			// be considered partially written.
			this.#bytes.fill(0, oldEnd, newEnd);
		}

		return true;
	}

	/**
	 * Write the lowest `bitCount` bits (up to 32) of `value`. Returns `false`
	 * if there isn't enough room left for them.
	 */
	writeBits(value: number, bitCount: number): boolean {
		if (bitCount > this.remainingBitCount()) {
			return false;
		}

		let bitsLeft = bitCount;

		// NOTE: Bits are taken from `value` with division and modulo rather than
		// with bitwise operators, which operate on 32 bits signed integers.
		while (bitsLeft > 0) {
			const bitsInCurrentByte = Math.min(bitsLeft, 8 - this.#bitOffset);
			// Highest `bitsInCurrentByte` bits of the bits left to write.
			const bits =
				Math.floor(value / 2 ** (bitsLeft - bitsInCurrentByte)) %
				2 ** bitsInCurrentByte;
			const shift = 8 - this.#bitOffset - bitsInCurrentByte;

			if (this.#bitOffset === 0) {
				// The first write in a byte overwrites the whole byte, so its bits
				// after the written ones are zero, as zeroBits() assumes.
				this.#bytes[this.#byteOffset] = bits << shift;
			} else {
				const mask = ((1 << bitsInCurrentByte) - 1) << shift;

				this.#bytes[this.#byteOffset] =
					(this.#bytes[this.#byteOffset]! & ~mask) | (bits << shift);
			}

			bitsLeft -= bitsInCurrentByte;

			this.#consumeBits(bitsInCurrentByte);
		}

		return true;
	}

	/**
	 * Write `value` in range [0, `numValues` - 1] with the non-symmetric
	 * encoding (`ns(n)` in the AV1 RTP specification). Returns `false` if there
	 * isn't enough room left for it.
	 */
	writeNonSymmetric(value: number, numValues: number): boolean {
		if (numValues === 1) {
			// When there is only one possible value, it requires zero bits to store
			// it.
			return true;
		}

		const countBits = 32 - Math.clz32(numValues);
		const numMinBitsValues = 2 ** countBits - numValues;

		return value < numMinBitsValues
			? this.writeBits(value, countBits - 1)
			: this.writeBits(value + numMinBitsValues, countBits);
	}

	/**
	 * Move the current position `bitCount` bits forward.
	 */
	#consumeBits(bitCount: number): void {
		this.#byteOffset += Math.floor((this.#bitOffset + bitCount) / 8);
		this.#bitOffset = (this.#bitOffset + bitCount) % 8;
	}
}
