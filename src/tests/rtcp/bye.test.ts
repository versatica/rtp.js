import { ByePacket } from '../../rtcp/bye';
import { isRtcp, RtcpPacketType } from '../../rtcp';
import { areBuffersEqual } from '../../utils';

const ssrc1 = 0x624276e0;
const ssrc2 = 0x2624670f;
const reason = 'Hasta la vista';

const buffer = new Uint8Array(
	[
		0x82, 0xcb, 0x00, 0x06, // Type: 203 (Bye), Count: 2, length: 6
		0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
		0x26, 0x24, 0x67, 0x0f, // SSRC: 0x2624670f
		0x0e, 0x48, 0x61, 0x73, // Length: 14, Text: "Hasta la vista"
		0x74, 0x61, 0x20, 0x6c,
		0x61, 0x20, 0x76, 0x69,
		0x73, 0x74, 0x61, 0x00
	]
).buffer;

describe('parse RTCP BYE packet', () =>
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
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getLength()).toBe(6);
		expect(ssrcs[0]).toBe(ssrc1);
		expect(ssrcs[1]).toBe(ssrc2);
		expect(packet.getReason()).toBe(reason);
	});

	test('packet processing succeeds for a buffer with padding', () =>
	{
		const padding = 4;
		const bufferWithPadding = new Uint8Array(
			[
				0xa2, 0xcb, 0x00, 0x07, // Padding, Type: 203 (Bye), Count: 2, length: 7
				0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
				0x26, 0x24, 0x67, 0x0f, // SSRC: 0x2624670f
				0x0e, 0x48, 0x61, 0x73, // Length: 14, Text: "Hasta la vista"
				0x74, 0x61, 0x20, 0x6c,
				0x61, 0x20, 0x76, 0x69,
				0x73, 0x74, 0x61, 0x00,
				0x00, 0x00, 0x00, 0x04 // Padding (4 bytes)
			]
		).buffer;

		const packet = new ByePacket(bufferWithPadding);
		const ssrcs = packet.getSsrcs();

		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(padding);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getLength()).toBe(7);
		expect(ssrcs[0]).toBe(ssrc1);
		expect(ssrcs[1]).toBe(ssrc2);
		expect(packet.getReason()).toBe(reason);
		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), bufferWithPadding)).toBe(true);
	});

	test('parsing a buffer which length does not fit the indicated count throws', () =>
	{
		// Parse the first 8 bytes of buffer, indicating 1 SSRC and holding no
		// SSRC at all.
		expect(() => (new ByePacket(buffer.slice(0, 8))))
			.toThrowError(TypeError);
	});
});

describe('serialize RTCP BYE packet', () =>
{
	test('serialized buffer equals original one', () =>
	{
		const packet = new ByePacket(buffer);

		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), buffer)).toBe(true);

		packet.serialize();

		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), buffer)).toBe(true);
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
		const reason2 = '~æeñ€';
		const bufferWithPadding = new Uint8Array(
			[
				0xa2, 0xcb, 0x00, 0x07, // Type: 203 (Bye), Count: 2, length: 7
				0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
				0x26, 0x24, 0x67, 0x0f, // SSRC: 0x2624670f
				0x09, 0x7e, 0xc3, 0xa6, // Length: 9, Text: "~æeñ€"
				0x65, 0xc3, 0xb1, 0xe2,
				0x82, 0xac, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x08 // Padding (8 bytes)
			]
		).buffer;

		const packet = new ByePacket();

		expect(packet).toBeDefined();
		expect(isRtcp(packet.getBuffer())).toBe(true);
		expect(packet.getPadding()).toBe(0);

		packet.addSsrc(ssrc1);
		packet.addSsrc(ssrc2);
		packet.setReason(reason2);
		packet.setPadding(padding);

		packet.serialize();

		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(padding);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getLength()).toBe(7);
		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), bufferWithPadding)).toBe(true);
	});

	test('packet.clone() succeeds', () =>
	{
		const packet = new ByePacket(buffer);
		const clonedPacket = packet.clone();

		expect(clonedPacket.getVersion()).toBe(packet.getVersion());
		expect(clonedPacket.getPadding()).toBe(packet.getPadding());
		expect(clonedPacket.getPacketType()).toBe(packet.getPacketType());
		expect(clonedPacket.getCount()).toBe(packet.getCount());
		expect(clonedPacket.getSsrcs()).toEqual(packet.getSsrcs());
		expect(clonedPacket.getReason()).toBe(packet.getReason());
		expect(clonedPacket.dump()).toEqual(packet.dump());
		// Compare buffers.
		expect(areBuffersEqual(clonedPacket.getBuffer(), packet.getBuffer())).toBe(true);
	});
});
