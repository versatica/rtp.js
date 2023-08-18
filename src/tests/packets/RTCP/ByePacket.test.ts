import { ByePacket } from '../../../packets/RTCP/ByePacket';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { areDataViewsEqual } from '../../../utils/helpers';

describe('parse RTCP BYE packet', () =>
{
	const ssrc1 = 0x624276e0;
	const ssrc2 = 0x2624670e;
	const reason = 'Hasta la vista';

	const array = new Uint8Array(
		[
			0x82, 0xcb, 0x00, 0x06, // Type: 203 (BYE), Count: 2, Length: 6
			0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
			0x26, 0x24, 0x67, 0x0e, // SSRC: 0x2624670e
			0x0e, 0x48, 0x61, 0x73, // Length: 14, Text: "Hasta la vista"
			0x74, 0x61, 0x20, 0x6c,
			0x61, 0x20, 0x76, 0x69,
			0x73, 0x74, 0x61, 0x00
		]
	);

	const view = new DataView(
		array.buffer,
		array.byteOffset,
		array.byteLength
	);

	test('buffer view is RTCP', () =>
	{
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		const packet = new ByePacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(28);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(reason);
		expect(packet.needsSerialization()).toBe(false);
	});

	test('packet processing succeeds for a buffer view with padding', () =>
	{
		const array2 = new Uint8Array(
			[
				0xa2, 0xcb, 0x00, 0x07, // Padding, Type: 203 (BYE), Count: 2, Length: 7
				0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
				0x26, 0x24, 0x67, 0x0e, // SSRC: 0x2624670e
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

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(32);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(4);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(reason);
		expect(packet.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(packet.getView(), view2)).toBe(true);

		// Also test the same after serializing.
		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(32);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(4);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(reason);
		expect(packet.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(packet.getView(), view2)).toBe(true);
	});

	test('packet without reason succeeds', () =>
	{
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

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(16);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(4);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(undefined);
		expect(packet.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(packet.getView(), view3)).toBe(true);

		// Also test the same after serializing.
		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(16);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(4);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(undefined);
		expect(packet.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(packet.getView(), view3)).toBe(true);
	});

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

describe('create RTCP BYE packet', () =>
{
	test('creating a BYE packet with padding succeeds', () =>
	{
		const ssrc1 = 0x624276e0;
		const ssrc2 = 0x2624670e;
		const reason = 'œæ€å∫ ¥∂'; // 21 bytes.

		const packet = new ByePacket();

		expect(isRtcp(packet.getView())).toBe(true);
		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 4 (fixed header).
		expect(packet.getByteLength()).toBe(4);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrcs()).toEqual([]);
		expect(packet.getReason()).toBe(undefined);
		expect(packet.needsSerialization()).toBe(false);

		packet.setSsrcs([ ssrc1, ssrc2 ]);
		// Byte length must be 4 + 8 (2 ssrcs) = 12.
		expect(packet.getByteLength()).toBe(12);
		expect(packet.needsSerialization()).toBe(true);

		packet.setReason(reason);
		// Byte length must be 4 + 8 + 24 (reason + reason padding) = 36.
		expect(packet.getByteLength()).toBe(36);

		packet.padTo4Bytes();
		// After padding to 4 bytes, nothing should change since the rest of the
		// packet always fits into groups of 4 bytes.
		expect(packet.getPadding()).toBe(0);
		// Byte length must be 4 + 8 + 24 (reason + reason padding) + 0 (padding) = 36.
		expect(packet.getByteLength()).toBe(36);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(reason);
		expect(packet.needsSerialization()).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(36);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(reason);
		expect(packet.needsSerialization()).toBe(false);
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet.clone() succeeds', () =>
	{
		const array = new Uint8Array(
			[
				0x82, 0xcb, 0x00, 0x06, // Type: 203 (BYE), Count: 2, Length: 6
				0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
				0x26, 0x24, 0x67, 0x0e, // SSRC: 0x2624670e
				0x0e, 0x48, 0x61, 0x73, // Length: 14, Text: "Hasta la vista"
				0x74, 0x61, 0x20, 0x6c,
				0x61, 0x20, 0x76, 0x69,
				0x73, 0x74, 0x61, 0x00
			]
		);

		const view = new DataView(
			array.buffer,
			array.byteOffset,
			array.byteLength
		);

		const packet = new ByePacket(view);
		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.getByteLength()).toBe(28);
		expect(clonedPacket.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(clonedPacket.getCount()).toBe(2);
		expect(clonedPacket.getPadding()).toBe(0);
		expect(clonedPacket.getSsrcs()).toEqual(packet.getSsrcs());
		expect(clonedPacket.getReason()).toBe(packet.getReason());
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(true);
	});
});
