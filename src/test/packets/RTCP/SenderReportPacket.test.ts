import { SenderReportPacket } from '../../../packets/RTCP/SenderReportPacket';
import {
	ReceptionReport,
	ReceptionReportDump,
} from '../../../packets/RTCP/ReceiverReportPacket';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { areDataViewsEqual } from '../../../utils/helpers';

const receptionReportDump1: ReceptionReportDump = {
	byteLength: 24,
	ssrc: 0x01932db4,
	fractionLost: 80,
	totalLost: 216,
	highestSeq: 342342,
	jitter: 0,
	lsr: 8234,
	dlsr: 5,
};

describe('parse RTCP Sender Report packet', () => {
	// Sender info.
	const ssrc = 0x5d931534;
	const ntpSeconds = 3711615412;
	const ntpFraction = 1985245553;
	const rtpTimestamp = 577280;
	const packetCount = 3608;
	const octetCount = 577280;

	const array = new Uint8Array([
		0x81,
		0xc8,
		0x00,
		0x0c, // Type: 200 (Sender Report), Count: 1, Length: 12
		0x5d,
		0x93,
		0x15,
		0x34, // SSRC: 0x5d931534
		0xdd,
		0x3a,
		0xc1,
		0xb4, // NTP Sec: 3711615412
		0x76,
		0x54,
		0x71,
		0x71, // NTP Frac: 1985245553
		0x00,
		0x08,
		0xcf,
		0x00, // RTP timestamp: 577280
		0x00,
		0x00,
		0x0e,
		0x18, // Packet count: 3608
		0x00,
		0x08,
		0xcf,
		0x00, // Octet count: 577280
		// Reception Report
		0x01,
		0x93,
		0x2d,
		0xb4, // SSRC: 0x01932db4
		0x50,
		0x00,
		0x00,
		0xd8, // Fraction lost: 0, Total lost: 1
		0x00,
		0x05,
		0x39,
		0x46, // Extended highest sequence number: 0
		0x00,
		0x00,
		0x00,
		0x00, // Jitter: 0
		0x00,
		0x00,
		0x20,
		0x2a, // Last SR: 8234
		0x00,
		0x00,
		0x00,
		0x05, // DLSR: 5
	]);

	const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

	test('buffer view is RTCP', () => {
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		const packet = new SenderReportPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 28 (fixed header) + 24 (1 report) = 52.
		expect(packet.getByteLength()).toBe(52);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SR);
		expect(packet.getCount()).toBe(1);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(ssrc);
		expect(packet.getNtpSeconds()).toBe(ntpSeconds);
		expect(packet.getNtpFraction()).toBe(ntpFraction);
		expect(packet.getRtpTimestamp()).toBe(rtpTimestamp);
		expect(packet.getPacketCount()).toBe(packetCount);
		expect(packet.getOctetCount()).toBe(octetCount);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const report1 = packet.getReports()[0];

		expect(report1.dump()).toEqual(receptionReportDump1);

		// Also test the same after serializing.
		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 28 (fixed header) + 24 (1 report) = 52.
		expect(packet.getByteLength()).toBe(52);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SR);
		expect(packet.getCount()).toBe(1);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(ssrc);
		expect(packet.getNtpSeconds()).toBe(ntpSeconds);
		expect(packet.getNtpFraction()).toBe(ntpFraction);
		expect(packet.getRtpTimestamp()).toBe(rtpTimestamp);
		expect(packet.getPacketCount()).toBe(packetCount);
		expect(packet.getOctetCount()).toBe(octetCount);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const report1B = packet.getReports()[0];

		expect(report1B.dump()).toEqual(receptionReportDump1);

		// If a change is done in a Reception Report, the Receiver Report packet must
		// need serialization.
		report1B.setDelaySinceLastSR(6);
		expect(report1B.needsSerialization()).toBe(true);
		expect(packet.needsSerialization()).toBe(true);

		// And if we serialize the packet, it should unset the serialization needed
		// flag.
		packet.serialize();
		expect(report1B.needsSerialization()).toBe(false);
		expect(packet.needsSerialization()).toBe(false);
	});

	test('packet processing succeeds for a buffer view with padding', () => {
		const array2 = new Uint8Array([
			0xa0,
			0xc8,
			0x00,
			0x07, // Padding, Type: 200, Count: 0, Length: 7
			0x5d,
			0x93,
			0x15,
			0x34, // SSRC: 0x5d931534
			0xdd,
			0x3a,
			0xc1,
			0xb4, // NTP Sec: 3711615412
			0x76,
			0x54,
			0x71,
			0x71, // NTP Frac: 1985245553
			0x00,
			0x08,
			0xcf,
			0x00, // RTP timestamp: 577280
			0x00,
			0x00,
			0x0e,
			0x18, // Packet count: 3608
			0x00,
			0x08,
			0xcf,
			0x00, // Octet count: 577280
			0x00,
			0x00,
			0x00,
			0x04, // Padding (4 bytes)
		]);

		const view2 = new DataView(
			array2.buffer,
			array2.byteOffset,
			array2.byteLength,
		);

		const packet = new SenderReportPacket(view2);

		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 28 (fixed header) + 4 (padding) = 32.
		expect(packet.getByteLength()).toBe(32);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SR);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(4);
		expect(packet.getSsrc()).toBe(ssrc);
		expect(packet.getNtpSeconds()).toBe(ntpSeconds);
		expect(packet.getNtpFraction()).toBe(ntpFraction);
		expect(packet.getRtpTimestamp()).toBe(rtpTimestamp);
		expect(packet.getPacketCount()).toBe(packetCount);
		expect(packet.getOctetCount()).toBe(octetCount);
		expect(areDataViewsEqual(packet.getView(), view2)).toBe(true);
	});

	test('parsing a buffer view which length does not fit the indicated count throws', () => {
		// Parse the first 8 bytes of buffer, indicating 1 Reception Report and
		// holding no report at all.
		const view3 = new DataView(array.buffer, array.byteOffset, 8);

		expect(() => new SenderReportPacket(view3)).toThrowError(RangeError);
	});
});

describe('create RTCP Sender Report packet', () => {
	test('creating a Sender Report packet succeeds', () => {
		const packet = new SenderReportPacket();

		expect(isRtcp(packet.getView())).toBe(true);
		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 28 (fixed header).
		expect(packet.getByteLength()).toBe(28);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SR);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(0);
		expect(packet.getNtpSeconds()).toBe(0);
		expect(packet.getNtpFraction()).toBe(0);
		expect(packet.getRtpTimestamp()).toBe(0);
		expect(packet.getPacketCount()).toBe(0);
		expect(packet.getOctetCount()).toBe(0);
		expect(packet.needsSerialization()).toBe(false);

		packet.setSsrc(1111);
		packet.setNtpSeconds(1234);
		packet.setNtpFraction(2345);
		packet.setRtpTimestamp(123456789);
		packet.setPacketCount(666);
		packet.setOctetCount(999);

		expect(packet.getSsrc()).toBe(1111);
		expect(packet.getNtpSeconds()).toBe(1234);
		expect(packet.getNtpFraction()).toBe(2345);
		expect(packet.getRtpTimestamp()).toBe(123456789);
		expect(packet.getPacketCount()).toBe(666);
		expect(packet.getOctetCount()).toBe(999);

		packet.padTo4Bytes();
		// After padding to 4 bytes, nothing should change since the rest of the
		// packet always fits into groups of 4 bytes.
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(28);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SR);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(1111);
		expect(packet.getNtpSeconds()).toBe(1234);
		expect(packet.getNtpFraction()).toBe(2345);
		expect(packet.getRtpTimestamp()).toBe(123456789);
		expect(packet.getPacketCount()).toBe(666);
		expect(packet.getOctetCount()).toBe(999);
		expect(packet.needsSerialization()).toBe(false);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(28);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SR);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(1111);
		expect(packet.getNtpSeconds()).toBe(1234);
		expect(packet.getNtpFraction()).toBe(2345);
		expect(packet.getRtpTimestamp()).toBe(123456789);
		expect(packet.getPacketCount()).toBe(666);
		expect(packet.getOctetCount()).toBe(999);
		expect(packet.needsSerialization()).toBe(false);
		expect(isRtcp(packet.getView())).toBe(true);

		const report = new ReceptionReport();

		report.setSsrc(1234);
		report.setFractionLost(50);
		report.setTotalLost(4);
		report.setHighestSeqNumber(5663);
		report.setJitter(43);
		report.setLastSRTimestamp(10012312);
		report.setDelaySinceLastSR(999983432);

		packet.setReports([report]);
		expect(isRtcp(packet.getView())).toBe(true);

		const clonedPacket = packet.clone();

		expect(isRtcp(clonedPacket.getView())).toBe(true);
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(
			true,
		);
	});

	test('packet.clone() succeeds', () => {
		const array = new Uint8Array([
			0xa0,
			0xc8,
			0x00,
			0x08, // Padding, Type: 200, Count: 0, Length: 8
			0x5d,
			0x93,
			0x15,
			0x34, // SSRC: 0x5d931534
			0xdd,
			0x3a,
			0xc1,
			0xb4, // NTP Sec: 3711615412
			0x76,
			0x54,
			0x71,
			0x71, // NTP Frac: 1985245553
			0x00,
			0x08,
			0xcf,
			0x00, // RTP timestamp: 577280
			0x00,
			0x00,
			0x0e,
			0x18, // Packet count: 3608
			0x00,
			0x08,
			0xcf,
			0x00, // Octet count: 577280
			0x00,
			0x00,
			0x00,
			0x00, // Padding (8 bytes)
			0x00,
			0x00,
			0x00,
			0x08,
		]);

		const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

		const packet = new SenderReportPacket(view);
		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.getByteLength()).toBe(36);
		expect(clonedPacket.getPacketType()).toBe(RtcpPacketType.SR);
		expect(clonedPacket.getCount()).toBe(0);
		expect(clonedPacket.getPadding()).toBe(8);
		expect(packet.getSsrc()).toBe(0x5d931534);
		expect(packet.getNtpSeconds()).toBe(3711615412);
		expect(packet.getNtpFraction()).toBe(1985245553);
		expect(packet.getRtpTimestamp()).toBe(577280);
		expect(packet.getPacketCount()).toBe(3608);
		expect(packet.getOctetCount()).toBe(577280);
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(
			true,
		);
	});
});
