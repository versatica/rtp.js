import { CompoundPacket } from '../../rtcp/CompoundPacket';
import { isRtcp, RtcpPacketType } from '../../rtcp/RtcpPacket';
import { ReceiverReportPacket } from '../../rtcp/ReceiverReportPacket';
import { SenderReportPacket } from '../../rtcp/SenderReportPacket';
import { ByePacket } from '../../rtcp/ByePacket';

import { areDataViewsEqual } from '../../utils';

describe('parse RTCP Compound packet', () =>
{
	const array = new Uint8Array(
		[
			/* Receiver Report packet */
			0x82, 0xc9, 0x00, 0x0D, // Type: 201 (Receiver Report), Count: 2, Length: 13
			0x5d, 0x93, 0x15, 0x34, // Sender SSRC: 0x5d931534
			// Receiver Report
			0x01, 0x93, 0x2d, 0xb4, // SSRC. 0x01932db4
			0x50, 0x00, 0x00, 0xd8, // Fraction lost: 80, Total lost: 216
			0x00, 0x05, 0x39, 0x46, // Extended highest sequence number: 342342
			0x00, 0x00, 0x00, 0x00, // Jitter: 0
			0x00, 0x00, 0x20, 0x2a, // Last SR: 8234
			0x00, 0x00, 0x00, 0x05, // DLSR: 5
			// Receiver Report
			0x02, 0x93, 0x2d, 0xb4, // SSRC. 0x02932db4
			0x51, 0x00, 0x00, 0xd9, // Fraction lost: 81, Total lost: 217
			0x00, 0x05, 0x39, 0x47, // Extended highest sequence number: 342343
			0x00, 0x00, 0x00, 0x02, // Jitter: 2
			0x00, 0x00, 0x20, 0x2b, // Last SR: 8235
			0x00, 0x00, 0x00, 0x06, // DLSR: 6
			/* Sender Report packet */
			0x81, 0xc8, 0x00, 0x0c, // Type: 200 (Sender Report), Count: 1, Length: 12
			0x5d, 0x93, 0x15, 0x34, // SSRC: 0x5d931534
			0xdd, 0x3a, 0xc1, 0xb4, // NTP Sec: 3711615412
			0x76, 0x54, 0x71, 0x71, // NTP Frac: 1985245553
			0x00, 0x08, 0xcf, 0x00, // RTP timestamp: 577280
			0x00, 0x00, 0x0e, 0x18, // Packet count: 3608
			0x00, 0x08, 0xcf, 0x00, // Octet count: 577280
			// Receiver Report
			0x01, 0x93, 0x2d, 0xb4, // SSRC. 0x01932db4
			0x50, 0x00, 0x00, 0xd8, // Fraction lost: 0, Total lost: 1
			0x00, 0x05, 0x39, 0x46, // Extended highest sequence number: 0
			0x00, 0x00, 0x00, 0x00, // Jitter: 0
			0x00, 0x00, 0x20, 0x2a, // Last SR: 8234
			0x00, 0x00, 0x00, 0x05, // DLSR: 5
			/* Bye packet */
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
		const packet = new CompoundPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(140);
		expect(packet.getPackets().length).toBe(3);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const packet1 = packet.getPackets()[0] as ReceiverReportPacket;

		expect(packet1.needsSerialization()).toBe(false);
		expect(packet1.getByteLength()).toBe(56);
		expect(packet1.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet1.getCount()).toBe(2);
		expect(packet1.getPadding()).toBe(0);
		expect(packet1.getSsrc()).toBe(0x5d931534);

		const packet2 = packet.getPackets()[1] as SenderReportPacket;

		expect(packet2.needsSerialization()).toBe(false);
		expect(packet2.getByteLength()).toBe(52);
		expect(packet2.getPacketType()).toBe(RtcpPacketType.SR);
		expect(packet2.getCount()).toBe(1);
		expect(packet2.getPadding()).toBe(0);
		expect(packet2.getSsrc()).toBe(0x5d931534);
		expect(packet2.getNtpSeconds()).toBe(3711615412);
		expect(packet2.getNtpFraction()).toBe(1985245553);
		expect(packet2.getRtpTimestamp()).toBe(577280);
		expect(packet2.getPacketCount()).toBe(3608);
		expect(packet2.getOctetCount()).toBe(577280);

		const packet3 = packet.getPackets()[2] as ByePacket;

		expect(packet3.needsSerialization()).toBe(false);
		expect(packet3.getByteLength()).toBe(32);
		expect(packet3.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet3.getCount()).toBe(2);
		expect(packet3.getPadding()).toBe(4);
		expect(packet3.getSsrcs()).toEqual([ 0x624276e0, 0x2624670e ]);
		expect(packet3.getReason()).toBe('Hasta la vista');
	});

	test('packet.clone() succeeds', () =>
	{
		const packet = new CompoundPacket(view);
		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.getByteLength()).toBe(packet.getByteLength());
		expect(clonedPacket.getPackets().length).toBe(3);
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(true);
	});

	test('parsing a buffer view with some incomplete packet throws', () =>
	{
		// Read only 136 of the 140 bytes of the buffer view.
		const view2 = new DataView(
			array.buffer,
			array.byteOffset,
			136
		);

		expect(() => (new CompoundPacket(view2)))
			.toThrowError(RangeError);
	});
});
