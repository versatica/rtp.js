import { NackPacket } from '../../../packets/RTCP/NackPacket.js';
import { TransportLayerFeedbackMessageType } from '../../../packets/RTCP/AnyTransportLayerFeedbackPacket.js';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.js';
import { checkRtcpPacket, type ExpectedRtcpPacket } from './rtcpCommon.js';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers.js';

beforeEach(resetBuffers);

describe('RTCP Generic NACK Packet', () => {
	test('NackPacket.parse() succeeds', () => {
		function checkFields(packet: NackPacket): void {
			expect(packet.getMessageType()).toBe(
				TransportLayerFeedbackMessageType.NACK
			);
			expect(packet.getSenderSsrc()).toBe(0x5d931534);
			expect(packet.getMediaSsrc()).toBe(0x01932db4);
			expect(packet.getItemsCount()).toBe(2);
			expect(packet.getItems()).toEqual([
				{ pid: 1000, bitmask: 0x8001 },
				{ pid: 65535, bitmask: 0 },
			]);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, FMT=1, PT:205, Length: 4
			0b10000001, 0xcd, 0x00, 0x04,
			// SSRC of packet sender: 0x5d931534
			0x5d, 0x93, 0x15, 0x34,
			// SSRC of media source: 0x01932db4
			0x01, 0x93, 0x2d, 0xb4,
			// PID: 1000, BLP: 0x8001
			0x03, 0xe8, 0x80, 0x01,
			// PID: 65535, BLP: 0x0000
			0xff, 0xff, 0x00, 0x00,
		]);
		const packet = NackPacket.parse(buffer);
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

		// No space to add more items.
		expect(() => packet.addItem({ pid: 1, bitmask: 0 })).toThrow(TypeError);

		expect(packet.getLength()).toBe(20);

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

	test('NackPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, FMT=1, PT:205, Length: 4
			0b10100001, 0xcd, 0x00, 0x04,
			// Sender SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// Media SSRC: 2222
			0x00, 0x00, 0x08, 0xae,
			// PID: 100, BLP: 0x0001
			0x00, 0x64, 0x00, 0x01,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
		]);
		const packet = NackPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 20,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: true,
			padding: 4,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getSenderSsrc()).toBe(1111);
		expect(packet.getMediaSsrc()).toBe(2222);
		expect(packet.getItemsCount()).toBe(1);

		/* Modify it (it removes the padding). */

		packet.addItem({ pid: 200, bitmask: 0x0002 });

		checkRtcpPacket(packet, {
			...expected,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getItemsCount()).toBe(2);
		expect(packet.getItems()).toEqual([
			{ pid: 100, bitmask: 0x0001 },
			{ pid: 200, bitmask: 0x0002 },
		]);
	});

	test('NackPacket.parse() fails', () => {
		// No space for the SSRC of media source.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, FMT=1, PT:205, Length: 1
			0b10000001, 0xcd, 0x00, 0x01,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
		]);

		expect(() => NackPacket.parse(buffer1)).toThrow(TypeError);

		// No items.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, FMT=1, PT:205, Length: 2
			0b10000001, 0xcd, 0x00, 0x02,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
		]);

		expect(() => NackPacket.parse(buffer2)).toThrow(TypeError);

		// Wrong message type (FMT 3, TMMBR).
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, FMT=3, PT:205, Length: 3
			0b10000011, 0xcd, 0x00, 0x03,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// PID: 1000, BLP: 0x0000
			0x03, 0xe8, 0x00, 0x00,
		]);

		expect(() => NackPacket.parse(buffer3)).toThrow(TypeError);

		// The FCI (excluding padding) is not multiple of 4 bytes.
		// prettier-ignore
		const buffer4 = new Uint8Array([
			// V=2, P=1, FMT=1, PT:205, Length: 4
			0b10100001, 0xcd, 0x00, 0x04,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// PID: 1000, BLP: 0x0000
			0x03, 0xe8, 0x00, 0x00,
			// 2 extra bytes, Padding: 2 bytes
			0x11, 0x22, 0x00, 0x02,
		]);

		expect(() => NackPacket.parse(buffer4)).toThrow(TypeError);
	});

	test('NackPacket.factory() succeeds', () => {
		function checkFields(packet: NackPacket): void {
			expect(packet.getMessageType()).toBe(
				TransportLayerFeedbackMessageType.NACK
			);
			expect(packet.getSenderSsrc()).toBe(1111);
			expect(packet.getMediaSsrc()).toBe(2222);
			expect(packet.getItemsCount()).toBe(2);
			expect(packet.getItems()).toEqual([
				{ pid: 3333, bitmask: 0x0001 },
				{ pid: 4444, bitmask: 0xffff },
			]);
		}

		// Dirty the buffer to check that factory() writes zeros in the feedback
		// header.
		factoryBuffer.fill(0xff);

		const packet = NackPacket.factory(factoryBuffer);
		const expected: ExpectedRtcpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 12,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getMessageType()).toBe(
			TransportLayerFeedbackMessageType.NACK
		);
		expect(packet.getSenderSsrc()).toBe(0);
		expect(packet.getMediaSsrc()).toBe(0);
		expect(packet.getItemsCount()).toBe(0);
		expect(packet.getItems()).toEqual([]);

		/* Modify it. */

		packet.setSenderSsrc(1111);
		packet.setMediaSsrc(2222);
		packet.addItem({ pid: 3333, bitmask: 0x0001 });
		packet.addItem({ pid: 4444, bitmask: 0xffff });

		checkRtcpPacket(packet, { ...expected, length: 20 });

		checkFields(packet);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		checkRtcpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 20,
		});

		checkFields(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 20,
		});

		checkFields(clonedPacket);
	});

	test('nackPacket.addItem() throws if there is no space in the buffer', () => {
		const packet = NackPacket.factory(factoryBuffer.subarray(0, 15));

		expect(packet.getLength()).toBe(12);

		// The item would need 16 bytes in total.
		expect(() => packet.addItem({ pid: 1111, bitmask: 0 })).toThrow(TypeError);

		expect(packet.getLength()).toBe(12);
		expect(packet.getItemsCount()).toBe(0);
		expect(packet.getItems()).toEqual([]);
	});

	test('NackPacket.factory() throws if the buffer is too small', () => {
		expect(() => NackPacket.factory(factoryBuffer.subarray(0, 11))).toThrow(
			TypeError
		);
	});

	test('NackPacket.computeLengthFor() succeeds', () => {
		expect(NackPacket.computeLengthFor(0)).toBe(12);

		const packet = NackPacket.factory(factoryBuffer);

		packet.addItem({ pid: 1111, bitmask: 0x0001 });
		packet.addItem({ pid: 2222, bitmask: 0x0002 });
		packet.addItem({ pid: 3333, bitmask: 0x0003 });

		expect(NackPacket.computeLengthFor(3)).toBe(24);
		expect(packet.getLength()).toBe(NackPacket.computeLengthFor(3));
	});
});
