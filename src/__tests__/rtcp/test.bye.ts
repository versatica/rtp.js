import { ByePacket } from '../../rtcp/bye';
import { isRtcp } from '../../rtcp';

const ssrc1 = 0x624276e0;
const ssrc2 = 0x2624670e;
const reason = 'Hasta la vista';

const buffer = Buffer.from(
	[
		0x82, 0xcb, 0x00, 0x06, // Type: 203 (Bye), Count: 2, length: 6
		0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
		0x26, 0x24, 0x67, 0x0e, // SSRC: 0x2624670e
		0x0e, 0x48, 0x61, 0x73, // Length: 14, Text: "Hasta la vista"
		0x74, 0x61, 0x20, 0x6c,
		0x61, 0x20, 0x76, 0x69,
		0x73, 0x74, 0x61, 0x00
	]
);

describe('parse RTCP Bye packet', () =>
{
	test('buffer is RTCP', () =>
	{
		expect(isRtcp(buffer)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		const packet = new ByePacket(buffer);
		const ssrcs = packet.getSsrcs();

		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getPacketType()).toBe(203);
		expect(packet.getCount()).toBe(2);
		expect(ssrcs[0]).toBe(ssrc1);
		expect(ssrcs[1]).toBe(ssrc2);
		expect(packet.getReason()).toBe(reason);
	});

	test('packet processing succeeds for a buffer with padding', () =>
	{
		const padding = 4;
		const bufferWithPadding = Buffer.from(
			[
				0xa2, 0xcb, 0x00, 0x07, // Padding, Type: 203 (Bye), Count: 2, length: 7
				0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
				0x26, 0x24, 0x67, 0x0e, // SSRC: 0x2624670e
				0x0e, 0x48, 0x61, 0x73, // Length: 14, Text: "Hasta la vista"
				0x74, 0x61, 0x20, 0x6c,
				0x61, 0x20, 0x76, 0x69,
				0x73, 0x74, 0x61, 0x00,
				0x00, 0x00, 0x00, 0x04 // Padding (4 bytes)
			]
		);

		const packet = new ByePacket(bufferWithPadding);
		const ssrcs = packet.getSsrcs();

		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(padding);
		expect(packet.getPacketType()).toBe(203);
		expect(packet.getCount()).toBe(2);
		expect(ssrcs[0]).toBe(ssrc1);
		expect(ssrcs[1]).toBe(ssrc2);
		expect(packet.getReason()).toBe(reason);
		expect(packet.getBuffer().compare(bufferWithPadding)).toBe(0);
	});

	test('parsing a buffer which length does not fit the indicated count throws', () =>
	{
		// Parse the first 8 bytes of buffer, indicating 1 SSRC and holding no
		// SSRC at all.
		expect(() => (new ByePacket(buffer.slice(undefined, 8))))
			.toThrowError(TypeError);
	});
});

describe('serialize RTCP BYE packet', () =>
{
	test('serialized buffer equals original one', () =>
	{
		const packet = new ByePacket(buffer);

		packet.getBuffer();

		expect(packet.getBuffer().compare(buffer)).toBe(0);
	});
});

describe('create RTCP BYE packet', () =>
{
	test('creating a BYE packet succeeds', () =>
	{
		const packet = new ByePacket();

		expect(packet).toBeDefined();
		expect(isRtcp(packet.getBuffer())).toBe(true);
	});

	test('creating a BYE packet with padding succeeds', () =>
	{
		const padding = 8;
		const bufferWithPadding = Buffer.from(
			[
				0xa2, 0xcb, 0x00, 0x08, // Type: 203 (Bye), Count: 2, length: 8
				0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
				0x26, 0x24, 0x67, 0x0e, // SSRC: 0x2624670e
				0x0e, 0x48, 0x61, 0x73, // Length: 14, Text: "Hasta la vista"
				0x74, 0x61, 0x20, 0x6c,
				0x61, 0x20, 0x76, 0x69,
				0x73, 0x74, 0x61, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x08 // Padding (8 bytes)
			]
		);

		const packet = new ByePacket();

		expect(packet).toBeDefined();
		expect(isRtcp(packet.getBuffer())).toBe(true);
		expect(packet.getPadding()).toBe(0);

		packet.setPadding(padding);
		packet.addSsrc(ssrc1);
		packet.addSsrc(ssrc2);
		packet.setReason(reason);

		expect(packet.getPadding()).toBe(8);
		expect(packet.getBuffer().compare(bufferWithPadding)).toBe(0);
	});
});
