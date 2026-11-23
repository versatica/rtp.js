import { FirPacket } from '../../../packets/RTCP/FirPacket';
import { PayloadSpecificFeedbackMessageType } from '../../../packets/RTCP/AnyPayloadSpecificFeedbackPacket';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { areBuffersEqual } from '../../../utils/buffers';
import { checkRtcpPacket, type ExpectedRtcpPacket } from './rtcpCommon';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers';

beforeEach(resetBuffers);

describe('RTCP FIR Packet', () => {
	test('FirPacket.parse() succeeds', () => {
		const checkFields = (packet: FirPacket): void => {
			expect(packet.getMessageType()).toBe(
				PayloadSpecificFeedbackMessageType.FIR
			);
			expect(packet.getSenderSsrc()).toBe(0xfa17fa17);
			expect(packet.getMediaSsrc()).toBe(0);
			expect(packet.getItemsCount()).toBe(2);
			expect(packet.getItems()).toEqual([
				{ ssrc: 0x02d03702, sequenceNumber: 4 },
				{ ssrc: 0x23456789, sequenceNumber: 13 },
			]);
		};

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, FMT=4, PT:206, Length: 6
			0b10000100, 0xce, 0x00, 0x06,
			// SSRC of packet sender: 0xfa17fa17
			0xfa, 0x17, 0xfa, 0x17,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// SSRC: 0x02d03702
			0x02, 0xd0, 0x37, 0x02,
			// Seq nr: 4, Reserved
			0x04, 0x00, 0x00, 0x00,
			// SSRC: 0x23456789
			0x23, 0x45, 0x67, 0x89,
			// Seq nr: 13, Reserved
			0x0d, 0x00, 0x00, 0x00,
		]);
		const packet = FirPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 28,
			packetType: RtcpPacketType.PSFB,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		checkFields(packet);

		// No space to add more items.
		expect(() => packet.addItem({ ssrc: 1111, sequenceNumber: 1 })).toThrow(
			TypeError
		);

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

	test('FirPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, FMT=4, PT:206, Length: 5
			0b10100100, 0xce, 0x00, 0x05,
			// Sender SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// Media SSRC: 0
			0x00, 0x00, 0x00, 0x00,
			// Item 1
			// SSRC: 2222
			0x00, 0x00, 0x08, 0xae,
			// Seq nr.: 7, Reserved
			0x07, 0x00, 0x00, 0x00,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
			// Extra space in the buffer
			0x00, 0x00, 0x00, 0x00,
		]);
		const packet = FirPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 24,
			packetType: RtcpPacketType.PSFB,
			hasPadding: true,
			padding: 4,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getSenderSsrc()).toBe(1111);
		expect(packet.getItemsCount()).toBe(1);

		/* Modify it (it removes the padding). */

		packet.addItem({ ssrc: 3333, sequenceNumber: 8 });

		checkRtcpPacket(packet, {
			...expected,
			length: 28,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getItemsCount()).toBe(2);
		expect(packet.getItems()).toEqual([
			{ ssrc: 2222, sequenceNumber: 7 },
			{ ssrc: 3333, sequenceNumber: 8 },
		]);
	});

	test('FirPacket.parse() fails', () => {
		// No items.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, FMT=4, PT:206, Length: 2
			0b10000100, 0xce, 0x00, 0x02,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => FirPacket.parse(buffer1)).toThrow(TypeError);

		// One item and a half.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, FMT=4, PT:206, Length: 5
			0b10000100, 0xce, 0x00, 0x05,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// SSRC: 0x23456789
			0x23, 0x45, 0x67, 0x89,
			// Seq nr: 13, Reserved
			0x0d, 0x00, 0x00, 0x00,
			// Half item
			0x68, 0x61, 0x6c, 0x66,
		]);

		expect(() => FirPacket.parse(buffer2)).toThrow(TypeError);

		// Wrong message type (FMT 1, PLI).
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, FMT=1, PT:206, Length: 4
			0b10000001, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// SSRC: 0x23456789
			0x23, 0x45, 0x67, 0x89,
			// Seq nr: 13, Reserved
			0x0d, 0x00, 0x00, 0x00,
		]);

		expect(() => FirPacket.parse(buffer3)).toThrow(TypeError);
	});

	test('FirPacket.factory() succeeds', () => {
		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			// V=2, P=0, FMT=4, PT:206, Length: 4
			0b10000100, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// SSRC: 0x23456789
			0x23, 0x45, 0x67, 0x89,
			// Seq nr: 13, Reserved
			0x0d, 0x00, 0x00, 0x00,
		]);

		// Dirty the buffer to check that factory() and addItem() write zeros in
		// the feedback header and in the reserved bits.
		factoryBuffer.fill(0xff);

		const packet = FirPacket.factory(factoryBuffer);
		const expected: ExpectedRtcpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 12,
			packetType: RtcpPacketType.PSFB,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getMessageType()).toBe(
			PayloadSpecificFeedbackMessageType.FIR
		);
		expect(packet.getSenderSsrc()).toBe(0);
		expect(packet.getMediaSsrc()).toBe(0);
		expect(packet.getItemsCount()).toBe(0);
		expect(packet.getItems()).toEqual([]);

		/* Modify it. */

		packet.setSenderSsrc(0x12345678);
		packet.addItem({ ssrc: 0x23456789, sequenceNumber: 13 });

		checkRtcpPacket(packet, { ...expected, length: 20 });

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

	test('FirPacket.addItem() throws if there is no space in the buffer', () => {
		const packet = FirPacket.factory(factoryBuffer.subarray(0, 19));

		expect(packet.getLength()).toBe(12);

		// The item would need 20 bytes in total.
		expect(() => packet.addItem({ ssrc: 1111, sequenceNumber: 1 })).toThrow(
			TypeError
		);

		expect(packet.getLength()).toBe(12);
		expect(packet.getItemsCount()).toBe(0);
		expect(packet.getItems()).toEqual([]);
	});

	test('FirPacket.factory() throws if the buffer is too small', () => {
		expect(() => FirPacket.factory(factoryBuffer.subarray(0, 11))).toThrow(
			TypeError
		);
	});

	test('FirPacket.computeLengthFor() succeeds', () => {
		expect(FirPacket.computeLengthFor(0)).toBe(12);

		const packet = FirPacket.factory(factoryBuffer);

		packet.addItem({ ssrc: 1111, sequenceNumber: 1 });
		packet.addItem({ ssrc: 2222, sequenceNumber: 2 });

		expect(FirPacket.computeLengthFor(2)).toBe(28);
		expect(packet.getLength()).toBe(FirPacket.computeLengthFor(2));
	});
});
