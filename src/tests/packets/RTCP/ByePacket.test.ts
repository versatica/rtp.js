import { ByePacket,	ByePacketDump } from '../../../packets/RTCP/ByePacket';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { areDataViewsEqual } from '../../../utils/helpers';

const byePacketDump: ByePacketDump =
{
	byteLength  : 44,
	padding     : 0,
	packetType  : RtcpPacketType.BYE,
	count       : 2,
	ssrcs       : [ 0x624276e0, 0x2624670e ],
	reason      : 'Hasta la vista! œæ€å∫'
};

const array = new Uint8Array(
	[
		0x82, 0xcb, 0x00, 0x0a, // Type: 203 (BYE), Count: 2, Length: 10
		0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
		0x26, 0x24, 0x67, 0x0e, // SSRC: 0x2624670e
		0x1c, 0x48, 0x61, 0x73, // Length: 28, Text: "Hasta la vista! œæ€å∫"
		0x74, 0x61, 0x20, 0x6c,
		0x61, 0x20, 0x76, 0x69,
		0x73, 0x74, 0x61, 0x21,
		0x20, 0xc5, 0x93, 0xc3,
		0xa6, 0xe2, 0x82, 0xac,
		0xc3, 0xa5, 0xe2, 0x88,
		0xab, 0x00, 0x00, 0x00 // Reason padding (3 bytes)
	]
);

const view = new DataView(
	array.buffer,
	array.byteOffset,
	array.byteLength
);

describe('parse RTCP BYE packet', () =>
{
	test('buffer view is RTCP', () =>
	{
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		const packet = new ByePacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(byePacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(byePacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(byePacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});

describe('create RTCP BYE packet', () =>
{
	const packet = new ByePacket();

	test('packet view is RTCP', () =>
	{
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(
			{
				...byePacketDump,
				byteLength : 4,
				count      : 0,
				ssrcs      : [],
				reason     : undefined
			}
		);

		// Fill optional fields so serialization should be needed.
		packet.setSsrcs(byePacketDump.ssrcs);
		packet.setReason(byePacketDump.reason);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.dump()).toEqual(byePacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(byePacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(byePacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});

describe('parse RTCP BYE packet with padding', () =>
{
	const byePacketDump2: ByePacketDump =
	{
		byteLength  : 24,
		padding     : 4,
		packetType  : RtcpPacketType.BYE,
		count       : 0,
		ssrcs       : [],
		reason      : 'Hasta la vista'
	};

	const array2 = new Uint8Array(
		[
			0xa0, 0xcb, 0x00, 0x05, // Padding, Type: 203 (BYE), Count: 0, Length: 5
			0x0e, 0x48, 0x61, 0x73, // Length: 14, Text: "Hasta la vista"
			0x74, 0x61, 0x20, 0x6c,
			0x61, 0x20, 0x76, 0x69,
			0x73, 0x74, 0x61, 0x00,
			0x00, 0x00, 0x00, 0x04 // Padding (4 bytes)
		]
	);

	const view2 = new DataView(
		array2.buffer,
		array2.byteOffset,
		array2.byteLength
	);

	const packet = new ByePacket(view2);

	test('buffer view is RTCP', () =>
	{
		expect(isRtcp(view2)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(byePacketDump2);
		expect(areDataViewsEqual(packet.getView(), view2)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(byePacketDump2);
		expect(areDataViewsEqual(packet.getView(), view2)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(byePacketDump2);
		expect(areDataViewsEqual(clonedPacket.getView(), view2)).toBe(true);
	});
});

describe('parse RTCP BYE packet without reason', () =>
{
	const byePacketDump3: ByePacketDump =
	{
		byteLength  : 16,
		padding     : 4,
		packetType  : RtcpPacketType.BYE,
		count       : 2,
		ssrcs       : [ 0x624276e0, 0x2624670e ],
		reason      : undefined
	};

	const array3 = new Uint8Array(
		[
			0xa2, 0xcb, 0x00, 0x03, // Padding, Type: 203 (BYE), Count: 2, Length: 3
			0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
			0x26, 0x24, 0x67, 0x0e, // SSRC: 0x2624670e
			0x00, 0x00, 0x00, 0x04 // Padding (4 bytes)
		]
	);

	const view3 = new DataView(
		array3.buffer,
		array3.byteOffset,
		array3.byteLength
	);

	const packet = new ByePacket(view3);

	test('buffer view is RTCP', () =>
	{
		expect(isRtcp(view3)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(byePacketDump3);
		expect(areDataViewsEqual(packet.getView(), view3)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(byePacketDump3);
		expect(areDataViewsEqual(packet.getView(), view3)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(byePacketDump3);
		expect(areDataViewsEqual(clonedPacket.getView(), view3)).toBe(true);
	});
});

describe('parse invalid RTCP BYE packet', () =>
{
	test('parsing a buffer view which length does not fit the indicated count throws', () =>
	{
		// Parse the first 8 bytes of the buffer, indicating 1 SSRC and holding no
		// SSRC at all.
		const view4 = new DataView(
			array.buffer,
			array.byteOffset,
			8
		);

		expect(() => (new ByePacket(view4)))
			.toThrowError(RangeError);
	});
});
