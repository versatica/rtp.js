import {
	RpsiPacket,
	RpsiPacketDump,
} from '../../../packets/RTCP/RpsiPacket.ts';
import { PsFeedbackMessageType } from '../../../packets/RTCP/FeedbackPacket.ts';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.ts';
import {
	areDataViewsEqual,
	numericArrayToDataView,
} from '../../../utils/helpers.ts';

const rpsiPacketDump: RpsiPacketDump = {
	byteLength: 24,
	padding: 0,
	packetType: RtcpPacketType.PSFB,
	count: 3, // Used to indicate FMT, so 3 for RPSI.
	messageType: PsFeedbackMessageType.RPSI,
	senderSsrc: 0x11223344,
	mediaSsrc: 0x55667788,
	payloadType: 120,
	bitStringLength: 8,
	paddingBits: 16,
};

const array = new Uint8Array([
	0x83,
	0xce,
	0x00,
	0x05, // FMT: 3 (RPSI), Type: 206 (PSFB), Length: 5
	0x11,
	0x22,
	0x33,
	0x44, // Sender SSRC: 0x11223344
	0x55,
	0x66,
	0x77,
	0x88, // Media SSRC: 0x55667788
	0x10,
	0x78,
	0x11,
	0x22, // PB: 16, Payload Type: 120, Bit String
	0x33,
	0x44,
	0x55,
	0x66, // Bit String
	0x77,
	0x88,
	0x00,
	0x00, // Bit String, FCI Padding (2 Bytes)
]);

const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

const bitStringView = new DataView(array.buffer, array.byteOffset + 14, 8);

describe('parse RTCP RPSI packet', () => {
	test('buffer view is RTCP', () => {
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		const packet = new RpsiPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(rpsiPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);
		expect(areDataViewsEqual(packet.getBitString(), bitStringView)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(rpsiPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);
		expect(areDataViewsEqual(packet.getBitString(), bitStringView)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(rpsiPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedPacket.getBitString(), bitStringView)).toBe(
			true
		);
	});
});

describe('create RTCP RPSI packet', () => {
	const packet = new RpsiPacket();

	test('packet view is RTCP', () => {
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet processing succeeds', () => {
		// First just fill mandatory fields so serialization should not be needed.
		packet.setSenderSsrc(rpsiPacketDump.senderSsrc);
		packet.setMediaSsrc(rpsiPacketDump.mediaSsrc);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual({
			...rpsiPacketDump,
			byteLength: 16,
			payloadType: 0,
			bitStringLength: 2,
			paddingBits: 0,
		});

		// Fill optional fields so serialization should be needed.
		packet.setPayloadType(rpsiPacketDump.payloadType);
		packet.setBitString(
			numericArrayToDataView([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88])
		);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.dump()).toEqual(rpsiPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);
		expect(areDataViewsEqual(packet.getBitString(), bitStringView)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(rpsiPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);
		expect(areDataViewsEqual(packet.getBitString(), bitStringView)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(rpsiPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedPacket.getBitString(), bitStringView)).toBe(
			true
		);
	});
});
