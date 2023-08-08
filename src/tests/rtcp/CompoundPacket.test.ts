import { CompoundPacket } from '../../rtcp/CompoundPacket';
import { isRtcp, RtcpPacketType } from '../../rtcp/RtcpPacket';
import { ReceiverReportPacket } from '../../rtcp/ReceiverReportPacket';
import { SenderReportPacket } from '../../rtcp/SenderReportPacket';
import { ByePacket } from '../../rtcp/ByePacket';
import { SdesPacket } from '../../rtcp/SdesPacket';
import { UnknownPacket } from '../../rtcp/UnknownPacket';
import { areDataViewsEqual, numericArrayToDataView } from '../../utils';

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
			/* BYE packet */
			0xa2, 0xcb, 0x00, 0x07, // Padding, Type: 203 (Bye), Count: 2, length: 7
			0x62, 0x42, 0x76, 0xe0, // SSRC: 0x624276e0
			0x26, 0x24, 0x67, 0x0e, // SSRC: 0x2624670e
			0x0e, 0x48, 0x61, 0x73, // Length: 14, Text: "Hasta la vista"
			0x74, 0x61, 0x20, 0x6c,
			0x61, 0x20, 0x76, 0x69,
			0x73, 0x74, 0x61, 0x00,
			0x00, 0x00, 0x00, 0x04, // Padding (4 bytes)
			/* Unknown packet */
			0xa2, 0xc1, 0x00, 0x03, // Padding, Type: 193 (unknown), Count: 2, length: 3
			0x11, 0x22, 0x33, 0x44, // Body
			0x55, 0x66, 0x77, 0x88,
			0x99, 0x00, 0x00, 0x03, // Padding (3 bytes)
			/* SDES packet */
			0x81, 0xca, 0x00, 0x03, // Type: 202 (SDES), Count: 1, Length: 3
			// Chunk
			0x11, 0x22, 0x33, 0x44, // SSRC: 0x11223344
			0x05, 0x02, 0x61, 0x62, // Item Type: 5 (XXXX), Length: 2, Text: "ab"
			0x00, 0x00, 0x00, 0x00 // 4 null octets
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
		const compoundPacket = new CompoundPacket(view);

		expect(compoundPacket.needsSerialization()).toBe(false);
		expect(compoundPacket.getByteLength()).toBe(172);
		expect(compoundPacket.getPackets().length).toBe(5);
		expect(areDataViewsEqual(compoundPacket.getView(), view)).toBe(true);

		const packet1 = compoundPacket.getPackets()[0] as ReceiverReportPacket;

		expect(packet1.needsSerialization()).toBe(false);
		expect(packet1.getByteLength()).toBe(56);
		expect(packet1.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet1.getCount()).toBe(2);
		expect(packet1.getPadding()).toBe(0);
		expect(packet1.getSsrc()).toBe(0x5d931534);

		const packet2 = compoundPacket.getPackets()[1] as SenderReportPacket;

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

		const packet3 = compoundPacket.getPackets()[2] as ByePacket;

		expect(packet3.needsSerialization()).toBe(false);
		expect(packet3.getByteLength()).toBe(32);
		expect(packet3.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet3.getCount()).toBe(2);
		expect(packet3.getPadding()).toBe(4);
		expect(packet3.getSsrcs()).toEqual([ 0x624276e0, 0x2624670e ]);
		expect(packet3.getReason()).toBe('Hasta la vista');

		const packet4 = compoundPacket.getPackets()[3] as UnknownPacket;

		expect(packet4.needsSerialization()).toBe(false);
		expect(packet4.getByteLength()).toBe(16);
		expect(packet4.getPacketType()).toBe(193);
		expect(packet4.getCount()).toBe(2);
		expect(packet4.getPadding()).toBe(3);
		expect(packet4.needsSerialization()).toBe(false);
		expect(packet4.getBody()).toEqual(numericArrayToDataView(
			[ 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99 ]
		));

		const packet5 = compoundPacket.getPackets()[4] as SdesPacket;

		expect(packet5.needsSerialization()).toBe(false);
		expect(packet5.getByteLength()).toBe(16);
		expect(packet5.getPacketType()).toBe(RtcpPacketType.SDES);
		expect(packet5.getCount()).toBe(1);
		expect(packet5.getPadding()).toBe(0);
		expect(packet5.getChunks().length).toBe(1);

		expect(compoundPacket.dump()).toEqual(
			{
				padding    : 0,
				byteLength : 172,
				packets    :
				[
					packet1.dump(),
					packet2.dump(),
					packet3.dump(),
					packet4.dump(),
					packet5.dump()
				]
			});

		// Also test the same after serializing.
		compoundPacket.serialize();

		expect(compoundPacket.needsSerialization()).toBe(false);
		expect(compoundPacket.getByteLength()).toBe(172);
		expect(compoundPacket.getPackets().length).toBe(5);
		expect(areDataViewsEqual(compoundPacket.getView(), view)).toBe(true);

		const packet1B = compoundPacket.getPackets()[0] as ReceiverReportPacket;

		expect(packet1B.needsSerialization()).toBe(false);
		expect(packet1B.getByteLength()).toBe(56);
		expect(packet1B.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet1B.getCount()).toBe(2);
		expect(packet1B.getPadding()).toBe(0);
		expect(packet1B.getSsrc()).toBe(0x5d931534);

		const packet2B = compoundPacket.getPackets()[1] as SenderReportPacket;

		expect(packet2B.needsSerialization()).toBe(false);
		expect(packet2B.getByteLength()).toBe(52);
		expect(packet2B.getPacketType()).toBe(RtcpPacketType.SR);
		expect(packet2B.getCount()).toBe(1);
		expect(packet2B.getPadding()).toBe(0);
		expect(packet2B.getSsrc()).toBe(0x5d931534);
		expect(packet2B.getNtpSeconds()).toBe(3711615412);
		expect(packet2B.getNtpFraction()).toBe(1985245553);
		expect(packet2B.getRtpTimestamp()).toBe(577280);
		expect(packet2B.getPacketCount()).toBe(3608);
		expect(packet2B.getOctetCount()).toBe(577280);

		const packet3B = compoundPacket.getPackets()[2] as ByePacket;

		expect(packet3B.needsSerialization()).toBe(false);
		expect(packet3B.getByteLength()).toBe(32);
		expect(packet3B.getPacketType()).toBe(RtcpPacketType.BYE);
		expect(packet3B.getCount()).toBe(2);
		expect(packet3B.getPadding()).toBe(4);
		expect(packet3B.getSsrcs()).toEqual([ 0x624276e0, 0x2624670e ]);
		expect(packet3B.getReason()).toBe('Hasta la vista');

		const packet4B = compoundPacket.getPackets()[3] as UnknownPacket;

		expect(packet4B.needsSerialization()).toBe(false);
		expect(packet4B.getByteLength()).toBe(16);
		expect(packet4B.getPacketType()).toBe(193);
		expect(packet4B.getCount()).toBe(2);
		expect(packet4B.getPadding()).toBe(3);
		expect(packet4B.needsSerialization()).toBe(false);
		expect(packet4B.getBody()).toEqual(numericArrayToDataView(
			[ 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99 ]
		));

		const packet5B = compoundPacket.getPackets()[4] as SdesPacket;

		expect(packet5B.needsSerialization()).toBe(false);
		expect(packet5B.getByteLength()).toBe(16);
		expect(packet5B.getPacketType()).toBe(RtcpPacketType.SDES);
		expect(packet5B.getCount()).toBe(1);
		expect(packet5B.getPadding()).toBe(0);
		expect(packet5B.getChunks().length).toBe(1);

		expect(compoundPacket.dump()).toEqual(
			{
				padding    : 0,
				byteLength : 172,
				packets    :
				[
					packet1B.dump(),
					packet2B.dump(),
					packet3B.dump(),
					packet4B.dump(),
					packet5B.dump()
				]
			});

		// Modify Bye packet.
		packet3.addSsrc(666);

		expect(compoundPacket.needsSerialization()).toBe(true);
		expect(compoundPacket.getByteLength()).toBe(176);
		expect(compoundPacket.getPackets().length).toBe(5);

		expect(compoundPacket.dump()).toEqual(
			{
				padding    : 0,
				byteLength : 176,
				packets    :
				[
					packet1B.dump(),
					packet2B.dump(),
					packet3B.dump(),
					packet4B.dump(),
					packet5B.dump()
				]
			});
	});

	test('packet.clone() succeeds', () =>
	{
		const compoundPacket = new CompoundPacket(view);
		const clonedCompoundPacket = compoundPacket.clone();

		expect(clonedCompoundPacket.needsSerialization()).toBe(false);
		expect(clonedCompoundPacket.getByteLength())
			.toBe(compoundPacket.getByteLength());
		expect(clonedCompoundPacket.getPackets().length)
			.toBe(compoundPacket.getPackets().length);
		expect(clonedCompoundPacket.dump()).toEqual(compoundPacket.dump());
		expect(areDataViewsEqual(
			clonedCompoundPacket.getView(),
			compoundPacket.getView())
		).toBe(true);
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

describe('create RTCP Compound packet', () =>
{
	test('creating an Compound packet with 3 RTCP packets', () =>
	{
		const compoundPacket = new CompoundPacket();

		const packet1 = new ReceiverReportPacket();
		const packet2 = new UnknownPacket(undefined, 199);
		const packet3 = new SenderReportPacket();

		compoundPacket.addPacket(packet1);
		compoundPacket.addPacket(packet2);
		compoundPacket.addPacket(packet3);

		expect(compoundPacket.dump()).toEqual(
			{
				padding    : 0,
				byteLength : 8 + 4 + 28,
				packets    :
				[
					packet1.dump(),
					packet2.dump(),
					packet3.dump()
				]
			});

		compoundPacket.serialize();

		expect(compoundPacket.dump()).toEqual(
			{
				padding    : 0,
				byteLength : 8 + 4 + 28,
				packets    :
				[
					packet1.dump(),
					packet2.dump(),
					packet3.dump()
				]
			});

		const clonedCompoundPacket = compoundPacket.clone();

		expect(clonedCompoundPacket.dump()).toEqual(
			{
				padding    : 0,
				byteLength : 8 + 4 + 28,
				packets    :
				[
					packet1.dump(),
					packet2.dump(),
					packet3.dump()
				]
			});
	});
});
