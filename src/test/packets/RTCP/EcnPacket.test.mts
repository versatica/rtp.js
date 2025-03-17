import { EcnPacket, EcnPacketDump } from '../../../packets/RTCP/EcnPacket.mts';
import { RtpFeedbackMessageType } from '../../../packets/RTCP/FeedbackPacket.mts';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.mts';
import { areDataViewsEqual } from '../../../utils/helpers.mts';

const ecnPacketDump: EcnPacketDump = {
	byteLength: 32,
	padding: 0,
	packetType: RtcpPacketType.RTPFB,
	count: 8, // Used to indicate FMT, so 8 for ECN.
	messageType: RtpFeedbackMessageType.ECN,
	senderSsrc: 0x11223344,
	mediaSsrc: 0x55667788,
	extendedHighestSequenceNumber: 0x00110011,
	ect0Counter: 0x23324555,
	ect1Counter: 0x55441100,
	ecnCeCounter: 0x2222,
	nonEctCounter: 0x3333,
	lostPacketsCounter: 0xffaa,
	duplicationCounter: 0xbbcc,
};

const array = new Uint8Array([
	0x88,
	0xcd,
	0x00,
	0x07, // FMT: 8 (ECN), Type: 205 (RTPFB), Length: 7
	0x11,
	0x22,
	0x33,
	0x44, // Sender SSRC: 0x11223344
	0x55,
	0x66,
	0x77,
	0x88, // Media SSRC: 0x55667788
	0x00,
	0x11,
	0x00,
	0x11, // Extended Highest Sequence Number
	0x23,
	0x32,
	0x45,
	0x55, // ECT (0) Counter
	0x55,
	0x44,
	0x11,
	0x00, // ECT (1) Counter
	0x22,
	0x22,
	0x33,
	0x33, // ECN-CE Counter, not-ECT Counter
	0xff,
	0xaa,
	0xbb,
	0xcc, // Lost Packets Counter, Duplication Counter
]);

const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

describe('parse RTCP ECN packet', () => {
	test('buffer view is RTCP', () => {
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		const packet = new EcnPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(ecnPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(ecnPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(ecnPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});

describe('create RTCP ECN packet', () => {
	const packet = new EcnPacket();

	test('packet view is RTCP', () => {
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet processing succeeds', () => {
		// No optional fields in this packet so serialization is never needed.
		packet.setSenderSsrc(ecnPacketDump.senderSsrc);
		packet.setMediaSsrc(ecnPacketDump.mediaSsrc);
		packet.setExtendedHighestSequenceNumber(
			ecnPacketDump.extendedHighestSequenceNumber
		);
		packet.setEct0Counter(ecnPacketDump.ect0Counter);
		packet.setEct1Counter(ecnPacketDump.ect1Counter);
		packet.setEcnCeCounter(ecnPacketDump.ecnCeCounter);
		packet.setNonEctCounter(ecnPacketDump.nonEctCounter);
		packet.setLostPacketsCounter(ecnPacketDump.lostPacketsCounter);
		packet.setDuplicationCounter(ecnPacketDump.duplicationCounter);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(ecnPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(ecnPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(ecnPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});
