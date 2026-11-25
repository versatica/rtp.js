import { PliPacket } from '../../../packets/RTCP/PliPacket.js';
import { PayloadSpecificFeedbackMessageType } from '../../../packets/RTCP/AnyPayloadSpecificFeedbackPacket.js';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.js';
import { areBuffersEqual } from '../../../utils/buffers.js';
import { checkRtcpPacket, type ExpectedRtcpPacket } from './rtcpCommon.js';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers.js';

beforeEach(resetBuffers);

describe('RTCP PLI Packet', () => {
	test('PliPacket.parse() succeeds', () => {
		function checkFields(packet: PliPacket): void {
			expect(packet.getMessageType()).toBe(
				PayloadSpecificFeedbackMessageType.PLI
			);
			expect(packet.getSenderSsrc()).toBe(0x12345678);
			expect(packet.getMediaSsrc()).toBe(0x23456789);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, FMT=1, PT:206, Length: 2
			0b10000001, 0xce, 0x00, 0x02,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0x23456789
			0x23, 0x45, 0x67, 0x89,
		]);
		const packet = PliPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 12,
			packetType: RtcpPacketType.PSFB,
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

	test('PliPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, FMT=1, PT:206, Length: 3
			0b10100001, 0xce, 0x00, 0x03,
			// Sender SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// Media SSRC: 2222
			0x00, 0x00, 0x08, 0xae,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
		]);
		const packet = PliPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 16,
			packetType: RtcpPacketType.PSFB,
			hasPadding: true,
			padding: 4,
		});

		expect(packet.getSenderSsrc()).toBe(1111);
		expect(packet.getMediaSsrc()).toBe(2222);
	});

	test('PliPacket.parse() fails', () => {
		// No space for the SSRC of media source.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, FMT=1, PT:206, Length: 1
			0b10000001, 0xce, 0x00, 0x01,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
		]);

		expect(() => PliPacket.parse(buffer1)).toThrow(TypeError);

		// Length field must be 2 since PLI has no Feedback Control Information
		// (FCI).
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, FMT=1, PT:206, Length: 3
			0b10000001, 0xce, 0x00, 0x03,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0x23456789
			0x23, 0x45, 0x67, 0x89,
			// 4 extra bytes
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => PliPacket.parse(buffer2)).toThrow(TypeError);

		// Wrong message type (FMT 4, FIR).
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, FMT=4, PT:206, Length: 2
			0b10000100, 0xce, 0x00, 0x02,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0x23456789
			0x23, 0x45, 0x67, 0x89,
		]);

		expect(() => PliPacket.parse(buffer3)).toThrow(TypeError);
	});

	test('PliPacket.factory() succeeds', () => {
		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			// V=2, P=0, FMT=1, PT:206, Length: 2
			0b10000001, 0xce, 0x00, 0x02,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0x23456789
			0x23, 0x45, 0x67, 0x89,
		]);

		// Dirty the buffer to check that factory() writes zeros in the feedback
		// header.
		factoryBuffer.fill(0xff);

		const packet = PliPacket.factory(factoryBuffer);

		checkRtcpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 12,
			packetType: RtcpPacketType.PSFB,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getMessageType()).toBe(
			PayloadSpecificFeedbackMessageType.PLI
		);
		expect(packet.getSenderSsrc()).toBe(0);
		expect(packet.getMediaSsrc()).toBe(0);

		/* Modify it. */

		packet.setSenderSsrc(0x12345678);
		packet.setMediaSsrc(0x23456789);

		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);
	});

	test('PliPacket.factory() throws if the buffer is too small', () => {
		expect(() => PliPacket.factory(factoryBuffer.subarray(0, 11))).toThrow(
			TypeError
		);
	});
});
