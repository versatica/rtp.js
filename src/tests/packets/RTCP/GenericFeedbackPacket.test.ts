import {
	GenericFeedbackPacket,
	GenericFeedbackPacketDump
} from '../../../packets/RTCP/GenericFeedbackPacket';
import { PsFeedbackMessageType } from '../../../packets/RTCP/FeedbackPacket';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import {
	areDataViewsEqual,
	numericArrayToDataView
} from '../../../utils/helpers';

const genericFeedbackPacket: GenericFeedbackPacketDump =
{
	byteLength  : 20,
	padding     : 1,
	packetType  : RtcpPacketType.PSFB,
	count       : 15, // Used to indicate FMT, so 15.
	messageType : PsFeedbackMessageType.AFB,
	senderSsrc  : 0x11223344,
	mediaSsrc   : 0x55667788,
	bodyLength  : 7
};

const array = new Uint8Array(
	[
		0xaf, 0xce, 0x00, 0x04, // Padding, FMT: 15 (AFB), Type: 206 (PSFB), Length: 4
		0x11, 0x22, 0x33, 0x44, // Sender SSRC: 0x11223344
		0x55, 0x66, 0x77, 0x88, // Media SSRC: 0x55667788
		0x00, 0x11, 0x22, 0x33, // Body
		0x44, 0x55, 0x66, 0x01 // Padding (1 byte)
	]
);

const view = new DataView(
	array.buffer,
	array.byteOffset,
	array.byteLength
);

const bodyView = new DataView(
	array.buffer,
	array.byteOffset + 12,
	7
);

describe('parse RTCP generic Feedback packet', () =>
{
	test('buffer view is RTCP', () =>
	{
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		const packet = new GenericFeedbackPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(genericFeedbackPacket);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);
		expect(areDataViewsEqual(packet.getBody(), bodyView)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(genericFeedbackPacket);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);
		expect(areDataViewsEqual(packet.getBody(), bodyView)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(genericFeedbackPacket);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedPacket.getBody(), bodyView)).toBe(true);
	});
});

describe('create RTCP generic Feedback packet', () =>
{
	const packet = new GenericFeedbackPacket(
		undefined,
		RtcpPacketType.PSFB,
		PsFeedbackMessageType.AFB
	);

	test('packet view is RTCP', () =>
	{
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		packet.setSenderSsrc(genericFeedbackPacket.senderSsrc);
		packet.setMediaSsrc(genericFeedbackPacket.mediaSsrc);
		// Let's set body with 7 bytes length so it should be internally padded
		// to 8.
		packet.setBody(numericArrayToDataView(
			[ 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66 ]
		));

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.dump()).toEqual(genericFeedbackPacket);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);
		expect(areDataViewsEqual(packet.getBody(), bodyView)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(genericFeedbackPacket);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);
		expect(areDataViewsEqual(packet.getBody(), bodyView)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(genericFeedbackPacket);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedPacket.getBody(), bodyView)).toBe(true);
	});
});
