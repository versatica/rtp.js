import { RtpPacket, isRtp } from '../../../packets/RTP/RtpPacket';
import { ExtensionType } from '../../../packets/RTP/extensions';
import { checkRtpPacket, type ExpectedRtpPacket } from './rtpCommon';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	dataBuffer,
	resetBuffers,
} from '../../testHelpers';

const textEncoder = new TextEncoder();

beforeEach(resetBuffers);

describe('RTP Packet', () => {
	test('RtpPacket.parse() with a One-Byte extension and payload succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x90, 0x6f, 0x5c, 0x41, 0x62, 0xf5, 0x47, 0xda, 0x9f, 0x71, 0x08, 0xe2,
			0xbe, 0xde, 0x00, 0x01, 0x10, 0xff, 0x00, 0x00, 0xba, 0xe2, 0x1a, 0x9d,
			0xa2, 0x78, 0x76, 0x09, 0x8d, 0xb8, 0xe2, 0x77, 0xd0, 0x41, 0xd9, 0xc0,
			0xf1, 0xe7, 0x8a, 0x69, 0x9a, 0xf0, 0xee, 0x8f, 0x98, 0x7c, 0xd5, 0x17,
			0xc2, 0x2b, 0x92, 0xdc, 0x9b, 0x23,
		]);
		const packet = RtpPacket.parse(buffer);
		const expected: ExpectedRtpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: buffer.byteLength,
			payloadType: 111,
			marker: false,
			sequenceNumber: 23617,
			timestamp: 1660241882,
			ssrc: 2674985186,
			hasCsrcs: false,
			hasHeaderExtension: true,
			headerExtensionValueLength: 4,
			hasOneByteExtensions: true,
			hasTwoByteExtensions: false,
			hasPayload: true,
			payloadLength: 34,
			hasPadding: false,
			padding: 0,
		};

		checkRtpPacket(packet, expected);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xaa);

		checkRtpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xaa);

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		/* Set payload. */

		clonedPacket.setPayload(dataBuffer.subarray(0, 16));

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: buffer.byteLength - 34 + 16,
			payloadLength: 16,
		});

		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 16));
	});

	test('RtpPacket.parse() with payload and padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0xa0, 0x64, 0x6f, 0x3e, 0x0a, 0x45, 0x65, 0x88, 0xc5, 0xab, 0xdf, 0x5a,
			0xb8, 0xec, 0xe4, 0xba, 0xca, 0x4f, 0x2c, 0xa9, 0x2f, 0x22, 0xbb, 0x99,
			0xb8, 0x59, 0xe8, 0xbd, 0x7c, 0xe1, 0x22, 0xe4, 0xfa, 0x8b, 0xcb, 0x97,
			0x92, 0x70, 0xa4, 0xe1, 0x14, 0xda, 0x24, 0x02, 0xac, 0xfa, 0xe1, 0xb2,
			0x13, 0xcd, 0x4f, 0x6c, 0x8d, 0x6b, 0xc3, 0xe5, 0xb5, 0x7e, 0x33, 0xd3,
			0x25, 0x0a, 0xb9, 0x7f, 0x81, 0x69, 0x90, 0x26, 0xae, 0xba, 0xfa, 0xdc,
			0xbd, 0xb5, 0xe7, 0x3e, 0xcc, 0x1d, 0x3d, 0x32, 0xba, 0x0e, 0x13, 0x1c,
			0x0d, 0x1c, 0xe5, 0x48, 0xd9, 0xa6, 0x4d, 0x60, 0x26, 0x36, 0xb4, 0x1c,
			0x2a, 0x8b, 0x04, 0xc9, 0x3d, 0xb2, 0x31, 0x3c, 0x50, 0xbc, 0xa6, 0xb3,
			0xd0, 0xdf, 0xa3, 0xea, 0x8f, 0xea, 0x57, 0x87, 0x7e, 0x1b, 0xeb, 0x36,
			0x4b, 0xd0, 0x29, 0x43, 0x4b, 0x89, 0x26, 0x1c, 0xa9, 0xe4, 0x37, 0xb7,
			0x62, 0x22, 0x24, 0xb9, 0x98, 0xbc, 0x09, 0x80, 0x05, 0x08, 0xd9, 0x40,
			0xfd, 0x30, 0x31, 0xf4, 0xcb, 0xb4, 0x90, 0xf6, 0xd2, 0xbc, 0x4c, 0x59,
			0x30, 0xd0, 0xc9, 0x1e, 0x07, 0x1a, 0xea, 0x27, 0xdb, 0x19, 0x55, 0x40,
			0x11, 0xc1, 0x10, 0xe5, 0x2d, 0x97, 0x1b, 0xdb, 0x1b, 0x9d, 0x2a, 0x8b,
			0xca, 0x04, 0x85, 0xa3, 0xd7, 0x63, 0x35, 0x7a, 0x49, 0x80, 0x31, 0xd4,
			0x77, 0x84, 0x31, 0x4c, 0x94, 0x4c, 0x72, 0xf7, 0xea, 0xc3, 0x02, 0x10,
			0x78, 0x19, 0x17, 0xfa, 0x0a, 0x32, 0xcb, 0x52, 0x7d, 0xe6, 0x26, 0x71,
			0xc9, 0x32, 0xe3, 0x94, 0xb9, 0x78, 0xc4, 0x37, 0xfd, 0x0e, 0x77, 0xce,
			0xec, 0x09, 0xf5, 0x76, 0x4b, 0xfc, 0x11, 0x99, 0xe6, 0x4c, 0x95,
		]);
		const packet = RtpPacket.parse(buffer);
		const expected: ExpectedRtpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: buffer.byteLength,
			payloadType: 100,
			marker: false,
			sequenceNumber: 28478,
			timestamp: 172320136,
			ssrc: 3316375386,
			hasCsrcs: false,
			hasHeaderExtension: false,
			headerExtensionValueLength: 0,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: false,
			hasPayload: true,
			payloadLength: 78,
			hasPadding: true,
			padding: 149,
		};

		checkRtpPacket(packet, expected);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xaa);

		checkRtpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xaa);

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		/* Set payload. */

		clonedPacket.setPayload(dataBuffer.subarray(0, 16));

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: buffer.byteLength - 78 + 16 - 149,
			payloadLength: 16,
			hasPadding: false,
			padding: 0,
		});

		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 16));
	});

	test('RtpPacket.parse() with two One-Byte extensions and payload succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x90, 0x6f, 0x4b, 0x9a, 0x33, 0x77, 0x72, 0x3d, 0x0e, 0x0d, 0xfa, 0xd2,
			0xbe, 0xde, 0x00, 0x02, 0x32, 0x65, 0x34, 0x1e, 0x10, 0xd0, 0x00, 0x00,
			0x09, 0x4f, 0x43, 0x83, 0x21, 0x37, 0x20, 0xa1, 0x6a, 0x02, 0xf5, 0xc7,
			0x0e, 0xea, 0xe3, 0x71, 0xc2, 0x85, 0x56, 0x44, 0x6d, 0x5b, 0x5c, 0xfb,
			0xb4, 0x4e, 0x83, 0x25, 0x4c, 0x1a, 0xe3, 0x6e, 0x11, 0x2f, 0xf8, 0x18,
			0xd3, 0x8e, 0x68, 0xe9, 0x11, 0xe9, 0x61, 0x3d, 0x96, 0x8e, 0x2f, 0x4b,
			0xee, 0x26, 0x74, 0xfb, 0xc1, 0xeb, 0x23, 0x01, 0x65, 0xc4, 0xa1, 0xea,
			0x37, 0xd7, 0x0a, 0x1e, 0xea, 0x6e, 0xe5, 0x38, 0x4a, 0xf3, 0xce, 0xa2,
			0x2a, 0xb4, 0xc6, 0x21, 0x02, 0x11,
		]);
		const packet = RtpPacket.parse(buffer);
		const expected: ExpectedRtpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: buffer.byteLength,
			payloadType: 111,
			marker: false,
			sequenceNumber: 19354,
			timestamp: 863466045,
			ssrc: 235797202,
			hasCsrcs: false,
			hasHeaderExtension: true,
			headerExtensionValueLength: 8,
			hasOneByteExtensions: true,
			hasTwoByteExtensions: false,
			hasPayload: true,
			payloadLength: 78,
			hasPadding: false,
			padding: 0,
		};

		checkRtpPacket(packet, expected);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xaa);

		checkRtpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xaa);

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		/* Set payload. */

		clonedPacket.setPayload(dataBuffer.subarray(0, 16));

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: buffer.byteLength - 78 + 16,
			payloadLength: 16,
		});

		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 16));
	});

	test('RtpPacket.parse() without extensions or payload succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x80, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
		]);
		const packet = RtpPacket.parse(buffer);
		const expected: ExpectedRtpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: buffer.byteLength,
			payloadType: 1,
			marker: false,
			sequenceNumber: 8,
			timestamp: 4,
			ssrc: 5,
			hasCsrcs: false,
			hasHeaderExtension: false,
			headerExtensionValueLength: 0,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: false,
			hasPayload: false,
			payloadLength: 0,
			hasPadding: false,
			padding: 0,
		};

		checkRtpPacket(packet, expected);

		expect(packet.getLength() % 4).toBe(0);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xaa);

		checkRtpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		expect(packet.getLength() % 4).toBe(0);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xaa);

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		expect(clonedPacket.getLength() % 4).toBe(0);

		/* Set payload. */

		clonedPacket.setPayload(dataBuffer.subarray(0, 16));

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: buffer.byteLength + 16,
			hasPayload: true,
			payloadLength: 16,
		});

		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 16));
		expect(clonedPacket.getLength() % 4).toBe(0);
	});

	test('RtpPacket.parse() with One-Byte extensions succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0xbe, 0xde, 0x00, 0x03, // Header extension
			0x10, 0xaa, 0x21, 0xbb, // - id: 1, len: 1
			0xff, 0x00, 0x00, 0x33, // - id: 2, len: 2
			0xff, 0xff, 0xff, 0xff, // - id: 3, len: 4
			0x12, 0x23,
		]);
		const packet = RtpPacket.parse(buffer);
		const expected: ExpectedRtpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: buffer.byteLength,
			payloadType: 1,
			marker: false,
			sequenceNumber: 8,
			timestamp: 4,
			ssrc: 5,
			hasCsrcs: false,
			hasHeaderExtension: true,
			headerExtensionValueLength: 12,
			hasOneByteExtensions: true,
			hasTwoByteExtensions: false,
			hasPayload: true,
			payloadLength: 2,
			hasPadding: false,
			padding: 0,
		};

		checkRtpPacket(packet, expected);

		expect(packet.getExtension(1)).toEqual(buffer.subarray(17, 18));
		expect(packet.getExtension(2)).toEqual(buffer.subarray(19, 21));
		expect(packet.getExtension(3)).toEqual(buffer.subarray(24, 28));
		expect(packet.getExtension(4)).toBeUndefined();
		expect(packet.getLength() % 4).not.toBe(0);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xaa);

		checkRtpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		expect(packet.getExtension(1)).toEqual(serializeBuffer.subarray(17, 18));
		expect(packet.getExtension(2)).toEqual(serializeBuffer.subarray(19, 21));
		expect(packet.getExtension(3)).toEqual(serializeBuffer.subarray(24, 28));
		expect(packet.getExtension(4)).toBeUndefined();
		expect(packet.getLength() % 4).not.toBe(0);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xaa);

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		expect(clonedPacket.getExtension(1)).toEqual(cloneBuffer.subarray(17, 18));
		expect(clonedPacket.getExtension(2)).toEqual(cloneBuffer.subarray(19, 21));
		expect(clonedPacket.getExtension(3)).toEqual(cloneBuffer.subarray(24, 28));
		expect(clonedPacket.getExtension(4)).toBeUndefined();
		expect(clonedPacket.getLength() % 4).not.toBe(0);

		/* Set payload. */

		clonedPacket.setPayload(dataBuffer.subarray(0, 16));

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: buffer.byteLength - 2 + 16,
			payloadLength: 16,
		});

		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 16));
		expect(clonedPacket.getLength() % 4).toBe(0);
	});

	test('RtpPacket.parse() with Two-Byte extensions succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0x10, 0x00, 0x00, 0x04, // Header extension
			0x00, 0x00, 0x01, 0x00, // - id: 1, len: 0
			0x02, 0x01, 0x42, 0x00, // - id: 2, len: 1
			0x03, 0x02, 0x11, 0x22, // - id: 3, len: 2
			0x00, 0x00, 0x04, 0x00, // - id: 4, len: 0
		]);
		const packet = RtpPacket.parse(buffer);
		const expected: ExpectedRtpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: buffer.byteLength,
			payloadType: 1,
			marker: false,
			sequenceNumber: 8,
			timestamp: 4,
			ssrc: 5,
			hasCsrcs: false,
			hasHeaderExtension: true,
			headerExtensionValueLength: 16,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: true,
			hasPayload: false,
			payloadLength: 0,
			hasPadding: false,
			padding: 0,
		};

		checkRtpPacket(packet, expected);

		expect(packet.getExtension(1)?.byteLength).toBe(0);
		expect(packet.getExtension(2)).toEqual(buffer.subarray(22, 23));
		expect(packet.getExtension(3)).toEqual(buffer.subarray(26, 28));
		expect(packet.getExtension(4)?.byteLength).toBe(0);
		expect(packet.getExtension(5)).toBeUndefined();
		expect(packet.getLength() % 4).toBe(0);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xaa);

		checkRtpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		expect(packet.getExtension(1)?.byteLength).toBe(0);
		expect(packet.getExtension(2)).toEqual(serializeBuffer.subarray(22, 23));
		expect(packet.getExtension(3)).toEqual(serializeBuffer.subarray(26, 28));
		expect(packet.getExtension(4)?.byteLength).toBe(0);
		expect(packet.getExtension(5)).toBeUndefined();
		expect(packet.getLength() % 4).toBe(0);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xaa);

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		expect(clonedPacket.getExtension(1)?.byteLength).toBe(0);
		expect(clonedPacket.getExtension(2)).toEqual(cloneBuffer.subarray(22, 23));
		expect(clonedPacket.getExtension(3)).toEqual(cloneBuffer.subarray(26, 28));
		expect(clonedPacket.getExtension(4)?.byteLength).toBe(0);
		expect(clonedPacket.getExtension(5)).toBeUndefined();
		expect(clonedPacket.getLength() % 4).toBe(0);

		/* Set payload. */

		clonedPacket.setPayload(dataBuffer.subarray(0, 15));

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: buffer.byteLength + 15,
			hasPayload: true,
			payloadLength: 15,
		});

		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 15));
		expect(clonedPacket.getLength() % 4).not.toBe(0);
	});

	test('RtpPacket.parse() padding-only packet succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0xa0, 0x01, 0x00, 0x09,
			0x00, 0x00, 0x00, 0x05,
			0x00, 0x00, 0x00, 0x06,
			0x00, 0x00, 0x00, 0x00, // Padding (8 bytes)
			0x00, 0x00, 0x00, 0x08,
		]);
		const packet = RtpPacket.parse(buffer);
		const expected: ExpectedRtpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: buffer.byteLength,
			payloadType: 1,
			marker: false,
			sequenceNumber: 9,
			timestamp: 5,
			ssrc: 6,
			hasCsrcs: false,
			hasHeaderExtension: false,
			headerExtensionValueLength: 0,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: false,
			hasPayload: false,
			payloadLength: 0,
			hasPadding: true,
			padding: 8,
		};

		checkRtpPacket(packet, expected);

		expect(packet.getLength() % 4).toBe(0);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xaa);

		checkRtpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		expect(packet.getLength() % 4).toBe(0);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xaa);

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		expect(clonedPacket.getLength() % 4).toBe(0);

		/* Set payload. */

		clonedPacket.setPayload(dataBuffer.subarray(0, 1));

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: clonedPacket.getLength(),
			hasPayload: true,
			payloadLength: 1,
			hasPadding: false,
			padding: 0,
		});

		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 1));
		expect(clonedPacket.getLength() % 4).not.toBe(0);

		/* Pad to 4 bytes. */

		clonedPacket.padTo4Bytes();

		checkRtpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: clonedPacket.getLength(),
			hasPayload: true,
			payloadLength: 1,
			hasPadding: true,
			padding: 3,
		});

		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 1));
		expect(clonedPacket.getLength() % 4).toBe(0);
	});

	test('RtpPacket.parse() with wrong arguments fails', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0xbe, 0xde, 0x00, 0x03, // Header extension
			0x10, 0xaa, 0x21, 0xbb, // - id: 1, len: 1
			0xff, 0x00, 0x00, 0x33, // - id: 2, len: 2
			0xff, 0xff, 0xff, 0xff, // - id: 3, len: 4
			0x12, 0x23,
		]);

		// Buffer length is lower than packet length.
		expect(() =>
			RtpPacket.parse(
				buffer.subarray(0, buffer.byteLength - 1),
				buffer.byteLength
			)
		).toThrow(TypeError);

		// Packet length is not an unsigned integer.
		expect(isRtp(buffer, NaN)).toBe(false);
		expect(isRtp(buffer, 12.5)).toBe(false);
		expect(isRtp(buffer, -1)).toBe(false);
		expect(() => RtpPacket.parse(buffer, NaN)).toThrow(TypeError);
		expect(() => RtpPacket.parse(buffer, 12.5)).toThrow(TypeError);
		expect(() => RtpPacket.parse(buffer, -1)).toThrow(TypeError);

		// Packet shorter than the fixed header.
		expect(isRtp(buffer, 11)).toBe(false);
		expect(() => RtpPacket.parse(buffer, 11)).toThrow(TypeError);

		// RTP version is not 2.
		// prettier-ignore
		const wrongVersionBuffer = new Uint8Array([
			0x40, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
		]);

		expect(isRtp(wrongVersionBuffer)).toBe(false);
		expect(() => RtpPacket.parse(wrongVersionBuffer)).toThrow(TypeError);

		// Not enough space for the announced CSRC list.
		// prettier-ignore
		const wrongCsrcsBuffer = new Uint8Array([
			0x81, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
		]);

		expect(() => RtpPacket.parse(wrongCsrcsBuffer)).toThrow(TypeError);

		// Not enough space for the announced header extension.
		// prettier-ignore
		const wrongHeaderExtensionBuffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0xbe, 0xde,
		]);

		expect(() => RtpPacket.parse(wrongHeaderExtensionBuffer)).toThrow(
			TypeError
		);

		// Not enough space for the announced header extension value.
		// prettier-ignore
		const wrongHeaderExtensionValueBuffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0xbe, 0xde, 0x00, 0x02,
			0x10, 0xaa, 0x00, 0x00,
		]);

		expect(() => RtpPacket.parse(wrongHeaderExtensionValueBuffer)).toThrow(
			TypeError
		);

		// Not enough space for the announced value of a One-Byte extension.
		// prettier-ignore
		const wrongOneByteExtensionBuffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0xbe, 0xde, 0x00, 0x01,
			0x13, 0x01, 0x02, 0x03, // - id: 1, len: 4
		]);

		expect(() => RtpPacket.parse(wrongOneByteExtensionBuffer)).toThrow(
			TypeError
		);

		// Not enough space for the announced value of a Two-Byte extension.
		// prettier-ignore
		const wrongTwoByteExtensionBuffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0x10, 0x00, 0x00, 0x01,
			0x01, 0x03, 0xaa, 0xbb, // - id: 1, len: 3
		]);

		expect(() => RtpPacket.parse(wrongTwoByteExtensionBuffer)).toThrow(
			TypeError
		);

		// Padding byte is 0.
		// prettier-ignore
		const zeroPaddingBuffer = new Uint8Array([
			0xa0, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0x11, 0x22, 0x33, 0x00,
		]);

		expect(() => RtpPacket.parse(zeroPaddingBuffer)).toThrow(TypeError);

		// Padding bigger than the available space for payload and padding.
		// prettier-ignore
		const tooBigPaddingBuffer = new Uint8Array([
			0xa0, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0x11, 0x22, 0x33, 0x05,
		]);

		expect(() => RtpPacket.parse(tooBigPaddingBuffer)).toThrow(TypeError);
	});

	test('RtpPacket.parse() stops parsing One-Byte extensions at id 15', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0xbe, 0xde, 0x00, 0x02, // Header extension
			0x10, 0xaa, 0xf3, 0x21, // - id: 1, len: 1, then id 15
			0xbb, 0xcc, 0x00, 0x00, // - ignored
		]);
		const packet = RtpPacket.parse(buffer);

		expect([...packet.getExtensions().keys()]).toEqual([1]);
		expect(packet.getExtension(1)).toEqual(new Uint8Array([0xaa]));
		expect(packet.getExtension(2)).toBeUndefined();
	});

	test('RtpPacket.factory() succeeds', () => {
		const packet = RtpPacket.factory(factoryBuffer);
		const expected: ExpectedRtpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 12,
			payloadType: 0,
			marker: false,
			sequenceNumber: 0,
			timestamp: 0,
			ssrc: 0,
			hasCsrcs: false,
			hasHeaderExtension: false,
			headerExtensionValueLength: 0,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: false,
			hasPayload: false,
			payloadLength: 0,
			hasPadding: false,
			padding: 0,
		};

		checkRtpPacket(packet, expected);

		expect(packet.getLength() % 4).toBe(0);

		packet.setPayloadType(100);
		packet.setMarker(true);
		packet.setSequenceNumber(12345);
		packet.setTimestamp(987654321);
		packet.setSsrc(1234567890);

		// Extensions:
		//
		// Using One-Byte extensions:
		// - Header extension value length: 1 + 1 + 1 + 2 + 1 + 3 = 9 => 12 (padded)
		// - Header extension length: 4 + 12 = 16
		//
		// Using Two-Byte extensions:
		// - Header extension value length: 2 + 1 + 2 + 2 + 2 + 3 = 12
		// - Header extension length: 4 + 12 = 16
		//
		// Extension id 1.
		dataBuffer[0] = 11;
		// Extension id 2.
		dataBuffer[1] = 22;
		dataBuffer[2] = 0xaa;
		// Extension id 14.
		dataBuffer[3] = 14;
		dataBuffer[4] = 0xbb;
		dataBuffer[5] = 0xcc;

		// Add One-Byte extensions.
		packet.setExtension(1, dataBuffer.subarray(0, 1));
		packet.setExtension(2, dataBuffer.subarray(1, 3));
		packet.setExtension(14, dataBuffer.subarray(3, 6));

		packet.setPayload(dataBuffer.subarray(0, 10));
		packet.padTo4Bytes(); // payload + padding = 12.

		const expectedWithExtensions: ExpectedRtpPacket = {
			...expected,
			length: 12 + 16 + 10 + 2,
			payloadType: 100,
			marker: true,
			sequenceNumber: 12345,
			timestamp: 987654321,
			ssrc: 1234567890,
			hasHeaderExtension: true,
			headerExtensionValueLength: 12,
			hasOneByteExtensions: true,
			hasPayload: true,
			payloadLength: 10,
			hasPadding: true,
			padding: 2,
		};

		checkRtpPacket(packet, expectedWithExtensions);

		expect(packet.getExtension(1)).toEqual(new Uint8Array([11]));
		expect(packet.getExtension(2)).toEqual(new Uint8Array([22, 0xaa]));
		expect(packet.getExtension(3)).toBeUndefined();
		expect(packet.getExtension(14)).toEqual(new Uint8Array([14, 0xbb, 0xcc]));
		expect(packet.getLength() % 4).toBe(0);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xaa);

		checkRtpPacket(packet, {
			...expectedWithExtensions,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		expect(packet.getExtension(1)).toEqual(new Uint8Array([11]));
		expect(packet.getExtension(2)).toEqual(new Uint8Array([22, 0xaa]));
		expect(packet.getExtension(3)).toBeUndefined();
		expect(packet.getExtension(14)).toEqual(new Uint8Array([14, 0xbb, 0xcc]));
		expect(packet.getLength() % 4).toBe(0);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xaa);

		checkRtpPacket(clonedPacket, {
			...expectedWithExtensions,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		expect(clonedPacket.getExtension(1)).toEqual(new Uint8Array([11]));
		expect(clonedPacket.getExtension(2)).toEqual(new Uint8Array([22, 0xaa]));
		expect(clonedPacket.getExtension(3)).toBeUndefined();
		expect(clonedPacket.getExtension(14)).toEqual(
			new Uint8Array([14, 0xbb, 0xcc])
		);
		expect(clonedPacket.getLength() % 4).toBe(0);

		/* Set payload. */

		clonedPacket.setPayload(dataBuffer.subarray(0, 1));

		checkRtpPacket(clonedPacket, {
			...expectedWithExtensions,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 12 + 16 + 1,
			payloadLength: 1,
			hasPadding: false,
			padding: 0,
		});

		expect(clonedPacket.getExtension(1)).toEqual(new Uint8Array([11]));
		expect(clonedPacket.getExtension(2)).toEqual(new Uint8Array([22, 0xaa]));
		expect(clonedPacket.getExtension(3)).toBeUndefined();
		expect(clonedPacket.getExtension(14)).toEqual(
			new Uint8Array([14, 0xbb, 0xcc])
		);
		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 1));
		expect(clonedPacket.getLength() % 4).not.toBe(0);

		/* Pad to 4 bytes. */

		clonedPacket.padTo4Bytes();

		checkRtpPacket(clonedPacket, {
			...expectedWithExtensions,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 12 + 16 + 1 + 3,
			payloadLength: 1,
			hasPadding: true,
			padding: 3,
		});

		expect(clonedPacket.getExtension(1)).toEqual(new Uint8Array([11]));
		expect(clonedPacket.getExtension(2)).toEqual(new Uint8Array([22, 0xaa]));
		expect(clonedPacket.getExtension(3)).toBeUndefined();
		expect(clonedPacket.getExtension(14)).toEqual(
			new Uint8Array([14, 0xbb, 0xcc])
		);
		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 1));
		expect(clonedPacket.getLength() % 4).toBe(0);

		/* Remove extensions. */

		clonedPacket.clearExtensions();

		checkRtpPacket(clonedPacket, {
			...expectedWithExtensions,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 12 + 1 + 3,
			hasHeaderExtension: false,
			headerExtensionValueLength: 0,
			hasOneByteExtensions: false,
			payloadLength: 1,
			hasPadding: true,
			padding: 3,
		});

		expect(clonedPacket.getExtension(1)).toBeUndefined();
		expect(clonedPacket.getExtension(2)).toBeUndefined();
		expect(clonedPacket.getExtension(3)).toBeUndefined();
		expect(clonedPacket.getExtension(14)).toBeUndefined();
		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 1));
		expect(clonedPacket.getLength() % 4).toBe(0);

		/* Add Two-Byte extensions. */

		clonedPacket.setExtensionsForm('two-byte');
		clonedPacket.setExtension(1, dataBuffer.subarray(0, 1));
		clonedPacket.setExtension(2, dataBuffer.subarray(1, 3));
		clonedPacket.setExtension(14, dataBuffer.subarray(3, 6));

		checkRtpPacket(clonedPacket, {
			...expectedWithExtensions,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 12 + 16 + 1 + 3,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: true,
			payloadLength: 1,
			hasPadding: true,
			padding: 3,
		});

		expect(clonedPacket.getExtension(1)).toEqual(new Uint8Array([11]));
		expect(clonedPacket.getExtension(2)).toEqual(new Uint8Array([22, 0xaa]));
		expect(clonedPacket.getExtension(3)).toBeUndefined();
		expect(clonedPacket.getExtension(14)).toEqual(
			new Uint8Array([14, 0xbb, 0xcc])
		);
		expect(clonedPacket.getPayload()).toEqual(dataBuffer.subarray(0, 1));
		expect(clonedPacket.getLength() % 4).toBe(0);
	});

	test('rtpPacket.setExtensionsForm() rewrites the extensions', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		expect(packet.getExtensionsForm()).toBe('one-byte');

		// Can fit into One-Byte extensions.
		packet.setExtension(1, dataBuffer.subarray(0, 1));
		packet.setExtension(14, dataBuffer.subarray(0, 16));

		expect(packet.dump().headerExtensionId).toBe(0xbede);

		const oneByteBuffer = packet.getBuffer().slice();

		// Id > 14, length 0 and length > 16 do not fit into One-Byte extensions.
		expect(() => packet.setExtension(15, dataBuffer.subarray(0, 2))).toThrow(
			TypeError
		);
		expect(() => packet.setExtension(3, dataBuffer.subarray(0, 0))).toThrow(
			TypeError
		);
		expect(() => packet.setExtension(4, dataBuffer.subarray(0, 17))).toThrow(
			TypeError
		);
		expect(packet.getBuffer()).toEqual(oneByteBuffer);

		packet.setExtensionsForm('two-byte');

		expect(packet.getExtensionsForm()).toBe('two-byte');
		expect(packet.dump().headerExtensionId).toBe(0b0001000000000000);
		expect(packet.getExtension(1)).toEqual(dataBuffer.subarray(0, 1));
		expect(packet.getExtension(14)).toEqual(dataBuffer.subarray(0, 16));

		// They fit into Two-Byte extensions.
		packet.setExtension(15, dataBuffer.subarray(0, 2));
		packet.setExtension(3, dataBuffer.subarray(0, 0));
		packet.setExtension(4, dataBuffer.subarray(0, 17));

		expect(packet.getExtension(15)).toEqual(dataBuffer.subarray(0, 2));
		expect(packet.getExtension(3)?.byteLength).toBe(0);
		expect(packet.getExtension(4)).toEqual(dataBuffer.subarray(0, 17));

		const twoByteBuffer = packet.getBuffer().slice();

		// They cannot be rewritten as One-Byte extensions.
		expect(() => packet.setExtensionsForm('one-byte')).toThrow(TypeError);
		expect(packet.getExtensionsForm()).toBe('two-byte');
		expect(packet.getBuffer()).toEqual(twoByteBuffer);

		packet.deleteExtension(15);
		packet.deleteExtension(3);
		packet.deleteExtension(4);
		packet.setExtensionsForm('one-byte');

		expect(packet.getExtensionsForm()).toBe('one-byte');
		expect(packet.getBuffer()).toEqual(oneByteBuffer);
		expect(packet.getExtension(1)).toEqual(dataBuffer.subarray(0, 1));
		expect(packet.getExtension(14)).toEqual(dataBuffer.subarray(0, 16));
	});

	test('rtpPacket.setExtensionsForm() rewrites the id of a header extension without extensions', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0xbe, 0xde, 0x00, 0x01, // Header extension
			0x00, 0x00, 0x00, 0x00, // - padding
			0x11, 0x22, 0x33, 0x44, // Payload
		]);
		const packet = RtpPacket.parse(buffer);

		expect(packet.getExtensionsForm()).toBe('one-byte');
		expect(packet.getExtensions().size).toBe(0);

		packet.setExtensionsForm('two-byte');

		expect(packet.getExtensionsForm()).toBe('two-byte');
		expect(packet.dump().headerExtensionId).toBe(0b0001000000000000);
		expect(packet.getLength()).toBe(buffer.byteLength);
		expect(RtpPacket.parse(packet.getBuffer()).getExtensionsForm()).toBe(
			'two-byte'
		);
		expect(packet.getPayload()).toEqual(
			new Uint8Array([0x11, 0x22, 0x33, 0x44])
		);

		packet.setExtensionsForm('one-byte');

		expect(packet.getExtensionsForm()).toBe('one-byte');
		expect(packet.dump().headerExtensionId).toBe(0xbede);
		expect(packet.getLength()).toBe(buffer.byteLength);
		expect(RtpPacket.parse(packet.getBuffer()).getExtensionsForm()).toBe(
			'one-byte'
		);
		expect(packet.getPayload()).toEqual(
			new Uint8Array([0x11, 0x22, 0x33, 0x44])
		);
	});

	test('Packet extension setters and getters succeed', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setExtensionMapping({
			[ExtensionType.MID]: 1,
			[ExtensionType.RTP_STREAM_ID]: 2,
			[ExtensionType.ABS_SEND_TIME]: 3,
			[ExtensionType.TRANSPORT_WIDE_CC_01]: 4,
			[ExtensionType.ABS_CAPTURE_TIME]: 5,
		});

		packet.setMidExtension('mid-€1');
		packet.setRidExtension('r1-ß');
		packet.setAbsSendTimeExtension(12345678);
		packet.setTransportWideCc01Extension(5555);
		packet.setAbsCaptureTimeExtension({
			absCaptureTimestamp: { seconds: 0x83aa7e80, fractions: 0 },
		});

		expect(packet.getExtensionsForm()).toBe('one-byte');
		expect(packet.getMidExtension()).toBe('mid-€1');
		expect(packet.getRidExtension()).toBe('r1-ß');
		expect(packet.getAbsSendTimeExtension()).toBe(12345678);
		expect(packet.getTransportWideCc01Extension()).toBe(5555);
		expect(packet.getAbsCaptureTimeExtension()).toEqual({
			absCaptureTimestamp: { seconds: 0x83aa7e80, fractions: 0 },
		});

		expect(packet.getExtension(1)).toEqual(
			new Uint8Array([0x6d, 0x69, 0x64, 0x2d, 0xe2, 0x82, 0xac, 0x31])
		);
		expect(packet.getExtension(2)).toEqual(
			new Uint8Array([0x72, 0x31, 0x2d, 0xc3, 0x9f])
		);
		expect(packet.getExtension(3)).toEqual(new Uint8Array([0xbc, 0x61, 0x4e]));
		expect(packet.getExtension(4)).toEqual(new Uint8Array([0x15, 0xb3]));
		expect(packet.getExtension(5)).toEqual(
			new Uint8Array([0x83, 0xaa, 0x7e, 0x80, 0x00, 0x00, 0x00, 0x00])
		);

		packet.setMidExtension('mid-®2');
		packet.setAbsSendTimeExtension(10485563);
		packet.setTransportWideCc01Extension(5556);
		packet.setAbsCaptureTimeExtension({
			absCaptureTimestamp: { seconds: 0x83aa7e81, fractions: 0 },
		});

		expect(packet.getMidExtension()).toBe('mid-®2');
		expect(packet.getRidExtension()).toBe('r1-ß');
		expect(packet.getAbsSendTimeExtension()).toBe(10485563);
		expect(packet.getTransportWideCc01Extension()).toBe(5556);
		expect(packet.getAbsCaptureTimeExtension()).toEqual({
			absCaptureTimestamp: { seconds: 0x83aa7e81, fractions: 0 },
		});

		const packet2 = RtpPacket.parse(packet.getBuffer());

		packet2.serialize(serializeBuffer);

		packet2.setExtensionMapping({
			[ExtensionType.MID]: 1,
			[ExtensionType.RTP_STREAM_ID]: 2,
			[ExtensionType.ABS_SEND_TIME]: 3,
			[ExtensionType.TRANSPORT_WIDE_CC_01]: 4,
		});

		expect(packet2.getExtensionsForm()).toBe('one-byte');
		expect(packet2.getMidExtension()).toBe('mid-®2');
		expect(packet2.getRidExtension()).toBe('r1-ß');
		expect(packet2.getAbsSendTimeExtension()).toBe(10485563);
		expect(packet2.getTransportWideCc01Extension()).toBe(5556);
	});

	test('rtpPacket.getRidExtension() and rtpPacket.getRridExtension() read the RID and RRID extensions', () => {
		const extensionMapping = {
			[ExtensionType.RTP_STREAM_ID]: 1,
			[ExtensionType.REPAIRED_RTP_STREAM_ID]: 2,
		};

		// Packet with just the RID extension.
		const ridPacket = RtpPacket.factory(factoryBuffer);

		ridPacket.setExtensionMapping(extensionMapping);
		ridPacket.setRidExtension('r1');

		const parsedRidPacket = RtpPacket.parse(ridPacket.getBuffer());

		parsedRidPacket.setExtensionMapping(extensionMapping);

		expect(parsedRidPacket.getRidExtension()).toBe('r1');
		expect(parsedRidPacket.getRridExtension()).toBeUndefined();

		// Packet with just the RRID extension.
		const rridPacket = RtpPacket.factory(cloneBuffer);

		rridPacket.setExtensionMapping(extensionMapping);
		rridPacket.setRridExtension('r2');

		const parsedRridPacket = RtpPacket.parse(rridPacket.getBuffer());

		parsedRridPacket.setExtensionMapping(extensionMapping);

		expect(parsedRridPacket.getRidExtension()).toBeUndefined();
		expect(parsedRridPacket.getRridExtension()).toBe('r2');
	});

	test('rtpPacket.setExtension() fails if wrong extensions are given', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setPayload(dataBuffer.subarray(0, 10));
		packet.padTo4Bytes();

		const d = dataBuffer;

		// Invalid extension id 0.
		expect(() => packet.setExtension(0, d.subarray(0, 4))).toThrow(TypeError);

		packet.setExtensionsForm('two-byte');

		expect(() => packet.setExtension(0, d.subarray(0, 4))).toThrow(TypeError);

		packet.setExtensionsForm('one-byte');

		// Invalid extension id > 14 in One-Byte.
		expect(() => packet.setExtension(15, d.subarray(0, 2))).toThrow(TypeError);

		// Invalid extension length 0 in One-Byte.
		expect(() => packet.setExtension(3, d.subarray(0, 0))).toThrow(TypeError);

		// Invalid extension length > 16 in One-Byte.
		expect(() => packet.setExtension(3, d.subarray(0, 17))).toThrow(TypeError);

		packet.setExtensionsForm('two-byte');

		expect(() => packet.setExtension(15, d.subarray(0, 2))).not.toThrow();
		expect(() => packet.setExtension(3, d.subarray(0, 0))).not.toThrow();

		packet.deleteExtension(15);
		packet.setExtension(3, d.subarray(0, 17));
		packet.setExtension(6, d.subarray(0, 6));
		packet.setExtension(7, d.subarray(0, 7));
		packet.setExtension(8, d.subarray(0, 8));
		packet.setExtension(9, d.subarray(0, 9));
		packet.setExtension(100, d.subarray(0, 10));

		checkRtpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 12 + 4 + 72 + 10 + 2,
			payloadType: 0,
			marker: false,
			sequenceNumber: 0,
			timestamp: 0,
			ssrc: 0,
			hasCsrcs: false,
			hasHeaderExtension: true,
			headerExtensionValueLength: 72,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: true,
			hasPayload: true,
			payloadLength: 10,
			hasPadding: true,
			padding: 2,
		});

		expect(packet.getExtension(3)).toEqual(d.subarray(0, 17));
		expect(packet.getExtension(1)).toBeUndefined();
		expect(packet.getExtension(6)).toEqual(d.subarray(0, 6));
		expect(packet.getExtension(7)).toEqual(d.subarray(0, 7));
		expect(packet.getExtension(8)).toEqual(d.subarray(0, 8));
		expect(packet.getExtension(9)).toEqual(d.subarray(0, 9));
		expect(packet.getExtension(100)).toEqual(d.subarray(0, 10));
		expect(packet.getExtension(101)).toBeUndefined();
		expect(packet.getPayload()).toEqual(d.subarray(0, 10));
		expect(packet.getLength() % 4).toBe(0);
	});

	test('rtpPacket.setExtension() shrinks a huge header extension', () => {
		const extensionValueLength = 40000;
		const payloadLength = 8;
		const packetLength = 12 + 4 + extensionValueLength + payloadLength;
		const view = new DataView(factoryBuffer.buffer);

		factoryBuffer[0] = 0b10010000; // Version 2, extension flag set.
		factoryBuffer[1] = 0b00000000; // Payload type 0, no marker.
		factoryBuffer[2] = 0x00;
		factoryBuffer[3] = 0x01; // Sequence number.
		factoryBuffer.fill(0x01, 8, 12); // SSRC.

		// One-Byte header extension profile (0xBEDE) and its length in 32-bit words,
		// with an all-padding (zeroed) value.
		view.setUint16(12, 0xbede);
		view.setUint16(14, extensionValueLength / 4);
		factoryBuffer.fill(0, 16, 16 + extensionValueLength);

		const packet = RtpPacket.parse(factoryBuffer, packetLength);

		expect(packet.dump().headerExtensionId).toBe(0xbede);

		packet.setExtension(1, dataBuffer.subarray(0, 4));
		packet.setExtension(2, dataBuffer.subarray(4, 8));

		// New length: 12 (fixed header) + 4 (ext header) + 12 (two 5-byte One-Byte
		// elements padded to 4) + 8 (payload) = 36.
		expect(packet.getLength()).toBe(36);
	});

	test('rtpPacket.setExtension() keeps Two-Byte extensions with length 0', () => {
		// prettier-ignore
		const receivedBuffer = new Uint8Array([
			0x90, 0x6f, 0x00, 0x01, // Version 2, extension flag set, payload type 111, sequence number 1.
			0x00, 0x00, 0x00, 0x01, // Timestamp.
			0x00, 0x00, 0x00, 0x01, // SSRC.
			0x10, 0x00, 0x00, 0x01, // Two-Byte header extension, length 1 (4 bytes).
			0x02, 0x00, 0x00, 0x00, // Extension id 2 with length 0, then padding.
			0x11, 0x22, 0x33, 0x44, // Payload.
		]);

		factoryBuffer.set(receivedBuffer);

		const packet = RtpPacket.parse(factoryBuffer, receivedBuffer.byteLength);

		expect(packet.getExtensionsForm()).toBe('two-byte');
		expect(packet.getExtension(2)?.byteLength).toBe(0);

		packet.setExtension(1, textEncoder.encode('abcdefgh'));

		expect(packet.getExtensionsForm()).toBe('two-byte');
		expect(packet.dump().headerExtensionId).toBe(0b0001000000000000);
		expect(packet.getExtension(1)).toEqual(textEncoder.encode('abcdefgh'));
		expect(packet.getExtension(2)?.byteLength).toBe(0);
		expect(packet.getPayload()).toEqual(
			new Uint8Array([0x11, 0x22, 0x33, 0x44])
		);
	});

	test('rtpPacket.setExtension() fails without modifying the packet if it does not fit', () => {
		// 12 (fixed header) + 10 (payload) = 22 bytes. Setting the extension needs
		// 12 more: 4 (ext header) + 8 (one 5-byte One-Byte element padded to 4).
		// So a buffer of 33 bytes is one byte short.
		let packet = RtpPacket.factory(factoryBuffer.subarray(0, 33));

		packet.setPayload(dataBuffer.subarray(0, 10));

		expect(() => packet.setExtension(1, dataBuffer.subarray(0, 4))).toThrow(
			TypeError
		);
		expect(packet.getLength()).toBe(22);
		expect(packet.dump().headerExtensionId).toBeUndefined();
		expect(packet.getPayload()).toEqual(dataBuffer.subarray(0, 10));

		// A buffer of 34 bytes is exactly what it needs.
		packet = RtpPacket.factory(factoryBuffer.subarray(0, 34));

		packet.setPayload(dataBuffer.subarray(0, 10));
		packet.setExtension(1, dataBuffer.subarray(0, 4));

		expect(packet.getLength()).toBe(34);
		expect(packet.dump().headerExtensionId).toBe(0xbede);
		expect(packet.getExtension(1)).toEqual(dataBuffer.subarray(0, 4));

		// Two One-Byte elements of 5 bytes take 12 bytes, 4 more than the current
		// header extension value, so they do not fit and the extension already in
		// the packet must remain untouched.
		expect(() => packet.setExtension(2, dataBuffer.subarray(4, 8))).toThrow(
			TypeError
		);
		expect(packet.getLength()).toBe(34);
		expect(packet.dump().headerExtensionId).toBe(0xbede);
		expect(packet.getExtension(1)).toEqual(dataBuffer.subarray(0, 4));
		expect(packet.getExtension(2)).toBeUndefined();
		expect(packet.getPayload()).toEqual(dataBuffer.subarray(0, 10));
	});

	test('rtpPacket.setExtension() replaces a header extension without One-Byte or Two-Byte extensions', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x90, 0x01, 0x00, 0x08,
			0x00, 0x00, 0x00, 0x04,
			0x00, 0x00, 0x00, 0x05,
			0xa1, 0xb1, 0x00, 0x01, // Header extension id 0xA1B1, length 1.
			0xa2, 0xb2, 0xc2, 0xd2, // Header extension value.
			0x11, 0x22, 0x33, 0x44, // Payload.
		]);

		factoryBuffer.set(buffer);

		const packet = RtpPacket.parse(factoryBuffer, buffer.byteLength);

		checkRtpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: buffer.byteLength,
			payloadType: 1,
			marker: false,
			sequenceNumber: 8,
			timestamp: 4,
			ssrc: 5,
			hasCsrcs: false,
			hasHeaderExtension: true,
			headerExtensionValueLength: 4,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: false,
			hasPayload: true,
			payloadLength: 4,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.dump().headerExtensionId).toBe(0xa1b1);
		expect(packet.getExtensions().size).toBe(0);

		packet.setExtension(1, new Uint8Array([0xff]));

		expect(packet.dump().headerExtensionId).toBe(0xbede);
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.getExtension(1)).toEqual(new Uint8Array([0xff]));
		expect(packet.getLength()).toBe(buffer.byteLength);
		expect(packet.getPayload()).toEqual(
			new Uint8Array([0x11, 0x22, 0x33, 0x44])
		);
	});

	test('rtpPacket.setExtension() and rtpPacket.clearExtensions() in a new packet succeed', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setExtension(1, new Uint8Array([1, 2, 3, 4]));

		expect(packet.getExtensionsForm()).toBe('one-byte');
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.getExtension(1)).toEqual(new Uint8Array([1, 2, 3, 4]));
		// 12 (fixed header) + 4 (ext header) + 5 (extension id 1) = 21 => 24.
		expect(packet.getLength()).toBe(24);

		packet.clearExtensions();

		expect(packet.getExtensions().size).toBe(0);
		expect(packet.getExtension(1)).toBeUndefined();
		expect(packet.dump().headerExtensionId).toBeUndefined();
		expect(packet.getLength()).toBe(12);
	});

	test('rtpPacket.setCsrcs() succeeds', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setPayload(new Uint8Array([1, 2, 3, 4]));
		packet.setExtension(1, new Uint8Array([5, 6]));
		packet.padTo4Bytes();

		const length = packet.getLength();

		packet.setCsrcs([1111, 2222]);

		expect(packet.getCsrcs()).toEqual([1111, 2222]);
		expect(packet.getLength()).toBe(length + 8);
		expect(packet.getExtension(1)).toEqual(new Uint8Array([5, 6]));
		expect(packet.getPayload()).toEqual(new Uint8Array([1, 2, 3, 4]));
		expect(() => RtpPacket.parse(packet.getBuffer())).not.toThrow();

		packet.setCsrcs();

		expect(packet.getCsrcs()).toEqual([]);
		expect(packet.getLength()).toBe(length);
		expect(packet.getExtension(1)).toEqual(new Uint8Array([5, 6]));
		expect(packet.getPayload()).toEqual(new Uint8Array([1, 2, 3, 4]));

		expect(() => packet.setCsrcs(new Array<number>(16).fill(1))).toThrow(
			TypeError
		);
	});

	test('Packet extension setters fail if the extension type is not in the extension mapping', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		expect(packet.getMidExtension()).toBeUndefined();
		expect(() => packet.setMidExtension('foo')).toThrow(Error);
		expect(() => packet.setMidExtension()).toThrow(Error);

		packet.setExtensionMapping({ [ExtensionType.RTP_STREAM_ID]: 1 });

		expect(packet.getMidExtension()).toBeUndefined();
		expect(() => packet.setMidExtension('foo')).toThrow(Error);
		expect(() => packet.setRidExtension('foo')).not.toThrow();
		expect(packet.getRidExtension()).toBe('foo');
	});

	test('Packet audio level, video orientation, playout delay and abs capture time extensions succeed', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setExtensionMapping({
			[ExtensionType.SSRC_AUDIO_LEVEL]: 1,
			[ExtensionType.VIDEO_ORIENTATION]: 2,
			[ExtensionType.PLAYOUT_DELAY]: 3,
			[ExtensionType.ABS_CAPTURE_TIME]: 4,
		});

		packet.setSsrcAudioLevelExtension({ volume: 100, voice: true });

		expect(packet.getExtension(1)).toEqual(new Uint8Array([0b11100100]));
		expect(packet.getSsrcAudioLevelExtension()).toEqual({
			volume: 100,
			voice: true,
		});

		packet.setVideoOrientationExtension({
			camera: true,
			flip: true,
			rotation: 90,
		});

		expect(packet.getExtension(2)).toEqual(new Uint8Array([0b00001101]));
		expect(packet.getVideoOrientationExtension()).toEqual({
			camera: true,
			flip: true,
			rotation: 90,
		});

		expect(() =>
			packet.setVideoOrientationExtension({
				camera: true,
				flip: true,
				// @ts-expect-error --- Invalid rotation.
				rotation: 45,
			})
		).toThrow(TypeError);

		packet.setPlayoutDelayExtension({ minDelay: 100, maxDelay: 4000 });

		expect(packet.getExtension(3)).toEqual(new Uint8Array([0x06, 0x4f, 0xa0]));
		expect(packet.getPlayoutDelayExtension()).toEqual({
			minDelay: 100,
			maxDelay: 4000,
		});

		expect(() =>
			packet.setPlayoutDelayExtension({ minDelay: 0, maxDelay: 4096 })
		).toThrow(TypeError);

		packet.setAbsCaptureTimeExtension({
			absCaptureTimestamp: { seconds: 0x83aa7e80, fractions: 0x12345678 },
			estimatedCaptureClockOffset: { seconds: -1, fractions: 5 },
		});

		expect(packet.getExtension(4)?.byteLength).toBe(16);
		expect(packet.getAbsCaptureTimeExtension()).toEqual({
			absCaptureTimestamp: { seconds: 0x83aa7e80, fractions: 0x12345678 },
			estimatedCaptureClockOffset: { seconds: -1, fractions: 5 },
		});

		expect(() => RtpPacket.parse(packet.getBuffer())).not.toThrow();

		packet.setSsrcAudioLevelExtension();
		packet.setVideoOrientationExtension();
		packet.setPlayoutDelayExtension();
		packet.setAbsCaptureTimeExtension();

		expect(packet.getExtensions().size).toBe(0);
		expect(packet.getLength()).toBe(12);
	});

	test('Packet setters fail if wrong values are given', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setExtensionMapping({
			[ExtensionType.ABS_SEND_TIME]: 1,
			[ExtensionType.TRANSPORT_WIDE_CC_01]: 2,
			[ExtensionType.SSRC_AUDIO_LEVEL]: 3,
			[ExtensionType.ABS_CAPTURE_TIME]: 4,
			[ExtensionType.PLAYOUT_DELAY]: 5,
		});
		packet.setPayload(new Uint8Array([1, 2, 3, 4]));

		const buffer = packet.getBuffer().slice();

		for (const value of [128, -1, 1.5]) {
			expect(() => packet.setPayloadType(value)).toThrow(TypeError);
		}

		for (const value of [0x10000, -1, 1.5]) {
			expect(() => packet.setSequenceNumber(value)).toThrow(TypeError);
			expect(() => packet.setTransportWideCc01Extension(value)).toThrow(
				TypeError
			);
		}

		for (const value of [0x100000000, -1, 1.5]) {
			expect(() => packet.setTimestamp(value)).toThrow(TypeError);
			expect(() => packet.setSsrc(value)).toThrow(TypeError);
			expect(() => packet.setCsrcs([1, value])).toThrow(TypeError);
			expect(() =>
				packet.setAbsCaptureTimeExtension({
					absCaptureTimestamp: { seconds: value, fractions: 0 },
				})
			).toThrow(TypeError);
			expect(() =>
				packet.setAbsCaptureTimeExtension({
					absCaptureTimestamp: { seconds: 0, fractions: value },
				})
			).toThrow(TypeError);
			expect(() =>
				packet.setAbsCaptureTimeExtension({
					absCaptureTimestamp: { seconds: 0, fractions: 0 },
					estimatedCaptureClockOffset: { seconds: 0, fractions: value },
				})
			).toThrow(TypeError);
		}

		for (const value of [0x80000000, -0x80000001, 1.5]) {
			expect(() =>
				packet.setAbsCaptureTimeExtension({
					absCaptureTimestamp: { seconds: 0, fractions: 0 },
					estimatedCaptureClockOffset: { seconds: value, fractions: 0 },
				})
			).toThrow(TypeError);
		}

		for (const value of [0x1000000, -1, 1.5]) {
			expect(() => packet.setAbsSendTimeExtension(value)).toThrow(TypeError);
		}

		for (const value of [128, -1, 1.5]) {
			expect(() =>
				packet.setSsrcAudioLevelExtension({ volume: value, voice: true })
			).toThrow(TypeError);
		}

		for (const value of [0x1000, -1, 1.5]) {
			expect(() =>
				packet.setPlayoutDelayExtension({ minDelay: value, maxDelay: 0 })
			).toThrow(TypeError);
			expect(() =>
				packet.setPlayoutDelayExtension({ minDelay: 0, maxDelay: value })
			).toThrow(TypeError);
		}

		expect(() => packet.rtxEncode(128, 1, 1)).toThrow(TypeError);
		expect(() => packet.rtxEncode(1, -1, 1)).toThrow(TypeError);
		expect(() => packet.rtxEncode(1, 1, 0x10000)).toThrow(TypeError);
		expect(() => packet.rtxDecode(128, 1)).toThrow(TypeError);
		expect(() => packet.rtxDecode(1, 1.5)).toThrow(TypeError);

		expect(packet.getBuffer()).toEqual(buffer);
	});

	test('rtpPacket.setPayload() and rtpPacket.removePayload() succeed', () => {
		const packet = RtpPacket.factory(factoryBuffer);
		// prettier-ignore
		const payload = new Uint8Array([
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
			0x99, 0xaa,
		]);
		const expected: ExpectedRtpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 12 + 10 + 2,
			payloadType: 0,
			marker: false,
			sequenceNumber: 0,
			timestamp: 0,
			ssrc: 0,
			hasCsrcs: false,
			hasHeaderExtension: false,
			headerExtensionValueLength: 0,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: false,
			hasPayload: true,
			payloadLength: 10,
			hasPadding: true,
			padding: 2,
		};

		/* Set payload. */

		packet.setPayload(payload);
		packet.padTo4Bytes();

		checkRtpPacket(packet, expected);

		/* Set a bigger payload. */

		packet.setPayload(new Uint8Array(501));

		checkRtpPacket(packet, {
			...expected,
			length: 12 + 501,
			payloadLength: 501,
			hasPadding: false,
			padding: 0,
		});

		/* Remove payload. */

		// This method removes padding.
		packet.removePayload();

		checkRtpPacket(packet, {
			...expected,
			length: 12,
			hasPayload: false,
			payloadLength: 0,
			hasPadding: false,
			padding: 0,
		});
	});

	test('rtpPacket.padTo4Bytes() succeeds', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setPayload(new Uint8Array([1, 2, 3, 4]));

		expect(packet.getLength()).toBe(16);

		// Nothing to do since already padded to 4 bytes.
		packet.padTo4Bytes();

		expect(packet.getLength()).toBe(16);
		expect(packet.getPadding()).toBe(0);

		packet.setPayload(new Uint8Array([1, 2, 3, 4, 5]));

		expect(packet.getLength()).toBe(17);

		packet.padTo4Bytes();

		expect(packet.getLength()).toBe(20);
		expect(packet.getPadding()).toBe(3);
		expect(packet.getBuffer().subarray(17)).toEqual(
			new Uint8Array([0x00, 0x00, 0x03])
		);
	});

	test('rtpPacket.shiftPayload() succeeds', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setSsrc(12344321);

		// prettier-ignore
		const payload = new Uint8Array([
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
			0x99, 0xaa,
		]);

		packet.setPayload(payload);
		packet.padTo4Bytes();

		// One-Byte extensions:
		// - Header extension value length: 1 + 1 + 1 + 2 + 1 + 3 = 9 => 12 (padded)
		// - Header extension length: 4 + 12 = 16
		const extension1 = new Uint8Array([0x12]);
		const extension2 = new Uint8Array([0x34, 0x56]);
		const extension3 = new Uint8Array([0x78, 0x9a, 0xbc]);

		packet.setExtension(1, extension1);
		packet.setExtension(2, extension2);
		packet.setExtension(3, extension3);

		const expected: ExpectedRtpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 12 + 16 + 10 + 2,
			payloadType: 0,
			marker: false,
			sequenceNumber: 0,
			timestamp: 0,
			ssrc: 12344321,
			hasCsrcs: false,
			hasHeaderExtension: true,
			headerExtensionValueLength: 12,
			hasOneByteExtensions: true,
			hasTwoByteExtensions: false,
			hasPayload: true,
			payloadLength: 10,
			hasPadding: true,
			padding: 2,
		};

		checkRtpPacket(packet, expected);

		expect(packet.getExtension(1)).toEqual(extension1);
		expect(packet.getExtension(2)).toEqual(extension2);
		expect(packet.getExtension(3)).toEqual(extension3);
		expect(packet.getPayload()).toEqual(payload);
		expect(packet.getLength() % 4).toBe(0);

		/* Shift payload. */

		// This method removes padding.
		packet.shiftPayload(2, 1);

		// Fill the new byte in the payload with 0xFF.
		packet.getPayload()[2] = 0xff;

		// prettier-ignore
		const shiftedPayload = new Uint8Array([
			0x11, 0x22, 0xff, 0x33,
			0x44, 0x55, 0x66, 0x77,
			0x88, 0x99, 0xaa,
		]);

		checkRtpPacket(packet, {
			...expected,
			length: 12 + 16 + 10 + 1,
			payloadLength: 11,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getExtension(1)).toEqual(extension1);
		expect(packet.getExtension(2)).toEqual(extension2);
		expect(packet.getExtension(3)).toEqual(extension3);
		expect(packet.getPayload()).toEqual(shiftedPayload);
		expect(packet.getLength() % 4).not.toBe(0);

		// Reset the payload and padding.
		packet.setPayload(payload);
		packet.padTo4Bytes();

		/* Unshift payload. */

		// This method removes padding.
		packet.shiftPayload(4, -2);

		// prettier-ignore
		const unshiftedPayload = new Uint8Array([
			0x11, 0x22, 0x33, 0x44,
			0x77, 0x88, 0x99, 0xaa,
		]);

		checkRtpPacket(packet, {
			...expected,
			length: 12 + 16 + 10 - 2,
			payloadLength: 8,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getExtension(1)).toEqual(extension1);
		expect(packet.getExtension(2)).toEqual(extension2);
		expect(packet.getExtension(3)).toEqual(extension3);
		expect(packet.getPayload()).toEqual(unshiftedPayload);
		expect(packet.getLength() % 4).toBe(0);

		// Reset the payload and padding.
		packet.setPayload(payload);
		packet.padTo4Bytes();

		/* Shift and unshift (undo). */

		packet.shiftPayload(3, 5);
		packet.shiftPayload(3, -5);

		expect(packet.getPayload()).toEqual(payload);
	});

	test('rtpPacket.shiftPayload() fails if wrong values are given', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		// prettier-ignore
		const payload = new Uint8Array([
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
			0x99, 0xaa,
		]);

		packet.setPayload(payload);

		// payloadOffset higher or equal than payload length.
		expect(() => packet.shiftPayload(10, 2)).toThrow(TypeError);

		// delta too big.
		expect(() => packet.shiftPayload(2, -9)).toThrow(TypeError);

		// New computed payload length too big.
		expect(() => packet.shiftPayload(2, packet.getBufferLength())).toThrow(
			TypeError
		);

		const buffer = packet.getBuffer().slice();

		// payloadOffset is not an unsigned integer.
		expect(() => packet.shiftPayload(-1, 1)).toThrow(TypeError);
		expect(() => packet.shiftPayload(1.5, 1)).toThrow(TypeError);
		expect(() => packet.shiftPayload(NaN, 1)).toThrow(TypeError);

		// delta is not an integer.
		expect(() => packet.shiftPayload(2, 1.5)).toThrow(TypeError);
		expect(() => packet.shiftPayload(2, NaN)).toThrow(TypeError);

		expect(packet.getBuffer()).toEqual(buffer);
	});

	test('rtpPacket.rtxEncode() and rtpPacket.rtxDecode() succeed', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setPayloadType(100);
		packet.setSequenceNumber(12345);
		packet.setTimestamp(987654321);
		packet.setSsrc(1234567890);

		// prettier-ignore
		const payload = new Uint8Array([
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
			0x99, 0xaa,
		]);

		packet.setPayload(payload);
		packet.padTo4Bytes();

		const expected: ExpectedRtpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 12 + 10 + 2,
			payloadType: 100,
			marker: false,
			sequenceNumber: 12345,
			timestamp: 987654321,
			ssrc: 1234567890,
			hasCsrcs: false,
			hasHeaderExtension: false,
			headerExtensionValueLength: 0,
			hasOneByteExtensions: false,
			hasTwoByteExtensions: false,
			hasPayload: true,
			payloadLength: 10,
			hasPadding: true,
			padding: 2,
		};

		checkRtpPacket(packet, expected);

		expect(packet.getLength() % 4).toBe(0);

		/* RTX encode. */

		// This method removes padding.
		packet.rtxEncode(111, 999999, 666);

		checkRtpPacket(packet, {
			...expected,
			length: 12 + 10 + 2,
			payloadType: 111,
			sequenceNumber: 666,
			ssrc: 999999,
			payloadLength: 12,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getLength() % 4).toBe(0);

		/* RTX decode. */

		// This method removes padding.
		expect(packet.rtxDecode(100, 1234567890)).toBe(true);

		checkRtpPacket(packet, {
			...expected,
			length: 12 + 10,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getPayload()).toEqual(payload);
		expect(packet.getLength() % 4).not.toBe(0);
	});

	test('rtpPacket.rtxDecode() of a packet received as RTX succeeds', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		// What arrives over RTX: the RTX payload type and SSRC, and the original
		// sequence number at the beginning of the payload.
		packet.setPayloadType(111);
		packet.setSequenceNumber(666);
		packet.setSsrc(999999);

		packet.setPayload(new Uint8Array([0x30, 0x39, 0x11, 0x22, 0x33, 0x44]));

		expect(packet.rtxDecode(100, 1234567890)).toBe(true);
		expect(packet.getPayloadType()).toBe(100);
		expect(packet.getSsrc()).toBe(1234567890);
		expect(packet.getSequenceNumber()).toBe(12345);
		expect(packet.getPayload()).toEqual(
			new Uint8Array([0x11, 0x22, 0x33, 0x44])
		);
	});

	test('rtpPacket.rtxDecode() fails without modifying the packet if the payload is too short', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setPayloadType(111);
		packet.setSequenceNumber(666);
		packet.setSsrc(999999);
		packet.setPayload(new Uint8Array([0x30]));

		const buffer = packet.getBuffer().slice();

		expect(packet.rtxDecode(100, 1234567890)).toBe(false);
		expect(packet.getBuffer()).toEqual(buffer);
	});

	test('rtpPacket.rtxEncode() does not write beyond the new packet length', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		// prettier-ignore
		const payload = new Uint8Array([
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
			0x99, 0xaa,
		]);

		packet.setPayload(payload);

		const length = packet.getLength();

		expect(length).toBe(12 + 10);

		// Bytes that will belong to the packet once RTX encoded, and canary bytes
		// right after them.
		factoryBuffer[length] = 0x55;
		factoryBuffer[length + 1] = 0x55;
		factoryBuffer[length + 2] = 0xee;
		factoryBuffer[length + 3] = 0xee;

		packet.rtxEncode(111, 999999, 666);

		expect(packet.getLength()).toBe(length + 2);
		expect(packet.getPayload().byteLength).toBe(12);
		expect(factoryBuffer[length + 2]).toBe(0xee);
		expect(factoryBuffer[length + 3]).toBe(0xee);
		expect(packet.getPayload().subarray(2)).toEqual(payload);
	});

	test('rtpPacket.serialize() into a given buffer succeeds', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setPayload(new Uint8Array([1, 2, 3, 4]));

		const packetBuffer = packet.getBuffer().slice();
		const buffer = new Uint8Array(2000);
		const byteOffset = 135;

		packet.serialize(buffer.subarray(byteOffset));

		expect(packet.getBuffer()).toEqual(packetBuffer);
		expect(packet.getBuffer().buffer).toBe(buffer.buffer);
		expect(packet.getBuffer().byteOffset).toBe(byteOffset);
		expect(packet.getBufferLength()).toBe(2000 - byteOffset);
		expect(packet.getPayload()).toEqual(new Uint8Array([1, 2, 3, 4]));
	});

	test('rtpPacket.serialize() into its own buffer with overlapping bytes succeeds', () => {
		const buffer = new Uint8Array(100);
		const packet = RtpPacket.factory(buffer.subarray(10));

		packet.setSequenceNumber(55555);
		packet.setPayload(new Uint8Array([1, 2, 3, 4]));

		const packetBuffer = packet.getBuffer().slice();

		packet.serialize(buffer.subarray(12));

		expect(packet.getBuffer()).toEqual(packetBuffer);
		expect(packet.getBuffer().byteOffset).toBe(12);
		expect(packet.getSequenceNumber()).toBe(55555);
		expect(packet.getPayload()).toEqual(new Uint8Array([1, 2, 3, 4]));

		packet.serialize(buffer.subarray(8));

		expect(packet.getBuffer()).toEqual(packetBuffer);
		expect(packet.getBuffer().byteOffset).toBe(8);
		expect(packet.getSequenceNumber()).toBe(55555);
		expect(packet.getPayload()).toEqual(new Uint8Array([1, 2, 3, 4]));
	});

	test('rtpPacket.clone() into a given buffer succeeds', () => {
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setExtensionMapping({ [ExtensionType.MID]: 1 });
		packet.setMidExtension('foo');
		packet.setPayload(new Uint8Array([1, 2, 3, 4]));

		const buffer = new Uint8Array(2000);
		const byteOffset = 135;
		const clonedPacket = packet.clone(buffer.subarray(byteOffset));

		expect(clonedPacket.getBuffer()).toEqual(packet.getBuffer());
		expect(clonedPacket.getBuffer().buffer).toBe(buffer.buffer);
		expect(clonedPacket.getBuffer().byteOffset).toBe(byteOffset);
		expect(clonedPacket.getExtensionMapping()).toEqual(
			packet.getExtensionMapping()
		);
		expect(clonedPacket.dump()).toEqual({
			...packet.dump(),
			bufferLength: 2000 - byteOffset,
		});

		// The cloned packet doesn't share memory with the original one.
		packet.setMidExtension('bar');

		expect(clonedPacket.getMidExtension()).toBe('foo');
	});

	test('rtpPacket.clone() fails if the given buffer overlaps the packet', () => {
		const buffer = new Uint8Array(100);
		const packet = RtpPacket.factory(buffer.subarray(0, 50));

		packet.setSequenceNumber(7);
		packet.setPayload(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

		const packetBuffer = packet.getBuffer().slice();

		expect(() => packet.clone(buffer.subarray(4))).toThrow(TypeError);
		expect(packet.getBuffer()).toEqual(packetBuffer);

		// Same ArrayBuffer but without overlapping bytes.
		const clonedPacket = packet.clone(buffer.subarray(50));

		expect(clonedPacket.getBuffer()).toEqual(packetBuffer);
		expect(packet.getBuffer()).toEqual(packetBuffer);
	});
});
