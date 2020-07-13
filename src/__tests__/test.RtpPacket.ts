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
		expect(packet.HasOneByteExtensions()).toBe(true);
		expect(packet.HasTwoBytesExtensions()).toBe(false);
		expect(packet.getExtensionById(1)).toEqual(Buffer.from([ 255 ]));

		packet.setExtensionById(1, Buffer.from('foo'));
		expect(packet.getExtensionById(1)).toEqual(Buffer.from('foo'));
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
		expect(packet.HasOneByteExtensions()).toBe(true);
		expect(packet.HasTwoBytesExtensions()).toBe(false);
		expect(packet.getExtensionById(3)).toEqual(Buffer.from([ 0x65, 0x34, 0x1E ]));
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
		expect(packet.HasOneByteExtensions()).toBe(true);
		expect(packet.HasTwoBytesExtensions()).toBe(false);
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
		expect(packet.HasOneByteExtensions()).toBe(false);
		expect(packet.HasTwoBytesExtensions()).toBe(true);
		expect(packet.getExtensionById(1)).toEqual(Buffer.alloc(0));
		expect(packet.getExtensionById(2)).toEqual(Buffer.from([ 0x42 ]));
		expect(packet.getExtensionById(3)).toEqual(Buffer.from([ 0x11, 0x22 ]));
		expect(packet.getExtensionById(4)).toEqual(Buffer.alloc(0));
		expect(packet.getExtensionById(5)).toBeUndefined();

		packet.deleteExtensionById(2);
		expect(packet.getExtensionById(2)).toBeUndefined();
	});
});

describe('empty RTP packet from scratch', () =>
{
	test('new RtpPacket() succeeds', () =>
	{
		const packet = new RtpPacket();

		expect(packet).toBeDefined();
		// expect(packet.getVersion()).toBe(2);
		expect(packet.getPayloadType()).toBe(0);
		expect(packet.getSequenceNumber()).toBe(0);
		expect(packet.getTimestamp()).toBe(0);
		expect(packet.getSsrc()).toBe(0);
		expect(packet.getCsrc()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPayload()).toBeUndefined();
		expect(packet.getPadding()).toBe(0);
		expect(packet.HasOneByteExtensions()).toBe(false);
		expect(packet.HasTwoBytesExtensions()).toBe(false);
	});
});
