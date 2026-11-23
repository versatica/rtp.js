import { ByePacket } from '../../../packets/RTCP/ByePacket';
import { PacketType } from '../../../packets/RTCP/Packet';
import { checkPacket, type ExpectedPacket } from './rtcpCommon';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers';

beforeEach(resetBuffers);

describe('RTCP BYE Packet', () => {
	test('ByePacket.parse() succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, SC=3, PT:203, Length: 5
			0b10000011, 0xcb, 0x00, 0x05,
			// SSRC 1: 1111111
			0x00, 0x10, 0xf4, 0x47,
			// SSRC 2: 2222222
			0x00, 0x21, 0xe8, 0x8e,
			// SSRC 3: 12345678
			0x00, 0xbc, 0x61, 0x4e,
			// Reason length: 6, Reason: "foo"
			0x06, 0x66, 0x6f, 0x6f,
			// Reason: "bar", 1 byte of padding
			0x62, 0x61, 0x72, 0x00,
		]);
		const packet = ByePacket.parse(buffer);
		const expected: ExpectedPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 24,
			packetType: PacketType.BYE,
			hasPadding: false,
			padding: 0,
		};

		checkPacket(packet, expected);

		expect(packet.getSsrcs()).toEqual([1111111, 2222222, 12345678]);
		expect(packet.getReason()).toBe('foobar');
		// Check padding bytes.
		expect(packet.getBuffer()[packet.getLength() - 1]).toBe(0);
		expect(packet.getBuffer()[packet.getLength() - 2]).toBe('r'.charCodeAt(0));

		// No space to add more ssrcs.
		expect(() => packet.addSsrc(3333)).toThrow(TypeError);
		// No space for a reason larger than the current one.
		expect(() => packet.setReason('lolololo')).toThrow(TypeError);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xff);

		checkPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		expect(packet.getSsrcs()).toEqual([1111111, 2222222, 12345678]);
		expect(packet.getReason()).toBe('foobar');
		// Check padding bytes.
		expect(packet.getBuffer()[packet.getLength() - 1]).toBe(0);
		expect(packet.getBuffer()[packet.getLength() - 2]).toBe('r'.charCodeAt(0));

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		expect(clonedPacket.getSsrcs()).toEqual([1111111, 2222222, 12345678]);
		expect(clonedPacket.getReason()).toBe('foobar');
		// Check padding bytes.
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 1]).toBe(0);
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 2]).toBe(
			'r'.charCodeAt(0)
		);

		/* Modify it. */

		clonedPacket.addSsrc(3333);

		checkPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 28,
		});

		expect(clonedPacket.getSsrcs()).toEqual([1111111, 2222222, 12345678, 3333]);
		expect(clonedPacket.getReason()).toBe('foobar');
		// Check padding bytes.
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 1]).toBe(0);
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 2]).toBe(
			'r'.charCodeAt(0)
		);

		clonedPacket.setReason('');

		checkPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 20,
		});

		expect(clonedPacket.getSsrcs()).toEqual([1111111, 2222222, 12345678, 3333]);
		expect(clonedPacket.getReason()).toBeUndefined();

		clonedPacket.setReason('abcde');

		checkPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 28,
		});

		expect(clonedPacket.getSsrcs()).toEqual([1111111, 2222222, 12345678, 3333]);
		expect(clonedPacket.getReason()).toBe('abcde');
		// Check padding bytes.
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 1]).toBe(0);
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 2]).toBe(0);
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 3]).toBe(
			'e'.charCodeAt(0)
		);
	});

	test('ByePacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, SC=1, PT:203, Length: 4
			0b10100001, 0xcb, 0x00, 0x04,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
			// Reason length: 3, Reason: "abc"
			0x03, 0x61, 0x62, 0x63,
			// Padding: 8 bytes
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x08,
		]);
		const packet = ByePacket.parse(buffer);
		const expected: ExpectedPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 20,
			packetType: PacketType.BYE,
			hasPadding: true,
			padding: 8,
		};

		checkPacket(packet, expected);

		expect(packet.getSsrcs()).toEqual([1111]);
		expect(packet.getReason()).toBe('abc');

		/* Modify it (it removes the padding). */

		packet.addSsrc(2222);

		checkPacket(packet, {
			...expected,
			length: 16,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getSsrcs()).toEqual([1111, 2222]);
		expect(packet.getReason()).toBe('abc');
	});

	test('ByePacket.parse() with padding and setReason() succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, SC=1, PT:203, Length: 3
			0b10100001, 0xcb, 0x00, 0x03,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
			// Padding: 8 bytes
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x08,
		]);
		const packet = ByePacket.parse(buffer);
		const expected: ExpectedPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 16,
			packetType: PacketType.BYE,
			hasPadding: true,
			padding: 8,
		};

		checkPacket(packet, expected);

		expect(packet.getSsrcs()).toEqual([1111]);
		expect(packet.getReason()).toBeUndefined();

		/* Modify it (it removes the padding). */

		packet.setReason('abc');

		checkPacket(packet, {
			...expected,
			length: 12,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getSsrcs()).toEqual([1111]);
		expect(packet.getReason()).toBe('abc');
	});

	test('ByePacket.parse() fails', () => {
		// Length field should be 5 (24 bytes).
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, SC=3, PT:203, Length: 6
			0b10000011, 0xcb, 0x00, 0x06,
			// SSRC 1: 1111111
			0x00, 0x10, 0xf4, 0x47,
			// SSRC 2: 2222222
			0x00, 0x21, 0xe8, 0x8e,
			// SSRC 3: 12345678
			0x00, 0xbc, 0x61, 0x4e,
			// Reason length: 6, Reason: "foo"
			0x06, 0x66, 0x6f, 0x6f,
			// Reason: "bar", 1 byte of padding
			0x62, 0x61, 0x72, 0x00,
		]);

		expect(() => ByePacket.parse(buffer1)).toThrow(TypeError);

		// SC should be 3 instead of 4 (first byte should be 0b10000011). So the
		// parser ends reading a wrong value of the Reason length field and fails.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, SC=4, PT:203, Length: 5
			0b10000100, 0xcb, 0x00, 0x05,
			// SSRC 1: 1111111
			0x00, 0x10, 0xf4, 0x47,
			// SSRC 2: 2222222
			0x00, 0x21, 0xe8, 0x8e,
			// SSRC 3: 12345678
			0x00, 0xbc, 0x61, 0x4e,
			// Reason length: 6, Reason: "foo"
			0x06, 0x66, 0x6f, 0x6f,
			// Reason: "bar", 1 byte of padding
			0x62, 0x61, 0x72, 0x00,
		]);

		expect(() => ByePacket.parse(buffer2)).toThrow(TypeError);

		// parse() called with less buffer length than needed.
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, SC=3, PT:203, Length: 5
			0b10000011, 0xcb, 0x00, 0x05,
			// SSRC 1: 1111111
			0x00, 0x10, 0xf4, 0x47,
			// SSRC 2: 2222222
			0x00, 0x21, 0xe8, 0x8e,
			// SSRC 3: 12345678
			0x00, 0xbc, 0x61, 0x4e,
			// Reason length: 6, Reason: "foo"
			0x06, 0x66, 0x6f, 0x6f,
			// Reason: "bar", 1 byte of padding
			0x62, 0x61, 0x72, 0x00,
		]);

		expect(() =>
			ByePacket.parse(buffer3.subarray(0, buffer3.byteLength - 1))
		).toThrow(TypeError);

		// Length field should be 2 (12 bytes) since the packet must end right
		// after the padded Reason, but it announces 4 extra bytes.
		// prettier-ignore
		const buffer4 = new Uint8Array([
			// V=2, P=0, SC=1, PT:203, Length: 3
			0b10000001, 0xcb, 0x00, 0x03,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
			// Reason length: 1, Reason: "a", 2 bytes of padding
			0x01, 0x61, 0x00, 0x00,
			// 4 extra bytes
			0x11, 0x22, 0x33, 0x44,
		]);

		expect(() => ByePacket.parse(buffer4)).toThrow(TypeError);

		// Padding bytes of the Reason must be zero.
		// prettier-ignore
		const buffer5 = new Uint8Array([
			// V=2, P=0, SC=1, PT:203, Length: 2
			0b10000001, 0xcb, 0x00, 0x02,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
			// Reason length: 1, Reason: "a", 2 bytes of padding (one not zero)
			0x01, 0x61, 0x00, 0x01,
		]);

		expect(() => ByePacket.parse(buffer5)).toThrow(TypeError);
	});

	test('ByePacket.factory() succeeds', () => {
		const packet = ByePacket.factory(factoryBuffer);
		const expected: ExpectedPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 4,
			packetType: PacketType.BYE,
			hasPadding: false,
			padding: 0,
		};

		checkPacket(packet, expected);

		expect(packet.getSsrcs()).toEqual([]);
		expect(packet.getReason()).toBeUndefined();

		/* Modify it. */

		packet.addSsrc(1111);
		packet.addSsrc(2222);
		// Reason string is 25 bytes, so padded(1 + 25) is needed = 28 bytes.
		packet.setReason("amazing reason, isn't it?");
		packet.addSsrc(3333);

		checkPacket(packet, {
			...expected,
			length: 4 + 4 + 4 + 4 + 28,
		});

		expect(packet.getSsrcs()).toEqual([1111, 2222, 3333]);
		expect(packet.getReason()).toBe("amazing reason, isn't it?");
		// Check padding bytes.
		expect(packet.getBuffer()[packet.getLength() - 1]).toBe(0);
		expect(packet.getBuffer()[packet.getLength() - 2]).toBe(0);
		expect(packet.getBuffer()[packet.getLength() - 3]).toBe('?'.charCodeAt(0));

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		checkPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 4 + 4 + 4 + 4 + 28,
		});

		expect(packet.getSsrcs()).toEqual([1111, 2222, 3333]);
		expect(packet.getReason()).toBe("amazing reason, isn't it?");
		// Check padding bytes.
		expect(packet.getBuffer()[packet.getLength() - 1]).toBe(0);
		expect(packet.getBuffer()[packet.getLength() - 2]).toBe(0);
		expect(packet.getBuffer()[packet.getLength() - 3]).toBe('?'.charCodeAt(0));

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 4 + 4 + 4 + 4 + 28,
		});

		expect(clonedPacket.getSsrcs()).toEqual([1111, 2222, 3333]);
		expect(clonedPacket.getReason()).toBe("amazing reason, isn't it?");
		// Check padding bytes.
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 1]).toBe(0);
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 2]).toBe(0);
		expect(clonedPacket.getBuffer()[clonedPacket.getLength() - 3]).toBe(
			'?'.charCodeAt(0)
		);
	});

	test('ByePacket.addSsrc() and setSsrcs() fail with more than 31 SSRCs', () => {
		const packet = ByePacket.factory(factoryBuffer);
		const ssrcs = Array.from({ length: 31 }, (_, idx) => idx + 1);

		packet.setSsrcs(ssrcs);

		expect(packet.getSsrcs()).toEqual(ssrcs);
		expect(() => packet.addSsrc(32)).toThrow(TypeError);
		expect(() => packet.setSsrcs([...ssrcs, 32])).toThrow(TypeError);
		expect(packet.getSsrcs()).toEqual(ssrcs);
		expect(packet.getLength()).toBe(4 + 31 * 4);
	});
});
