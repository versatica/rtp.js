import * as fs from 'fs';
import * as path from 'path';
import { isRtp, RtpPacket } from '../RtpPacket';
import { InvalidStateError } from '../errors';

describe('parse RTP packet 1', () =>
{
	const buffer = fs.readFileSync(path.join(__dirname, 'data', 'rtppacket1.raw'));
	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(buffer)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket(buffer);

		expect(packet).toBeDefined();
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
		expect(packet.getExtension(1)).toEqual(Buffer.from([ 255 ]));

		packet.setExtension(1, Buffer.from('foo'));
		expect(packet.getExtension(1)).toEqual(Buffer.from('foo'));
	});
});

describe('parse RTP packet 2', () =>
{
	const buffer = fs.readFileSync(path.join(__dirname, 'data', 'rtppacket2.raw'));
	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(buffer)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket(buffer);

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
		expect(packet.getExtension(3)).toEqual(Buffer.from([ 0x65, 0x34, 0x1E ]));
	});
});

describe('parse RTP packet 3', () =>
{
	const buffer = Buffer.from(
		[
			0b10010000, 0b00000001, 0, 8,
			0, 0, 0, 4,
			0, 0, 0, 5,
			0xBE, 0xDE, 0, 3, // Header Extension.
			0b00010000, 0xFF, 0b00100001, 0xFF,
			0xFF, 0, 0, 0b00110011,
			0xFF, 0xFF, 0xFF, 0xFF
		]);
	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(buffer)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket(buffer);

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
	});
});

describe('parse RTP packet 4', () =>
{
	const buffer = Buffer.from(
		[
			0b10010000, 0b00000001, 0, 8,
			0, 0, 0, 4,
			0, 0, 0, 5,
			0b00010000, 0, 0, 4, // Header Extension.
			0, 0, 1, 0,
			2, 1, 0x42, 0,
			3, 2, 0x11, 0x22,
			0, 0, 4, 0
		]);
	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(buffer)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket(buffer);

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
		expect(packet.getExtension(1)).toEqual(Buffer.alloc(0));
		expect(packet.getExtension(2)).toEqual(Buffer.from([ 0x42 ]));
		expect(packet.getExtension(3)).toEqual(Buffer.from([ 0x11, 0x22 ]));
		expect(packet.getExtension(4)).toEqual(Buffer.alloc(0));
		expect(packet.getExtension(5)).toBeUndefined();

		packet.deleteExtension(2);
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
		expect(isRtp(packet.getBuffer())).toBe(true);
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPayloadType()).toBe(0);
		expect(packet.getSequenceNumber()).toBe(0);
		expect(packet.getTimestamp()).toBe(0);
		expect(packet.getSsrc()).toBe(0);
		expect(packet.getCsrc()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPayload()).toEqual(Buffer.alloc(0));
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(false);

		packet.setPayloadType(3);
		expect(packet.getPayloadType()).toBe(3);
		expect(packet.isSerializationNeeded()).toBe(false);

		packet.setPayloadType(127);
		expect(packet.getPayloadType()).toBe(127);
		expect(packet.isSerializationNeeded()).toBe(false);

		packet.setSequenceNumber(52345);
		expect(packet.getSequenceNumber()).toBe(52345);
		expect(packet.isSerializationNeeded()).toBe(false);

		packet.setTimestamp(1234567890);
		expect(packet.getTimestamp()).toBe(1234567890);
		expect(packet.isSerializationNeeded()).toBe(false);

		packet.setSsrc(3294967295);
		expect(packet.getSsrc()).toBe(3294967295);
		expect(packet.isSerializationNeeded()).toBe(false);

		packet.setMarker(true);
		expect(packet.getMarker()).toBe(true);
		expect(packet.isSerializationNeeded()).toBe(false);

		packet.setCsrc([ 1111, 2222 ]);
		expect(packet.getCsrc()).toEqual([ 1111, 2222 ]);
		expect(packet.isSerializationNeeded()).toBe(true);

		packet.setOneByteExtensions();
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);

		packet.setTwoBytesExtensions();
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(true);

		packet.setExtension(1, Buffer.from('foo'));
		expect(packet.getExtension(1)).toEqual(Buffer.from('foo'));

		packet.setExtension(2, Buffer.from([ 1, 2, 3, 4 ]));
		expect(packet.getExtension(2)).toEqual(Buffer.from([ 1, 2, 3, 4 ]));

		packet.deleteExtension(1);
		expect(packet.getExtension(1)).toBeUndefined();

		packet.clearExtensions();
		expect(packet.getExtension(2)).toBeUndefined();

		packet.setExtension(2, Buffer.from([ 1, 2, 3, 4 ]));
		expect(packet.getExtension(2)).toEqual(Buffer.from([ 1, 2, 3, 4 ]));

		packet.setPayload(Buffer.from('codec'));
		expect(packet.getPayload()).toEqual(Buffer.from('codec'));

		packet.setPadding(3);
		expect(packet.getPadding()).toBe(3);
	});

	test('packet.clone() succeeds', () =>
	{
		const clonnedPacket = packet.clone();

		expect(clonnedPacket.getPayloadType()).toBe(127);
		expect(clonnedPacket.getSequenceNumber()).toBe(52345);
		expect(clonnedPacket.getTimestamp()).toBe(1234567890);
		expect(clonnedPacket.getSsrc()).toBe(3294967295);
		expect(clonnedPacket.getMarker()).toBe(true);
		expect(clonnedPacket.getCsrc()).toEqual([ 1111, 2222 ]);
		expect(clonnedPacket.hasOneByteExtensions()).toBe(false);
		expect(clonnedPacket.hasTwoBytesExtensions()).toBe(true);
		expect(clonnedPacket.getExtension(2)).toEqual(Buffer.from([ 1, 2, 3, 4 ]));
		expect(clonnedPacket.getPayload()).toEqual(Buffer.from('codec'));
		expect(clonnedPacket.getPadding()).toBe(3);

		// Compare buffers.
		expect(Buffer.compare(clonnedPacket.getBuffer(), packet.getBuffer())).toBe(0);
	});

	test('packet.serialize() succeeds', () =>
	{
		const previousBuffer = packet.getBuffer();

		packet.serialize();
		expect(packet.isSerializationNeeded()).toBe(false);
		expect(packet.getPayloadType()).toBe(127);
		expect(packet.getSequenceNumber()).toBe(52345);
		expect(packet.getTimestamp()).toBe(1234567890);
		expect(packet.getSsrc()).toBe(3294967295);
		expect(packet.getMarker()).toBe(true);
		expect(packet.getCsrc()).toEqual([ 1111, 2222 ]);
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(true);
		expect(packet.getExtension(2)).toEqual(Buffer.from([ 1, 2, 3, 4 ]));
		expect(packet.getPayload()).toEqual(Buffer.from('codec'));
		expect(packet.getPadding()).toBe(3);

		// Compare buffers.
		expect(Buffer.compare(packet.getBuffer(), previousBuffer)).toBe(0);
	});

	test('packet.rtxEncode() and packet.rtxDecode() succeed', () =>
	{
		// Remove padding so we can later compare buffers.
		packet.setPadding(0);
		packet.serialize();

		const payloadType = packet.getPayloadType();
		const ssrc = packet.getSsrc();
		const sequenceNumber = packet.getSequenceNumber();
		const payloadLength = packet.getPayload().length;
		const previousBuffer = Buffer.from(packet.getBuffer());

		packet.rtxEncode(69, 69696969, 6969);
		expect(packet.getPayloadType()).toBe(69);
		expect(packet.getSequenceNumber()).toBe(6969);
		expect(packet.getSsrc()).toBe(69696969);
		expect(packet.getPayload().length).toBe(payloadLength + 2);
		expect(packet.getPayload().readUInt16BE(0)).toBe(sequenceNumber);

		packet.rtxDecode(payloadType, ssrc);
		expect(packet.getPayloadType()).toBe(payloadType);
		expect(packet.getSequenceNumber()).toBe(sequenceNumber);
		expect(packet.getSsrc()).toBe(ssrc);
		expect(packet.getPayload().length).toBe(payloadLength);

		// Compare buffers.
		expect(Buffer.compare(packet.getBuffer(), previousBuffer)).toBe(0);
	});
});

describe('create RTP packet 6 from scratch', () =>
{
	let packet: RtpPacket;

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket();

		packet.setExtension(1, Buffer.from([ 1, 2, 3, 4 ]));
		expect(packet.getExtension(1)).toEqual(Buffer.from([ 1, 2, 3, 4 ]));

		// Serializing without setting One-Byte or Two-Bytes extensions mode should
		// ignore extensions.
		packet.serialize();
		expect(packet.getExtension(1)).toBeUndefined();
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		// Packet total length must match RTP fixed header length (12).
		expect(packet.getBuffer().length).toBe(12);

		packet.setOneByteExtensions();
		packet.setExtension(0, Buffer.from('ignore me'));
		packet.setExtension(1, Buffer.from([ 1, 2, 3, 4 ]));
		packet.setExtension(16, Buffer.from('also ignore me'));
		packet.serialize();
		// Extension with id 0 must be ignored.
		expect(packet.getExtension(0)).toBeUndefined();
		expect(packet.getExtension(1)).toEqual(Buffer.from([ 1, 2, 3, 4 ]));
		// Extension with id 16 (so 0 in 4 bits) must be ignored.
		expect(packet.getExtension(16)).toBeUndefined();
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		// Packet total length must match RTP fixed header length (12) + header
		// extension id/length (4) + extension id 1 (5) = 21. Must add padding so
		// it becomes 24;
		expect(packet.getBuffer().length).toBe(24);
	});
});

describe('create RTP packet 7 from scratch', () =>
{
	let packet: RtpPacket;

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket();

		packet.setTwoBytesExtensions();
		expect(packet.isSerializationNeeded()).toBe(true);

		packet.setExtension(0, Buffer.from('ignore me'));
		packet.setExtension(1, Buffer.from([ 1, 2, 3, 4 ]));
		packet.setExtension(256, Buffer.from('also ignore me'));
		packet.serialize();
		// Extension with id 0 must be ignored.
		expect(packet.getExtension(0)).toBeUndefined();
		expect(packet.getExtension(1)).toEqual(Buffer.from([ 1, 2, 3, 4 ]));
		// Extension with id 16 (so 0 in 4 bits) must be ignored.
		expect(packet.getExtension(16)).toBeUndefined();
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(true);
		// Packet total length must match RTP fixed header length (12) + header
		// extension id/length (4) + extension id 1 (6) = 22. Must add padding so
		// it becomes 24;
		expect(packet.getBuffer().length).toBe(24);
	});
});

describe('create RTP packet 8 from scratch', () =>
{
	let packet: RtpPacket;

	test('packet processing succeeds', () =>
	{
		packet = new RtpPacket();

		packet.setPayload(Buffer.from([ 1, 2, 3, 4 ]));
		expect(packet.isSerializationNeeded()).toBe(true);

		packet.serialize();
		// Packet total length must match RTP fixed header length (12) + payload
		// (4), so 16.
		expect(packet.getBuffer().length).toBe(16);

		// Nothing to do since already padded to 4.
		packet.padTo4Bytes();
		expect(packet.isSerializationNeeded()).toBe(false);
		expect(packet.getBuffer().length).toBe(16);
		expect(packet.getPadding()).toBe(0);

		packet.setPadding(1);
		// Cannot pad if not serialized.
		expect(() => packet.padTo4Bytes()).toThrow(InvalidStateError);

		packet.serialize();
		// Padding a packet of 17 bytes (1 byte of padding) must become 16 bytes.
		packet.padTo4Bytes();
		expect(packet.isSerializationNeeded()).toBe(true);

		packet.serialize();
		expect(packet.getBuffer().length).toBe(16);
		expect(packet.getPadding()).toBe(0);

		packet.setPayload(Buffer.from([ 1, 2, 3, 4, 5 ]));
		packet.serialize();
		// Padding a packet of 17 bytes (0 bytes of padding) must become 20 bytes.
		packet.padTo4Bytes();
		expect(packet.isSerializationNeeded()).toBe(true);

		packet.serialize();
		expect(packet.getBuffer().length).toBe(20);
		expect(packet.getPadding()).toBe(3);
	});
});
