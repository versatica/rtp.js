import * as fs from 'fs';
import * as path from 'path';
import { isRtp, RtpPacket } from '../RtpPacket';

describe('RTP packet 1', () =>
{
	const buffer = fs.readFileSync(path.join(__dirname, 'data', 'rtppacket1.raw'));
	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(buffer)).toBe(true);
	});

	test('new RtpPacket() succeeds', () =>
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

describe('RTP packet 2', () =>
{
	const buffer = fs.readFileSync(path.join(__dirname, 'data', 'rtppacket2.raw'));
	let packet: RtpPacket;

	test('isRtp() succeeds', () =>
	{
		expect(isRtp(buffer)).toBe(true);
	});

	test('new RtpPacket() succeeds', () =>
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

describe('RTP packet 3', () =>
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

	test('new RtpPacket() succeeds', () =>
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

describe('RTP packet 4', () =>
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

	test('new RtpPacket() succeeds', () =>
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

describe('RTP packet from scratch', () =>
{
	let packet: RtpPacket;

	test('new RtpPacket() succeeds', () =>
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
