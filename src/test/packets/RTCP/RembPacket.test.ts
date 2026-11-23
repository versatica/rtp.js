import { RembPacket } from '../../../packets/RTCP/RembPacket';
import { PayloadSpecificFeedbackMessageType } from '../../../packets/RTCP/AnyPayloadSpecificFeedbackPacket';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { areBuffersEqual } from '../../../utils/buffers';
import { checkRtcpPacket, type ExpectedPacket } from './rtcpCommon';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers';

beforeEach(resetBuffers);

describe('RTCP REMB Packet', () => {
	test('RembPacket.isRemb() succeeds', () => {
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=1, FMT=15, PT:206, Length: 5
			0b10101111, 0xce, 0x00, 0x05,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 0, BR Mantissa: 1000
			0x00, 0x00, 0x03, 0xe8,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
		]);

		expect(RembPacket.isRemb(buffer1)).toBe(true);

		// Buffer longer than the packet.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 4
			0b10001111, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 0, BR Mantissa: 1000
			0x00, 0x00, 0x03, 0xe8,
			// Extra bytes.
			0xff, 0xff, 0xff, 0xff,
		]);

		expect(RembPacket.isRemb(buffer2)).toBe(true);

		// No space for Num SSRC, BR Exp and BR Mantissa, but the rest of the
		// packet is not validated.
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 3
			0b10001111, 0xce, 0x00, 0x03,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
		]);

		expect(RembPacket.isRemb(buffer3)).toBe(true);
	});

	test('RembPacket.isRemb() fails', () => {
		// Unique identifier is not 'R' 'E' 'M' 'B'.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 4
			0b10001111, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'N' 'E' 'M' 'B'
			0x4e, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 0, BR Mantissa: 1000
			0x00, 0x00, 0x03, 0xe8,
		]);

		expect(RembPacket.isRemb(buffer1)).toBe(false);

		// Wrong message type (FMT 1, PLI).
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, FMT=1, PT:206, Length: 4
			0b10000001, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 0, BR Mantissa: 1000
			0x00, 0x00, 0x03, 0xe8,
		]);

		expect(RembPacket.isRemb(buffer2)).toBe(false);

		// Wrong packet type (PT 205, RTPFB).
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:205, Length: 4
			0b10001111, 0xcd, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 0, BR Mantissa: 1000
			0x00, 0x00, 0x03, 0xe8,
		]);

		expect(RembPacket.isRemb(buffer3)).toBe(false);

		// AFB packet without Feedback Control Information followed by bytes that
		// look like a Unique identifier.
		// prettier-ignore
		const buffer4 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 2
			0b10001111, 0xce, 0x00, 0x02,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Extra bytes: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
		]);

		expect(RembPacket.isRemb(buffer4)).toBe(false);

		// Not a RTCP packet.
		// prettier-ignore
		const buffer5 = new Uint8Array([
			0b10001111, 0xce, 0x00,
		]);

		expect(RembPacket.isRemb(buffer5)).toBe(false);
	});

	test('RembPacket.parse() succeeds', () => {
		const checkFields = (packet: RembPacket): void => {
			expect(packet.getMessageType()).toBe(
				PayloadSpecificFeedbackMessageType.AFB
			);
			expect(packet.getSenderSsrc()).toBe(0xfa17fa17);
			expect(packet.getMediaSsrc()).toBe(0);
			expect(packet.getBitrate()).toBe(122754);
			expect(packet.getSsrcs()).toEqual([0x02d03702, 0x04a76747]);
		};

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 6
			0b10001111, 0xce, 0x00, 0x06,
			// SSRC of packet sender: 0xfa17fa17
			0xfa, 0x17, 0xfa, 0x17,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 2, BR Exp: 0, BR Mantissa: 122754
			0x02, 0x01, 0xdf, 0x82,
			// SSRC feedback: 0x02d03702
			0x02, 0xd0, 0x37, 0x02,
			// SSRC feedback: 0x04a76747
			0x04, 0xa7, 0x67, 0x47,
		]);
		const packet = RembPacket.parse(buffer);
		const expected: ExpectedPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 28,
			packetType: RtcpPacketType.PSFB,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		checkFields(packet);

		// No space to add more SSRCs.
		expect(() => packet.addSsrc(1111)).toThrow(TypeError);

		expect(packet.getLength()).toBe(28);

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

	test('RembPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, FMT=15, PT:206, Length: 6
			0b10101111, 0xce, 0x00, 0x06,
			// Sender SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// Media SSRC: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: "REMB"
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 1, BR Exp: 0, BR Mantissa: 1000
			0x01, 0x00, 0x03, 0xe8,
			// SSRC 1: 3333
			0x00, 0x00, 0x0d, 0x05,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
		]);
		const packet = RembPacket.parse(buffer);
		const expected: ExpectedPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 28,
			packetType: RtcpPacketType.PSFB,
			hasPadding: true,
			padding: 4,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getSenderSsrc()).toBe(1111);
		expect(packet.getBitrate()).toBe(1000);
		expect(packet.getSsrcs()).toEqual([3333]);

		/* Modify it (it removes the padding). */

		packet.addSsrc(4444);

		checkRtcpPacket(packet, {
			...expected,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getSsrcs()).toEqual([3333, 4444]);
	});

	test('RembPacket.parse() with a bitrate bigger than 64 bits succeeds', () => {
		// Num SSRC: 0, BR Exp: 63, BR Mantissa: 0x3fb93
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 4
			0b10001111, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 63, BR Mantissa: 0x3fb93
			0x00, 0xff, 0xfb, 0x93,
		]);

		expect(RembPacket.parse(buffer1).getBitrate()).toBe(0x3fb93 * 2 ** 63);

		// Bitrate (200 * 2^56) does not fit in a signed 64 bits integer.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 4
			0b10001111, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 56, BR Mantissa: 200
			0x00, 0xe0, 0x00, 0xc8,
		]);

		expect(RembPacket.parse(buffer2).getBitrate()).toBe(200 * 2 ** 56);
	});

	test('RembPacket.parse() fails', () => {
		// No space for Num SSRC, BR Exp and BR Mantissa.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 3
			0b10001111, 0xce, 0x00, 0x03,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
		]);

		expect(() => RembPacket.parse(buffer1)).toThrow(TypeError);

		// Unique identifier is not 'R' 'E' 'M' 'B'.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 4
			0b10001111, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'N' 'E' 'M' 'B'
			0x4e, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 1, BR Mantissa: 0x3fb93
			0x00, 0x07, 0xfb, 0x93,
		]);

		expect(() => RembPacket.parse(buffer2)).toThrow(TypeError);

		// Num SSRC field announces 2 SSRCs but there is only 1.
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 5
			0b10001111, 0xce, 0x00, 0x05,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 2, BR Exp: 1, BR Mantissa: 0x3fb93
			0x02, 0x07, 0xfb, 0x93,
			// SSRC feedback: 0x23456789
			0x23, 0x45, 0x67, 0x89,
		]);

		expect(() => RembPacket.parse(buffer3)).toThrow(TypeError);

		// Wrong message type (FMT 1, PLI).
		// prettier-ignore
		const buffer4 = new Uint8Array([
			// V=2, P=0, FMT=1, PT:206, Length: 4
			0b10000001, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 1, BR Mantissa: 0x3fb93
			0x00, 0x07, 0xfb, 0x93,
		]);

		expect(() => RembPacket.parse(buffer4)).toThrow(TypeError);
	});

	test('RembPacket.factory() succeeds', () => {
		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 7
			0b10001111, 0xce, 0x00, 0x07,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 3, BR Exp: 1, BR Mantissa: 0x3fb93
			0x03, 0x07, 0xfb, 0x93,
			// SSRC feedback: 0x23456789
			0x23, 0x45, 0x67, 0x89,
			// SSRC feedback: 0x2345678a
			0x23, 0x45, 0x67, 0x8a,
			// SSRC feedback: 0x2345678b
			0x23, 0x45, 0x67, 0x8b,
		]);

		// Dirty the buffer to check that factory() writes zeros in the header.
		factoryBuffer.fill(0xff);

		const packet = RembPacket.factory(factoryBuffer);
		const expected: ExpectedPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 20,
			packetType: RtcpPacketType.PSFB,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getMessageType()).toBe(
			PayloadSpecificFeedbackMessageType.AFB
		);
		expect(packet.getSenderSsrc()).toBe(0);
		expect(packet.getMediaSsrc()).toBe(0);
		expect(packet.getBitrate()).toBe(0);
		expect(packet.getSsrcs()).toEqual([]);

		/* Modify it. */

		packet.setSenderSsrc(0x12345678);
		packet.setBitrate(522022);
		packet.addSsrc(0x23456789);
		packet.addSsrc(0x2345678a);
		packet.addSsrc(0x2345678b);

		checkRtcpPacket(packet, { ...expected, length: 32 });

		expect(packet.getBitrate()).toBe(522022);
		expect(packet.getSsrcs()).toEqual([0x23456789, 0x2345678a, 0x2345678b]);
		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		expect(areBuffersEqual(clonedPacket.getBuffer(), expectedBuffer)).toBe(
			true
		);
	});

	test('RembPacket bitrate survives a round trip', () => {
		const checkBitrate = (bitrate: number): void => {
			const packet = RembPacket.factory(factoryBuffer);

			packet.setBitrate(bitrate);

			const parsedPacket = RembPacket.parse(packet.getBuffer());

			expect(parsedPacket.getBitrate()).toBe(bitrate);
			expect(parsedPacket.getSsrcs()).toEqual([]);
		};

		checkBitrate(0);
		// Exponent 0 with the 2 high bits of the mantissa in use.
		checkBitrate(122754);
		checkBitrate(522022);
		// A bitrate that needs more than 32 bits.
		checkBitrate(0x3fb93 * 2 ** 30);
	});

	test('RembPacket.addSsrc() and RembPacket.setBitrate() throw', () => {
		const packet = RembPacket.factory(factoryBuffer);

		for (let ssrc = 1; ssrc <= 255; ++ssrc) {
			packet.addSsrc(ssrc);
		}

		expect(packet.getSsrcs().length).toBe(255);
		expect(packet.getLength()).toBe(20 + 255 * 4);

		// No more than 255 SSRCs.
		expect(() => packet.addSsrc(256)).toThrow(TypeError);

		expect(packet.getSsrcs().length).toBe(255);
		expect(packet.getLength()).toBe(20 + 255 * 4);

		// Negative bitrate.
		expect(() => packet.setBitrate(-1)).toThrow(TypeError);
	});

	test('RembPacket.addSsrc() throws if there is no space in the buffer', () => {
		const packet = RembPacket.factory(factoryBuffer.subarray(0, 23));

		expect(packet.getLength()).toBe(20);

		// The SSRC would need 24 bytes in total.
		expect(() => packet.addSsrc(1111)).toThrow(TypeError);

		expect(packet.getLength()).toBe(20);
		expect(packet.getSsrcs()).toEqual([]);
	});

	test('RembPacket.factory() throws if the buffer is too small', () => {
		expect(() => RembPacket.factory(factoryBuffer.subarray(0, 19))).toThrow(
			TypeError
		);
	});

	test('RembPacket.computeLengthFor() succeeds', () => {
		expect(RembPacket.computeLengthFor(0)).toBe(20);

		const packet = RembPacket.factory(factoryBuffer);

		packet.addSsrc(1111);
		packet.addSsrc(2222);
		packet.addSsrc(3333);

		expect(RembPacket.computeLengthFor(3)).toBe(32);
		expect(packet.getLength()).toBe(RembPacket.computeLengthFor(3));
	});
});
