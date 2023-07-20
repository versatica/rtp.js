import { ByePacket } from '../../rtcp/bye';
import { isRtcp, RtcpPacketType } from '../../rtcp';
import { areBuffersEqual } from '../../utils';

const ssrc1 = 0x624276e0;
const ssrc2 = 0x2624670f;
const reason1 = 'Hasta la vista';
const reason2 = '~æeñ€';

const buffer = new Uint8Array(
	[
		0x82, 0xcb, 0x00, 0x06, // Type: 203 (Bye), Count: 2, length: 6
		0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
		0x26, 0x24, 0x67, 0x0f, // SSRC: 0x2624670f
		0x0e, 0x48, 0x61, 0x73, // Reason length: 14, Reason: "Hasta la vista"
		0x74, 0x61, 0x20, 0x6c,
		0x61, 0x20, 0x76, 0x69,
		0x73, 0x74, 0x61, 0x00 // 1 byte of padding in reason
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

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getLength()).toBe(6);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(reason1);
		expect(packet.needsSerialization()).toBe(false);
	});

	test('packet processing succeeds for a buffer with padding', () =>
	{
		const padding = 4;
		const bufferWithPadding = new Uint8Array(
			[
				0xa2, 0xcb, 0x00, 0x07, // Padding, Type: 203 (Bye), Count: 2, length: 7
				0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
				0x26, 0x24, 0x67, 0x0f, // SSRC: 0x2624670f
				0x0e, 0x48, 0x61, 0x73, // Reason length: 14, reason: "Hasta la vista"
				0x74, 0x61, 0x20, 0x6c,
				0x61, 0x20, 0x76, 0x69,
				0x73, 0x74, 0x61, 0x00, // 1 byte of padding in reason
				0x00, 0x00, 0x00, 0x04 // Padding (4 bytes)
			]
		).buffer;

		const packet = new ByePacket(bufferWithPadding);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(padding);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getLength()).toBe(7);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(reason1);
		expect(packet.needsSerialization()).toBe(false);
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
		expect(packet.needsSerialization()).toBe(false);

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
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(0);
		expect(packet.getLength()).toBe(0);
		expect(packet.getSsrcs()).toEqual([]);
		expect(packet.getReason()).toBe(undefined);
		expect(packet.needsSerialization()).toBe(false);
	});

	test('creating a BYE packet with padding succeeds', () =>
	{
		const padding = 8;
		const bufferWithPadding = new Uint8Array(
			[
				0xa2, 0xcb, 0x00, 0x07, // Type: 203 (Bye), Count: 2, length: 7
				0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
				0x26, 0x24, 0x67, 0x0f, // SSRC: 0x2624670f
				0x09, 0x7e, 0xc3, 0xa6, // Reason length: 9, Reason: "~æeñ€"
				0x65, 0xc3, 0xb1, 0xe2,
				0x82, 0xac, 0x00, 0x00, // 2 bytes of padding in reason
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x08 // Padding (8 bytes)
			]
		).buffer;

		const packet = new ByePacket();

		expect(packet).toBeDefined();
		expect(isRtcp(packet.getBuffer())).toBe(true);
		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(0);
		expect(packet.getLength()).toBe(0);
		expect(packet.getSsrcs()).toEqual([]);
		expect(packet.getReason()).toBe(undefined);
		expect(packet.needsSerialization()).toBe(false);

		packet.addSsrc(ssrc1);
		expect(packet.needsSerialization()).toBe(true);

		packet.serialize();
		packet.addSsrc(ssrc2);
		expect(packet.needsSerialization()).toBe(true);

		packet.serialize();
		packet.setReason(reason2);
		expect(packet.needsSerialization()).toBe(true);

		packet.serialize();
		packet.setPadding(padding);
		expect(packet.needsSerialization()).toBe(true);

		packet.serialize();
		expect(packet.needsSerialization()).toBe(false);

		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(padding);
		expect(packet.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet.getCount()).toBe(2);
		expect(packet.getLength()).toBe(7);
		expect(packet.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(packet.getReason()).toBe(reason2);
		expect(packet.needsSerialization()).toBe(false);
		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), bufferWithPadding)).toBe(true);
	});

	test('packet.clone() succeeds', () =>
	{
		const padding = 8;
		const bufferWithPadding = new Uint8Array(
			[
				0xa2, 0xcb, 0x00, 0x07, // Type: 203 (Bye), Count: 2, length: 7
				0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
				0x26, 0x24, 0x67, 0x0f, // SSRC: 0x2624670f
				0x09, 0x7e, 0xc3, 0xa6, // Reason length: 9, Reason: "~æeñ€"
				0x65, 0xc3, 0xb1, 0xe2,
				0x82, 0xac, 0x00, 0x00, // 2 bytes of padding in reason
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x08 // Padding (8 bytes)
			]
		).buffer;

		const packet = new ByePacket(bufferWithPadding);
		const clonedPacket = packet.clone();

		expect(packet.needsSerialization()).toBe(false);
		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.getVersion()).toBe(2);
		expect(clonedPacket.getPadding()).toBe(padding);
		expect(clonedPacket.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(clonedPacket.getCount()).toBe(2);
		expect(clonedPacket.getLength()).toBe(7);
		expect(clonedPacket.getSsrcs()).toEqual([ ssrc1, ssrc2 ]);
		expect(clonedPacket.getReason()).toBe(reason2);
		expect(clonedPacket.needsSerialization()).toBe(false);
		// Compare buffers.
		expect(areBuffersEqual(clonedPacket.getBuffer(), bufferWithPadding)).toBe(true);
		expect(areBuffersEqual(clonedPacket.getBuffer(), packet.getBuffer())).toBe(true);
	});
});
