// NOTE: Random size buffers since anyway we use their byteLength.

/**
 * Buffer for packets created with `factory()`.
 */
export const factoryBuffer = new Uint8Array(66661);

/**
 * Buffer for `serialize()`.
 */
export const serializeBuffer = new Uint8Array(66662);

/**
 * Buffer for `clone()`.
 */
export const cloneBuffer = new Uint8Array(66663);

/**
 * Buffer with arbitrary data to be written into packets.
 */
export const dataBuffer = new Uint8Array(66664);

/**
 * Buffer for operations that must throw.
 */
export const throwBuffer = new Uint8Array(66665);

/**
 * Fill the buffer with bytes that change from one position to the next,
 * starting at `firstByte`, so no two consecutive bytes are equal.
 */
export function fillBuffer(buffer: Uint8Array, firstByte: number): void {
	for (let idx = 0; idx < buffer.byteLength; ++idx) {
		buffer[idx] = (firstByte + idx) & 0xff;
	}
}

/**
 * Fill the shared buffers with their initial content. It must be called
 * before each test.
 */
export function resetBuffers(): void {
	fillBuffer(factoryBuffer, 0xaa);
	fillBuffer(serializeBuffer, 0xbb);
	fillBuffer(cloneBuffer, 0xcc);
	fillBuffer(dataBuffer, 0x00);
	fillBuffer(throwBuffer, 0xee);
}
