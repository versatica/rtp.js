import { UnknownTransportLayerFeedbackPacket } from '../../../packets/RTCP/UnknownTransportLayerFeedbackPacket';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { checkRtcpPacket, type ExpectedRtcpPacket } from './rtcpCommon';
import { serializeBuffer, cloneBuffer, resetBuffers } from '../../testHelpers';

beforeEach(resetBuffers);

describe('RTCP Unknown Transport Layer Feedback Packet', () => {
	test('UnknownTransportLayerFeedbackPacket.parse() succeeds', () => {
		function checkFields(packet: UnknownTransportLayerFeedbackPacket): void {
			expect(packet.getMessageType()).toBe(3);
			expect(packet.getSenderSsrc()).toBe(0x5d931534);
			expect(packet.getMediaSsrc()).toBe(0x01932db4);
			expect(packet.getUnknownValue().byteLength).toBe(8);
			expect(packet.getUnknownValue()[0]).toBe(0x11);
			expect(packet.getUnknownValue()[1]).toBe(0x22);
			expect(packet.getUnknownValue()[7]).toBe(0x88);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, FMT=3, PT:205, Length: 4
			0b10000011, 0xcd, 0x00, 0x04,
			// SSRC of packet sender: 0x5d931534
			0x5d, 0x93, 0x15, 0x34,
			// SSRC of media source: 0x01932db4
			0x01, 0x93, 0x2d, 0xb4,
			// 8 bytes of value
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
		]);
		const packet = UnknownTransportLayerFeedbackPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 20,
			packetType: RtcpPacketType.RTPFB,
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

	test('UnknownTransportLayerFeedbackPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, FMT=15, PT:205, Length: 3
			0b10101111, 0xcd, 0x00, 0x03,
			// Sender SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// Media SSRC: 2222
			0x00, 0x00, 0x08, 0xae,
			// 2 bytes of value, Padding: 2 bytes
			0xaa, 0xbb, 0x00, 0x02,
		]);
		const packet = UnknownTransportLayerFeedbackPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 16,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: true,
			padding: 2,
		});

		expect(packet.getSenderSsrc()).toBe(1111);
		expect(packet.getMediaSsrc()).toBe(2222);
		expect(packet.getUnknownValue().byteLength).toBe(2);
		expect(packet.getUnknownValue()[0]).toBe(0xaa);
		expect(packet.getUnknownValue()[1]).toBe(0xbb);
	});

	test('UnknownTransportLayerFeedbackPacket.parse() without value succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, FMT=3, PT:205, Length: 2
			0b10000011, 0xcd, 0x00, 0x02,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
		]);
		const packet = UnknownTransportLayerFeedbackPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 12,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getSenderSsrc()).toBe(1111);
		expect(packet.getMediaSsrc()).toBe(2222);
		expect(packet.getUnknownValue().byteLength).toBe(0);
	});

	test('UnknownTransportLayerFeedbackPacket.parse() fails', () => {
		// No space for the SSRC of media source.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, FMT=3, PT:205, Length: 1
			0b10000011, 0xcd, 0x00, 0x01,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
		]);

		expect(() => UnknownTransportLayerFeedbackPacket.parse(buffer1)).toThrow(
			TypeError
		);
	});
});
