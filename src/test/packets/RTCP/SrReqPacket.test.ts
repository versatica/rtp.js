import {
	SrReqPacket,
	SrReqPacketDump,
} from '../../../packets/RTCP/SrReqPacket.ts';
import { RtpFeedbackMessageType } from '../../../packets/RTCP/FeedbackPacket.ts';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.ts';
import { areDataViewsEqual } from '../../../utils/helpers.ts';

const srReqPacketDump: SrReqPacketDump = {
	byteLength: 12,
	padding: 0,
	packetType: RtcpPacketType.RTPFB,
	count: 5, // Used to indicate FMT, so 5 for SR_REQ
	messageType: RtpFeedbackMessageType.SR_REQ,
	senderSsrc: 0x00003344,
	mediaSsrc: 0x55667788,
};

const array = new Uint8Array([
	0x85,
	0xcd,
	0x00,
	0x02, // FMT: 5 (SR REQ), Type: 205 (RTPFB), Length: 2
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

describe('parse RTCP SR REQ packet', () => {
	test('buffer view is RTCP', () => {
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		const packet = new SrReqPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(srReqPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(srReqPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(srReqPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});

describe('create RTCP SR REQ packet', () => {
	const packet = new SrReqPacket();

	test('packet view is RTCP', () => {
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet processing succeeds', () => {
		// No optional fields in this packet so serialization is never needed.
		packet.setSenderSsrc(srReqPacketDump.senderSsrc);
		packet.setMediaSsrc(srReqPacketDump.mediaSsrc);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(srReqPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(srReqPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(srReqPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});
