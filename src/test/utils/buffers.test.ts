import { padTo4Bytes, areBuffersEqual } from '../../utils/buffers.js';

test('padTo4Bytes()', () => {
	expect(padTo4Bytes(0)).toBe(0);
	expect(padTo4Bytes(1)).toBe(4);
	expect(padTo4Bytes(2)).toBe(4);
	expect(padTo4Bytes(3)).toBe(4);
	expect(padTo4Bytes(4)).toBe(4);
	expect(padTo4Bytes(5)).toBe(8);
	expect(padTo4Bytes(8)).toBe(8);
	expect(padTo4Bytes(9)).toBe(12);
	expect(padTo4Bytes(15)).toBe(16);
	expect(padTo4Bytes(252)).toBe(252);
	expect(padTo4Bytes(254)).toBe(256);
	expect(padTo4Bytes(255)).toBe(256);
	expect(padTo4Bytes(256)).toBe(256);
	expect(padTo4Bytes(65532)).toBe(65532);
	expect(padTo4Bytes(65535)).toBe(65536);
});

test('areBuffersEqual()', () => {
	const buffer = new Uint8Array([0x01, 0x02, 0x03, 0x01, 0x02, 0x03]);

	// Same buffer.
	expect(areBuffersEqual(buffer, buffer)).toBe(true);
	// Same content in different buffers.
	expect(areBuffersEqual(buffer, new Uint8Array(buffer))).toBe(true);
	// Same content at different offsets of the same ArrayBuffer.
	expect(areBuffersEqual(buffer.subarray(0, 3), buffer.subarray(3, 6))).toBe(
		true
	);
	// Empty buffers.
	expect(areBuffersEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
	// Different length.
	expect(areBuffersEqual(buffer, buffer.subarray(0, 5))).toBe(false);
	expect(areBuffersEqual(buffer.subarray(0, 0), buffer)).toBe(false);
	// Different content.
	expect(
		areBuffersEqual(buffer.subarray(0, 3), new Uint8Array([0x01, 0x02, 0x04]))
	).toBe(false);
	expect(
		areBuffersEqual(buffer.subarray(0, 3), new Uint8Array([0x00, 0x02, 0x03]))
	).toBe(false);
});
