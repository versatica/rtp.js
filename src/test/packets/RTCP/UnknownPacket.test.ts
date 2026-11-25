import { UnknownPacket } from '../../../packets/RTCP/UnknownPacket.js';
import type { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.js';
import { checkRtcpPacket, type ExpectedRtcpPacket } from './rtcpCommon.js';
import {
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers.js';

beforeEach(resetBuffers);

describe('RTCP Unknown Packet', () => {
	test('UnknownPacket.parse() succeeds', () => {
		function checkFields(packet: UnknownPacket): void {
			expect(packet.getUnknownValue().byteLength).toBe(8);
			expect(packet.getUnknownValue()[0]).toBe(0x11);
			expect(packet.getUnknownValue()[1]).toBe(0x22);
			expect(packet.getUnknownValue()[7]).toBe(0x88);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, SC=5, PT:222, Length: 2
			0b10000101, 0xde, 0x00, 0x02,
			// 8 bytes of value
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
		]);
		const packet = UnknownPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 12,
			packetType: 222 as RtcpPacketType,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		checkFields(packet);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xff);

		checkRtcpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		checkFields(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		checkFields(clonedPacket);
	});

	test('UnknownPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, Count=5, PT:222, Length: 2
			0b10100101, 0xde, 0x00, 0x02,
			// 5 bytes of value
			0x11, 0x22, 0x33, 0x44,
			0x55,
			// Padding: 3 bytes
			0x00, 0x00, 0x03,
		]);
		const packet = UnknownPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 12,
			packetType: 222 as RtcpPacketType,
			hasPadding: true,
			padding: 3,
		});

		expect(packet.getUnknownValue().byteLength).toBe(5);
		expect(packet.getUnknownValue()[0]).toBe(0x11);
		expect(packet.getUnknownValue()[4]).toBe(0x55);
	});

	test('UnknownPacket.parse() with only padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, Count=5, PT:222, Length: 1
			0b10100101, 0xde, 0x00, 0x01,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
		]);
		const packet = UnknownPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 8,
			packetType: 222 as RtcpPacketType,
			hasPadding: true,
			padding: 4,
		});

		expect(packet.getUnknownValue().byteLength).toBe(0);
	});

	test('UnknownPacket.parse() without value succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, Count=0, PT:222, Length: 0
			0b10000000, 0xde, 0x00, 0x00,
		]);
		const packet = UnknownPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 4,
			packetType: 222 as RtcpPacketType,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getUnknownValue().byteLength).toBe(0);
	});
});
