import { PliPacket, PliPacketDump } from '../../../packets/RTCP/PliPacket.mts';
import { PsFeedbackMessageType } from '../../../packets/RTCP/FeedbackPacket.mts';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.mts';
import { areDataViewsEqual } from '../../../utils/helpers.mts';

const pliPacketDump: PliPacketDump = {
	byteLength: 12,
	padding: 0,
	packetType: RtcpPacketType.PSFB,
	count: 1, // Used to indicate FMT, so 1 for PLI.
	messageType: PsFeedbackMessageType.PLI,
	senderSsrc: 0x00003344,
	mediaSsrc: 0x55667788,
};

const array = new Uint8Array([
	0x81,
	0xce,
	0x00,
	0x02, // FMT: 1 (PLI), Type: 206 (PSFB), Length: 2
	0x00,
	0x00,
	0x33,
	0x44, // Sender SSRC: 0x00003344
	0x55,
	0x66,
	0x77,
	0x88, // Media SSRC: 0x55667788
]);

const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

describe('parse RTCP PLI packet', () => {
	test('buffer view is RTCP', () => {
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		const packet = new PliPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(pliPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(pliPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(pliPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});

describe('create RTCP PLI packet', () => {
	const packet = new PliPacket();

	test('packet view is RTCP', () => {
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet processing succeeds', () => {
		// No optional fields in this packet so serialization is never needed.
		packet.setSenderSsrc(pliPacketDump.senderSsrc);
		packet.setMediaSsrc(pliPacketDump.mediaSsrc);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(pliPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(pliPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(pliPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});
