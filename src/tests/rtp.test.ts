import * as fs from 'fs';
import * as path from 'path';
import { isRtp, RtpPacket } from '../';
import {
	clone,
	areDataViewsEqual,
	nodeBufferToDataView,
	numericArrayToArrayBuffer,
	numericArrayToDataView,
	stringToArrayBuffer,
	stringToDataView
} from '../utils';

describe('parse RTP packet 1', () =>
{
	const view = nodeBufferToDataView(
		fs.readFileSync(path.join(__dirname, 'data', 'rtppacket1.raw'))
	);

	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(view)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket(view);

		expect(packet).toBeDefined();
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPayloadType()).toBe(111);
		expect(packet.getSequenceNumber()).toBe(23617);
		expect(packet.getTimestamp()).toBe(1660241882);
		expect(packet.getSsrc()).toBe(2674985186);
		expect(packet.getCsrc()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.getExtension(1)).toEqual(numericArrayToArrayBuffer([ 255 ]));
		expect(packet.needsSerialization()).toBe(false);

		packet.setExtension(1, stringToArrayBuffer('foo'));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(1)).toEqual(stringToArrayBuffer('foo'));
	});
});

describe('parse RTP packet 2', () =>
{
	const view = nodeBufferToDataView(
		fs.readFileSync(path.join(__dirname, 'data', 'rtppacket2.raw'))
	);

	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(view)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket(view);

		expect(packet).toBeDefined();
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPayloadType()).toBe(111);
		expect(packet.getSequenceNumber()).toBe(19354);
		expect(packet.getTimestamp()).toBe(863466045);
		expect(packet.getSsrc()).toBe(235797202);
		expect(packet.getCsrc()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.getExtension(3))
			.toEqual(numericArrayToArrayBuffer([ 0x65, 0x34, 0x1E ]));
		expect(packet.getPayloadView().byteLength).toBe(78);
		expect(packet.needsSerialization()).toBe(false);
	});
});

describe('parse RTP packet 3', () =>
{
	const uint8Array = new Uint8Array(
		[
			0b10010000, 0b00000001, 0, 8,
			0, 0, 0, 4,
			0, 0, 0, 5,
			0xBE, 0xDE, 0, 3, // Header Extension.
			0b00010000, 0xFF, 0b00100001, 0xFF,
			0xFF, 0, 0, 0b00110011,
			0xFF, 0xFF, 0xFF, 0xFF
		]
	);
	const view = new DataView(
		uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength
	);

	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(view)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket(view);

		expect(packet).toBeDefined();
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPayloadType()).toBe(1);
		expect(packet.getSequenceNumber()).toBe(8);
		expect(packet.getTimestamp()).toBe(4);
		expect(packet.getSsrc()).toBe(5);
		expect(packet.getCsrc()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.getPayloadView().byteLength).toBe(0);
		expect(packet.needsSerialization()).toBe(false);
	});
});

describe('parse RTP packet 4', () =>
{
	const uint8Array = new Uint8Array(
		[
			0b10010000, 0b00000001, 0, 8,
			0, 0, 0, 4,
			0, 0, 0, 5,
			0b00010000, 0, 0, 4, // Header Extension.
			0, 0, 1, 0,
			2, 1, 0x42, 0,
			3, 2, 0x11, 0x22,
			0, 0, 4, 0
		]
	);
	const view = new DataView(
		uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength
	);

	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(view)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket(view);

		expect(packet).toBeDefined();
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPayloadType()).toBe(1);
		expect(packet.getSequenceNumber()).toBe(8);
		expect(packet.getTimestamp()).toBe(4);
		expect(packet.getSsrc()).toBe(5);
		expect(packet.getCsrc()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(true);
		expect(packet.getExtension(1)).toEqual(new ArrayBuffer(0));
		expect(packet.getExtension(2)).toEqual(numericArrayToArrayBuffer([ 0x42 ]));
		expect(packet.getExtension(3)).toEqual(numericArrayToArrayBuffer([ 0x11, 0x22 ]));
		expect(packet.getExtension(4)).toEqual(new ArrayBuffer(0));
		expect(packet.getExtension(5)).toBeUndefined();
		expect(packet.getPayloadView().byteLength).toBe(0);
		expect(packet.needsSerialization()).toBe(false);

		packet.deleteExtension(2);
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(2)).toBeUndefined();
	});
});

describe('create RTP packet 5 from scratch', () =>
{
	let packet: RtpPacket;

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket();

		expect(packet).toBeDefined();
		expect(isRtp(packet.getView())).toBe(true);
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPayloadType()).toBe(0);
		expect(packet.getSequenceNumber()).toBe(0);
		expect(packet.getTimestamp()).toBe(0);
		expect(packet.getSsrc()).toBe(0);
		expect(packet.getCsrc()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPayloadView()).toEqual(new DataView(new ArrayBuffer(0)));
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.needsSerialization()).toBe(false);

		packet.setPayloadType(3);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getPayloadType()).toBe(3);

		packet.setPayloadType(127);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getPayloadType()).toBe(127);

		packet.setSequenceNumber(52345);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getSequenceNumber()).toBe(52345);

		packet.setTimestamp(1234567890);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getTimestamp()).toBe(1234567890);

		packet.setSsrc(3294967295);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getSsrc()).toBe(3294967295);

		packet.setMarker(true);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getMarker()).toBe(true);

		packet.setCsrc([ 1111, 2222 ]);
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getCsrc()).toEqual([ 1111, 2222 ]);

		packet.enableOneByteExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);

		packet.enableTwoBytesExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(true);

		packet.setExtension(1, stringToArrayBuffer('foo'));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(1)).toEqual(stringToArrayBuffer('foo'));

		packet.setExtension(2, numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(2)).toEqual(numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));

		packet.deleteExtension(1);
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(1)).toBeUndefined();

		packet.clearExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(2)).toBeUndefined();

		packet.setExtension(2, numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(2)).toEqual(numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));

		packet.setPayloadView(stringToDataView('codec'));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getPayloadView()).toEqual(stringToDataView('codec'));

		packet.setPadding(3);
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getPadding()).toBe(3);
	});

	test('packet.clone() succeeds', () =>
	{
		// Serialize to reset serialization packet.
		packet.serialize();
		expect(packet.needsSerialization()).toBe(false);

		const clonedPacket = packet.clone();

		expect(packet.needsSerialization()).toBe(false);
		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.getPayloadType()).toBe(127);
		expect(clonedPacket.getSequenceNumber()).toBe(52345);
		expect(clonedPacket.getTimestamp()).toBe(1234567890);
		expect(clonedPacket.getSsrc()).toBe(3294967295);
		expect(clonedPacket.getMarker()).toBe(true);
		expect(clonedPacket.getCsrc()).toEqual([ 1111, 2222 ]);
		expect(clonedPacket.hasOneByteExtensions()).toBe(false);
		expect(clonedPacket.hasTwoBytesExtensions()).toBe(true);
		expect(clonedPacket.getExtension(2))
			.toEqual(numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));
		expect(clonedPacket.getPayloadView()).toEqual(stringToDataView('codec'));
		expect(clonedPacket.getPadding()).toBe(3);
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(clonedPacket.needsSerialization()).toBe(false);
		// Packet views and payload views must be the same.
		expect(areDataViewsEqual(
			clonedPacket.getView(), packet.getView())
		).toBe(true);
		expect(areDataViewsEqual(
			clonedPacket.getPayloadView(), packet.getPayloadView())
		).toBe(true);
		// DataViews instances must be different since it's a cloned packet.
		expect(clonedPacket.getView() === packet.getView()).toBe(false);
		expect(clonedPacket.getPayloadView() === packet.getPayloadView()).toBe(false);
		// Internal ArrayBuffer instances must be different.
		expect(clonedPacket.getView().buffer === packet.getView().buffer).toBe(false);
		expect(
			clonedPacket.getPayloadView().buffer === packet.getPayloadView().buffer
		).toBe(false);
	});

	test('packet.rtxEncode() and packet.rtxDecode() succeed', () =>
	{
		// Serialize to reset serialization needed.
		packet.serialize();
		expect(packet.needsSerialization()).toBe(false);

		// Remove padding so we can later compare buffers.
		packet.setPadding(0);
		expect(packet.needsSerialization()).toBe(true);

		// Serialize to reset serialization needed.
		packet.serialize();

		const payloadType = packet.getPayloadType();
		const ssrc = packet.getSsrc();
		const sequenceNumber = packet.getSequenceNumber();
		const payloadLength = packet.getPayloadView().byteLength;
		const previousView = clone<DataView>(packet.getView());
		const previousPayloadView = clone<DataView>(packet.getPayloadView());

		packet.rtxEncode(69, 69696969, 6969);
		expect(packet.needsSerialization()).toBe(true);

		// Serialize to reset serialization needed.
		packet.serialize();

		const payloadView = packet.getPayloadView();

		expect(packet.getPayloadType()).toBe(69);
		expect(packet.getSequenceNumber()).toBe(6969);
		expect(packet.getSsrc()).toBe(69696969);
		expect(payloadView.byteLength).toBe(payloadLength + 2);
		expect(payloadView.getUint16(0)).toBe(sequenceNumber);

		packet.rtxDecode(payloadType, ssrc);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getPayloadType()).toBe(payloadType);
		expect(packet.getSequenceNumber()).toBe(sequenceNumber);
		expect(packet.getSsrc()).toBe(ssrc);
		expect(packet.getPayloadView().byteLength).toBe(payloadLength);
		expect(packet.needsSerialization()).toBe(true);
		// Packet and payload views must be the same.
		expect(areDataViewsEqual(packet.getView(), previousView)).toBe(true);
		expect(areDataViewsEqual(packet.getPayloadView(), previousPayloadView)).toBe(true);
	});
});

describe('create RTP packet 6 from scratch', () =>
{
	let packet: RtpPacket;

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket();

		// Adding an extension without having One-Byte or Two-Bytes extensions
		// enabled should force One-Byte.
		packet.setExtension(1, numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(1)).toEqual(numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		// Packet total length must match RTP fixed header length (12) + header
		// extension id/length (4) + extension id 1 (5) = 21. Must add padding so
		// it becomes 24;
		expect(packet.getView().byteLength).toBe(24);
		expect(packet.needsSerialization()).toBe(false);

		packet.clearExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(1)).toBeUndefined();
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		// Packet total length must match RTP fixed header length (12).
		// getView() serializes if needed.
		expect(packet.getView().byteLength).toBe(12);
		expect(packet.needsSerialization()).toBe(false);
	});
});

describe('create RTP packet 7 from scratch', () =>
{
	let packet: RtpPacket;

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket();

		packet.enableOneByteExtensions();
		expect(packet.needsSerialization()).toBe(true);
		packet.setExtension(0, stringToArrayBuffer('ignore me'));
		packet.setExtension(1, numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));
		packet.setExtension(16, stringToArrayBuffer('also ignore me'));
		// Force serialization so extension with id 0 must be ignored.
		packet.serialize();
		expect(packet.getExtension(0)).toBeUndefined();
		expect(packet.getExtension(1)).toEqual(numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));
		// Extension with id 16 (so 0 in 4 bits) must be ignored.
		expect(packet.getExtension(16)).toBeUndefined();
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		// Packet total length must match RTP fixed header length (12) + header
		// extension id/length (4) + extension id 1 (5) = 21. Must add padding so
		// it becomes 24;
		// getView() serializes if needed.
		expect(packet.getView().byteLength).toBe(24);
		expect(packet.needsSerialization()).toBe(false);

		// Adding a extension with value longer than 16 bytes is not allowed in
		// One-Byte extensions, so it must fail when serializing.
		packet.setExtension(5, new ArrayBuffer(17));
		expect(() => packet.serialize()).toThrow(RangeError);
	});
});

describe('create RTP packet 8 from scratch', () =>
{
	let packet: RtpPacket;

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket();

		packet.enableTwoBytesExtensions();
		expect(packet.needsSerialization()).toBe(true);
		packet.setExtension(0, stringToArrayBuffer('ignore me'));
		packet.setExtension(1, numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));
		packet.setExtension(256, stringToArrayBuffer('also ignore me'));
		// Force serialization so extension with id 0 must be ignored.
		packet.serialize();
		expect(packet.getExtension(0)).toBeUndefined();
		expect(packet.getExtension(1)).toEqual(numericArrayToArrayBuffer([ 1, 2, 3, 4 ]));
		// Extension with id 256 (so 0 in 8 bits) must be ignored.
		expect(packet.getExtension(256)).toBeUndefined();
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(true);
		// Packet total length must match RTP fixed header length (12) + header
		// extension id/length (4) + extension id 1 (6) = 22. Must add padding so
		// it becomes 24;
		// getView() serializes if needed.
		expect(packet.getView().byteLength).toBe(24);
		expect(packet.needsSerialization()).toBe(false);

		// Adding a extension with value longer than 255 bytes is not allowed in
		// Two-Bytes extensions, so it must fail when serializing.
		packet.setExtension(5, new ArrayBuffer(256));
		expect(() => packet.serialize()).toThrow(RangeError);
	});
});

describe('create RTP packet 9 from scratch', () =>
{
	let packet: RtpPacket;

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket();

		packet.setPayloadView(numericArrayToDataView([ 1, 2, 3, 4 ]));
		expect(packet.needsSerialization()).toBe(true);
		// Packet total length must match RTP fixed header length (12) + payload
		// (4), so 16.
		expect(packet.getView().byteLength).toBe(16);

		// Nothing to do since already padded to 4 bytes.
		packet.padTo4Bytes();
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getView().byteLength).toBe(16);
		expect(packet.getPadding()).toBe(0);

		packet.setPadding(1);
		expect(packet.needsSerialization()).toBe(true);
		// Padding a packet of 17 bytes (1 byte of padding) must become 16 bytes.
		packet.padTo4Bytes();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getView().byteLength).toBe(16);
		expect(packet.getPadding()).toBe(0);

		packet.setPayloadView(numericArrayToDataView([ 1, 2, 3, 4, 5 ]));
		// Padding a packet of 17 bytes (0 bytes of padding) must become 20 bytes.
		packet.padTo4Bytes();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getView().byteLength).toBe(20);
		expect(packet.getPadding()).toBe(3);
	});
});
