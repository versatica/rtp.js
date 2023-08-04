import {
	ReceiverReportPacket,
	ReceiverReport,
	ReceiverReportDump
} from '../../rtcp/ReceiverReportPacket';
import { isRtcp, RtcpPacketType } from '../../rtcp/RtcpPacket';
import { areDataViewsEqual, numericArrayToDataView } from '../../utils';

const reportData1: ReceiverReportDump =
{
	ssrc         : 26422708,
	fractionLost : 80,
	totalLost    : 216,
	highestSeq   : 342342,
	jitter       : 0,
	lsr          : 8234,
	dlsr         : 5
};

const reportData2: ReceiverReportDump =
{
	ssrc         : 0x02932db4,
	fractionLost : 81,
	totalLost    : 217,
	highestSeq   : 342343,
	jitter       : 2,
	lsr          : 8235,
	dlsr         : 6
};

describe('parse RTCP Receiver Report packet', () =>
{
	const array = new Uint8Array(
		[
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
			0x00, 0x00, 0x00, 0x06 // DLSR: 6
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
		const packet = new ReceiverReportPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 8 (fixed header) + 48 (2 reports) = 56.
		expect(packet.getByteLength()).toBe(56);
		expect(packet.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(0x5d931534);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const report1 = packet.getReports()[0];
		const report2 = packet.getReports()[1];

		checkReceiverReport(report1, reportData1);
		checkReceiverReport(report2, reportData2);
	});

	test('packet processing succeeds for a buffer view with padding', () =>
	{
		const array2 = new Uint8Array(
			[
				0xa1, 0xc9, 0x00, 0x08, // Padding, Type: 201, Count: 1, Length: 8
				0x5d, 0x93, 0x15, 0x34, // Sender SSRC: 0x5d931534
				// Receiver Report
				0x01, 0x93, 0x2d, 0xb4, // SSRC. 0x01932db4
				0x50, 0x00, 0x00, 0xd8, // Fraction lost: 80, Total lost: 216
				0x00, 0x05, 0x39, 0x46, // Extended highest sequence number: 342342
				0x00, 0x00, 0x00, 0x00, // Jitter: 0
				0x00, 0x00, 0x20, 0x2a, // Last SR: 8234
				0x00, 0x00, 0x00, 0x05, // DLSR: 5
				0x00, 0x00, 0x00, 0x04 // Padding (4 bytes)
			]
		);

		const view2 = new DataView(
			array2.buffer,
			array2.byteOffset,
			array2.byteLength
		);

		const packet = new ReceiverReportPacket(view2);

		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 8 (fixed header) + 24 (1 report) + 4 (padding) = 32.
		expect(packet.getByteLength()).toBe(36);
		expect(packet.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet.getCount()).toBe(1);
		expect(packet.getPadding()).toBe(4);
		expect(packet.getSsrc()).toBe(0x5d931534);
		expect(areDataViewsEqual(packet.getView(), view2)).toBe(true);

		const report = packet.getReports()[0];

		checkReceiverReport(report, reportData1);
	});

	test('parsing a buffer view which length does not fit the indicated count throws', () =>
	{
		// Parse the first 8 bytes of buffer, indicating 1 Receiver Report and
		// holding no report at all.
		const view3 = new DataView(
			array.buffer,
			array.byteOffset,
			8
		);

		expect(() => (new ReceiverReportPacket(view3)))
			.toThrowError(RangeError);
	});
});

describe('create RTCP Receiver Report packet', () =>
{
	test('creating a Receiver Report packet succeeds', () =>
	{
		const packet = new ReceiverReportPacket();

		expect(isRtcp(packet.getView())).toBe(true);
		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 8 (fixed header).
		expect(packet.getByteLength()).toBe(8);
		expect(packet.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(0);
		expect(packet.needsSerialization()).toBe(false);

		packet.setSsrc(1111);
		expect(packet.getSsrc()).toBe(1111);

		packet.setPadding(3);
		expect(packet.getPadding()).toBe(3);
		// Byte length must be 8 + 3 (padding) = 11.
		expect(packet.getByteLength()).toBe(11);

		packet.padTo4Bytes();
		// After padding to 4 bytes, padding must be 0 since the rest of the packet
		// always fits into groups of 4 bytes.
		expect(packet.getPadding()).toBe(0);
		// Byte length must be 8.
		expect(packet.getByteLength()).toBe(8);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(1111);
		expect(packet.needsSerialization()).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(8);
		expect(packet.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(1111);
		expect(packet.needsSerialization()).toBe(false);
		expect(isRtcp(packet.getView())).toBe(true);

		const report = new ReceiverReport();

		report.setSsrc(1234);
		report.setFractionLost(50);
		report.setTotalLost(4);
		report.setHighestSeqNumber(5663);
		report.setJitter(43);
		report.setLastSRTimestamp(10012312);
		report.setDelaySinceLastSR(999983432);

		packet.setReports([ report ]);
		expect(isRtcp(packet.getView())).toBe(true);

		const clonedPacket = packet.clone();

		expect(isRtcp(clonedPacket.getView())).toBe(true);
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(true);
	});

	test('packet.clone() succeeds', () =>
	{
		const array = new Uint8Array(
			[
				0xa0, 0xc9, 0x00, 0x03, // Padding, Type: 201, Count: 0, Length: 3
				0x5d, 0x93, 0x15, 0x34, // Sender SSRC: 0x5d931534
				0x00, 0x00, 0x00, 0x00, // Padding (8 bytes)
				0x00, 0x00, 0x00, 0x08
			]
		);

		const view = new DataView(
			array.buffer,
			array.byteOffset,
			array.byteLength
		);

		const packet = new ReceiverReportPacket(view);
		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.getByteLength()).toBe(16);
		expect(clonedPacket.getPacketType()).toBe(RtcpPacketType.RR);
		expect(clonedPacket.getCount()).toBe(0);
		expect(clonedPacket.getPadding()).toBe(8);
		expect(clonedPacket.getSsrc()).toBe(0x5d931534);
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(true);
	});
});

describe('parse RTCP Receiver Report', () =>
{
	const array = new Uint8Array(
		[
			// Receiver Report
			0x01, 0x93, 0x2d, 0xb4, // SSRC. 0x01932db4
			0x50, 0x00, 0x00, 0xd8, // Fraction lost: 80, Total lost: 216
			0x00, 0x05, 0x39, 0x46, // Extended highest sequence number: 342342
			0x00, 0x00, 0x00, 0x00, // Jitter: 0
			0x00, 0x00, 0x20, 0x2a, // Last SR: 8234
			0x00, 0x00, 0x00, 0x05 // DLSR: 5
		]
	);

	const view = new DataView(
		array.buffer,
		array.byteOffset,
		array.byteLength
	);

	test('report processing succeeds', () =>
	{
		const report = new ReceiverReport(view);

		expect(report).toBeDefined();

		checkReceiverReport(report, reportData1);
	});

	test('parsing a buffer which length does not fit the report size throws', () =>
	{
		// Parse a 23 bytes buffer.
		expect(
			() => (new ReceiverReport(numericArrayToDataView([ 23 ]))))
			.toThrowError(TypeError);
	});
});

describe('create RTCP Receiver Report', () =>
{
	test('creating a Receiver Report succeeds', () =>
	{
		const report = new ReceiverReport();

		expect(report).toBeDefined();

		report.setSsrc(reportData1.ssrc);
		report.setFractionLost(reportData1.fractionLost);
		report.setTotalLost(reportData1.totalLost);
		report.setHighestSeqNumber(reportData1.highestSeq);
		report.setJitter(reportData1.jitter);
		report.setLastSRTimestamp(reportData1.lsr);
		report.setDelaySinceLastSR(reportData1.dlsr);

		checkReceiverReport(report, reportData1);
	});
});

function checkReceiverReport(report: ReceiverReport, data: ReceiverReportDump)
{
	expect(report.getSsrc()).toBe(data.ssrc);
	expect(report.getFractionLost()).toBe(data.fractionLost);
	expect(report.getTotalLost()).toBe(data.totalLost);
	expect(report.getHighestSeqNumber()).toBe(data.highestSeq);
	expect(report.getJitter()).toBe(data.jitter);
	expect(report.getLastSRTimestamp()).toBe(data.lsr);
	expect(report.getDelaySinceLastSR()).toBe(data.dlsr);
}
