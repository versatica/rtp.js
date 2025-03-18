import {
	NackPacket,
	type NackPacketDump,
	parseNackItem,
	createNackItem,
} from '../../../packets/RTCP/NackPacket.mts';
import { RtpFeedbackMessageType } from '../../../packets/RTCP/FeedbackPacket.mts';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.mts';
import { areDataViewsEqual } from '../../../utils/helpers.mts';

const nackPacketDump: NackPacketDump = {
	byteLength: 20,
	padding: 0,
	packetType: RtcpPacketType.RTPFB,
	count: 1, // Used to indicate FMT, so 1 for NACK.
	messageType: RtpFeedbackMessageType.NACK,
	senderSsrc: 0x11223344,
	mediaSsrc: 0x55667788,
	items: [
		{ pid: 100, bitmask: 0b1010101010101010 },
		{ pid: 10000, bitmask: 0b0000111100001111 },
	],
};

const array = new Uint8Array([
	0x81,
	0xcd,
	0x00,
	0x04, // FMT: 1 (NACK), Type: 205 (RTPFB), Length: 4
	0x11,
	0x22,
	0x33,
	0x44, // Sender SSRC: 0x11223344
	0x55,
	0x66,
	0x77,
	0x88, // Media SSRC: 0x55667788
	0x00,
	0x64,
	0b10101010,
	0b10101010, // PID: 100, bitmask: 0b1010101010101010
	0x27,
	0x10,
	0b00001111,
	0b00001111, // PID: 10000, bitmask: 0b0000111100001111
]);

const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

describe('parse RTCP NACK packet', () => {
	test('buffer view is RTCP', () => {
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		const packet = new NackPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(nackPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(nackPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(nackPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});

describe('create RTCP NACK packet', () => {
	const packet = new NackPacket();

	test('packet view is RTCP', () => {
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet processing succeeds', () => {
		// First just fill mandatory fields so serialization should not be needed.
		packet.setSenderSsrc(nackPacketDump.senderSsrc);
		packet.setMediaSsrc(nackPacketDump.mediaSsrc);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual({
			...nackPacketDump,
			byteLength: 12,
			items: [],
		});

		// Fill optional fields so serialization should be needed.
		packet.setItems(nackPacketDump.items);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.dump()).toEqual(nackPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(nackPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(nackPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});

describe('NACK items', () => {
	const nackItem1 = nackPacketDump.items[0]!;
	const nackItem2 = nackPacketDump.items[1]!;

	test('parseNackItem()', () => {
		expect(parseNackItem(nackItem1.pid, nackItem1.bitmask)).toEqual([
			100, 102, 104, 106, 108, 110, 112, 114, 116,
		]);

		expect(parseNackItem(nackItem2.pid, nackItem2.bitmask)).toEqual([
			10000, 10001, 10002, 10003, 10004, 10009, 10010, 10011, 10012,
		]);
	});

	test('createNackItem()', () => {
		expect(
			createNackItem([100, 102, 104, 106, 108, 110, 112, 114, 116])
		).toEqual(nackItem1);

		expect(
			createNackItem([
				10000, 10001, 10002, 10003, 10004, 10009, 10010, 10011, 10012,
			])
		).toEqual(nackItem2);
	});
});
