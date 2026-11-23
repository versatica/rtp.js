/**
 * Reads bits from a buffer, from the highest to the lowest bit of each byte.
 *
 * @remarks
 * - A read beyond the end of the buffer invalidates the reader, so every
 *   later read fails too and {@link ok} returns `false`. Parsers can read all
 *   the fields and check {@link ok} once at the end.
 * - Reads of up to 32 bits are supported.
 *
 * @internal
 */
export class BitstreamReader {
	readonly #bytes: Uint8Array;
	// Index of the byte the next bit is read from.
	#byteIndex = 0;
	// Bits left to read, or -1 if the reader has been invalidated.
	#remainingBits: number;

	constructor(bytes: Uint8Array) {
		this.#bytes = bytes;
		this.#remainingBits = bytes.byteLength * 8;
	}

	/**
	 * Number of bits left to read, or -1 if the reader has been invalidated.
	 */
	remainingBitCount(): number {
		return this.#remainingBits;
	}

	/**
	 * Whether every read so far was within the buffer.
	 */
	ok(): boolean {
		return this.#remainingBits >= 0;
	}

	/**
	 * Mark the reader as failed, so {@link ok} returns `false` from now on.
	 */
	invalidate(): void {
		this.#remainingBits = -1;
	}

	/**
	 * Read one bit. Returns 0 if there are no bits left.
	 */
	readBit(): number {
		if (this.#remainingBits <= 0) {
			this.invalidate();

			return 0;
		}

		--this.#remainingBits;

		const bitPosition = this.#remainingBits % 8;

		if (bitPosition === 0) {
			// Read the last bit from the current byte and move to the next byte.
			return this.#bytes[this.#byteIndex++]! & 0x01;
		}

		return (this.#bytes[this.#byteIndex]! >> bitPosition) & 0x01;
	}

	/**
	 * Read `bits` bits (up to 32) as an unsigned integer. Returns 0 if there
	 * are not enough bits left.
	 */
	readBits(bits: number): number {
		if (this.#remainingBits < bits) {
			this.invalidate();

			return 0;
		}

		const remainingBitsInFirstByte = this.#remainingBits % 8;

		this.#remainingBits -= bits;

		if (bits < remainingBitsInFirstByte) {
			// Reading fewer bits than what's left in the current byte, just return
			// the portion of this byte that is needed.
			const offset = remainingBitsInFirstByte - bits;

			return (this.#bytes[this.#byteIndex]! >> offset) & ((1 << bits) - 1);
		}

		// NOTE: Bits are added with multiplication and addition rather than with
		// bitwise operators, which operate on 32 bits signed integers.
		let result = 0;

		if (remainingBitsInFirstByte > 0) {
			// Read all bits that were left in the current byte and consume that
			// byte.
			bits -= remainingBitsInFirstByte;

			const mask = (1 << remainingBitsInFirstByte) - 1;

			result = (this.#bytes[this.#byteIndex]! & mask) * 2 ** bits;

			++this.#byteIndex;
		}

		// Read as many full bytes as we can.
		while (bits >= 8) {
			bits -= 8;
			result += this.#bytes[this.#byteIndex]! * 2 ** bits;

			++this.#byteIndex;
		}

		// Whatever is left to read is smaller than a byte, so grab just the
		// needed bits and shift them into the lowest bits.
		if (bits > 0) {
			result += this.#bytes[this.#byteIndex]! >> (8 - bits);
		}

		return result;
	}

	/**
	 * Read a value in range [0, `numValues` - 1] encoded with the non-symmetric
	 * encoding (`ns(n)` in the AV1 RTP specification).
	 */
	readNonSymmetric(numValues: number): number {
		const width = 32 - Math.clz32(numValues);
		const numMinBitsValues = 2 ** width - numValues;
		const value = this.readBits(width - 1);

		if (value < numMinBitsValues) {
			return value;
		}

		return value * 2 + this.readBit() - numMinBitsValues;
	}
}
