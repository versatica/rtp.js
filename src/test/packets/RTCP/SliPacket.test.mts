import {
	SliPacket,
	type SliPacketDump,
} from '../../../packets/RTCP/SliPacket.mts';
import { PsFeedbackMessageType } from '../../../packets/RTCP/FeedbackPacket.mts';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.mts';
import { areDataViewsEqual } from '../../../utils/helpers.mts';

const sliPacketDump: SliPacketDump = {
	byteLength: 20,
	padding: 0,
	packetType: RtcpPacketType.PSFB,
	count: 2, // Used to indicate FMT, so 2 for SLI.
	messageType: PsFeedbackMessageType.SLI,
	senderSsrc: 0x11223344,
	mediaSsrc: 0x55667788,
	items: [
		{ first: 0b1100000000011, number: 0b1111000001111, pictureId: 0b101010 },
		{ first: 0b0100000000011, number: 0b0111000001111, pictureId: 0b001010 },
	],
};

const array = new Uint8Array([
	0x82,
	0xce,
	0x00,
	0x04, // FMT: 2 (SLI), Type: 206 (PSFB), Length: 4
	0x11,
	0x22,
	0x33,
	0x44, // Sender SSRC: 0x11223344
	0x55,
	0x66,
	0x77,
	0x88, // Media SSRC: 0x55667788
	0b11000000,
	0b00011111,
	0b10000011,
	0b11101010, // Item
	0b01000000,
	0b00011011,
	0b10000011,
	0b11001010, // Item
]);

const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

describe('parse RTCP SLI packet', () => {
	test('buffer view is RTCP', () => {
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		const packet = new SliPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(sliPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(sliPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(sliPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});

describe('create RTCP SLI packet', () => {
	const packet = new SliPacket();

	test('packet view is RTCP', () => {
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet processing succeeds', () => {
		// First just fill mandatory fields so serialization should not be needed.
		packet.setSenderSsrc(sliPacketDump.senderSsrc);
		packet.setMediaSsrc(sliPacketDump.mediaSsrc);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual({
			...sliPacketDump,
			byteLength: 12,
			items: [],
		});

		// Fill optional fields so serialization should be needed.
		packet.setItems(sliPacketDump.items);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.dump()).toEqual(sliPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(sliPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(sliPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});
