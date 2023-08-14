import { GenericPacket } from '../../RTCP/GenericPacket';
import { isRtcp } from '../../RTCP/RtcpPacket';
import { areDataViewsEqual, numericArrayToDataView } from '../../utils';

describe('parse RTCP generic packet', () =>
{
	const array = new Uint8Array(
		[
			0x82, 0xc0, 0x00, 0x02, // Type: 192 (unknown), Count: 2, length: 2
			0x62, 0x42, 0x76, 0xe0, // Body
			0x26, 0x24, 0x67, 0x0e
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
		const packet = new GenericPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(12);
		expect(packet.getPacketType()).toBe(192);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getBody()).toEqual(numericArrayToDataView(
			[ 0x62, 0x42, 0x76, 0xe0, 0x26, 0x24, 0x67, 0x0e ]
		));
		expect(packet.needsSerialization()).toBe(false);
	});

	test('packet processing succeeds for a buffer view with padding', () =>
	{
		const array2 = new Uint8Array(
			[
				0xa2, 0xc1, 0x00, 0x03, // Padding, Type: 193 (unknown), Count: 2, length: 3
				0x11, 0x22, 0x33, 0x44, // Body
				0x55, 0x66, 0x77, 0x88,
				0x99, 0x00, 0x00, 0x03 // Padding (3 bytes)
			]
		);

		const view2 = new DataView(
			array2.buffer,
			array2.byteOffset,
			array2.byteLength
		);

		const packet = new GenericPacket(view2);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(16);
		expect(packet.getPacketType()).toBe(193);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(3);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getBody()).toEqual(numericArrayToDataView(
			[ 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99 ]
		));
		expect(areDataViewsEqual(packet.getView(), view2)).toBe(true);

		// Also test the same after serializing.
		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(16);
		expect(packet.getPacketType()).toBe(193);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(3);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getBody()).toEqual(numericArrayToDataView(
			[ 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99 ]
		));
		expect(areDataViewsEqual(packet.getView(), view2)).toBe(true);
	});

	test('parsing a buffer view which length does not fit the indicated count throws', () =>
	{
		// Parse the first 8 bytes of the buffer so RTCP length is wrong.
		const view3 = new DataView(
			array.buffer,
			array.byteOffset,
			8
		);

		expect(() => (new GenericPacket(view3)))
			.toThrowError(RangeError);
	});
});

describe('create RTCP generic packet', () =>
{
	test('creating a generic packet without view and packet type throws', () =>
	{
		expect(() => (new GenericPacket()))
			.toThrowError(TypeError);
	});

	test('creating a generic packet with padding succeeds', () =>
	{
		const packet = new GenericPacket(undefined, 199);

		expect(isRtcp(packet.getView())).toBe(true);
		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 4 (common header).
		expect(packet.getByteLength()).toBe(4);
		expect(packet.getPacketType()).toBe(199);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getBody()).toEqual(numericArrayToDataView([]));
		expect(packet.needsSerialization()).toBe(false);

		packet.setBody(numericArrayToDataView([ 1, 2, 3 ]));
		// Byte length must be 4 + 3 (body) + 1 (padding) = 8.
		expect(packet.getByteLength()).toBe(8);
		expect(packet.getPadding()).toBe(1);

		packet.setCount(5);
		expect(packet.getCount()).toBe(5);

		packet.padTo4Bytes();
		// After padding to 4 bytes, nothing should change since the rest of the
		// packet always fits into groups of 4 bytes (setBody() already called
		// padTo4Bytes() internally).
		expect(packet.getPadding()).toBe(1);
		// Byte length must be 4 + 3 (body) + 1 (padding) = 8.
		expect(packet.getByteLength()).toBe(8);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getPacketType()).toBe(199);
		expect(packet.getCount()).toBe(5);
		expect(packet.getPadding()).toBe(1);
		expect(packet.getBody()).toEqual(numericArrayToDataView([ 1, 2, 3 ]));
		expect(packet.needsSerialization()).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getPacketType()).toBe(199);
		expect(packet.getCount()).toBe(5);
		expect(packet.getPadding()).toBe(1);
		expect(packet.getBody()).toEqual(numericArrayToDataView([ 1, 2, 3 ]));
		expect(packet.needsSerialization()).toBe(false);
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet.clone() succeeds', () =>
	{
		const array = new Uint8Array(
			[
				0xa2, 0xc1, 0x00, 0x03, // Padding, Type: 193 (unknown), Count: 2, length: 3
				0x11, 0x22, 0x33, 0x44, // Body
				0x55, 0x66, 0x77, 0x88,
				0x99, 0x00, 0x00, 0x03 // Padding (3 bytes)
			]
		);

		const view = new DataView(
			array.buffer,
			array.byteOffset,
			array.byteLength
		);

		const packet = new GenericPacket(view);
		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.getByteLength()).toBe(16);
		expect(clonedPacket.getPacketType()).toBe(193);
		expect(clonedPacket.getCount()).toBe(2);
		expect(clonedPacket.getPadding()).toBe(3);
		expect(clonedPacket.getBody()).toEqual(packet.getBody());
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(true);
	});
});
