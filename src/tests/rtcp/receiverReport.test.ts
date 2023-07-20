import {
	ReceiverReport,
	ReceiverReportPacket,
	ReceiverReportDump,
	RECEIVER_REPORT_LENGTH
} from '../../rtcp/receiverReport';
import { isRtcp, RtcpPacketType } from '../../rtcp';
import { areBuffersEqual, numericArrayToArrayBuffer } from '../../utils';

const buffer = new Uint8Array(
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
).buffer;

const report1data: ReceiverReportDump =
{
	ssrc         : 26422708,
	fractionLost : 80,
	totalLost    : 216,
	highestSeq   : 342342,
	jitter       : 0,
	lsr          : 8234,
	dlsr         : 5
};

const report2data: ReceiverReportDump =
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
	test('buffer is RTCP', () =>
	{
		expect(isRtcp(buffer)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		const packet = new ReceiverReportPacket(buffer);

		expect(packet.needsSerialization()).toBe(false);

		const report1 = packet.getReports()[0];
		const report2 = packet.getReports()[1];

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getVersion()).toBe(2);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet.getSsrc()).toBe(0x5d931534);
		expect(packet.getLength()).toBe(13);
		expect(packet.getPadding()).toBe(0);
		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), buffer)).toBe(true);

		checkReport(report1, report1data);
		checkReport(report2, report2data);
	});

	test('packet processing succeeds for a buffer with padding', () =>
	{
		const padding = 4;
		const bufferWithPadding = new Uint8Array(
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
		).buffer;

		const packet = new ReceiverReportPacket(bufferWithPadding);
		const report = packet.getReports()[0];

		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(padding);
		expect(packet.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet.getCount()).toBe(1);
		expect(packet.getLength()).toBe(8);
		expect(packet.getSsrc()).toBe(0x5d931534);
		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), bufferWithPadding)).toBe(true);

		checkReport(report, report1data);
	});

	test('parsing a buffer which length does not fit the indicated count throws', () =>
	{
		// Parse the first 8 bytes of buffer, indicating 1 Receiver Report and
		// holding no report at all.
		expect(() => (new ReceiverReportPacket(buffer.slice(0, 8))))
			.toThrowError(TypeError);
	});
});

describe('parse RTCP Receiver Report', () =>
{
	test('report processing succeeds', () =>
	{
		const report = new ReceiverReport(buffer.slice(8, 8 + RECEIVER_REPORT_LENGTH));

		expect(report).toBeDefined();

		checkReport(report, report1data);
	});

	test('parsing a buffer which length does not fit the report size throws', () =>
	{
		// Parse a 23 bytes buffer.
		expect(
			() => (new ReceiverReport(numericArrayToArrayBuffer([ 23 ]))))
			.toThrowError(TypeError);
	});
});

describe('serialize RTCP Receiver Report packet', () =>
{
	test('serialized buffer equals original one', () =>
	{
		const packet = new ReceiverReportPacket(buffer);

		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), buffer)).toBe(true);

		packet.serialize();

		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), buffer)).toBe(true);
	});
});

describe('serialize RTCP Receiver Report', () =>
{
	test('serialized buffer equals original one', () =>
	{
		const report = new ReceiverReport(buffer.slice(8, 8 + RECEIVER_REPORT_LENGTH));

		expect(areBuffersEqual(
			report.getBuffer(),
			buffer.slice(8, 8 + RECEIVER_REPORT_LENGTH))
		).toBe(true);
	});
});

describe('create RTCP Receiver Report packet', () =>
{
	test('creating a Receiver Report packet succeeds', () =>
	{
		const packet = new ReceiverReportPacket();

		expect(packet).toBeDefined();
		expect(isRtcp(packet.getBuffer())).toBe(true);
	});

	test('creating a Receiver Report packet with padding succeeds', () =>
	{
		const padding = 8;
		const bufferWithPadding = new Uint8Array(
			[
				0xa0, 0xc9, 0x00, 0x03, // Padding, Type: 201, Count: 0, Length: 3
				0x5d, 0x93, 0x15, 0x34, // Sender SSRC: 0x5d931534
				0x00, 0x00, 0x00, 0x00, // Padding (8 bytes)
				0x00, 0x00, 0x00, 0x08
			]
		).buffer;

		const packet = new ReceiverReportPacket();

		expect(packet).toBeDefined();
		expect(isRtcp(packet.getBuffer())).toBe(true);
		expect(packet.getPadding()).toBe(0);

		packet.setPadding(padding);
		packet.setSsrc(0x5d931534);

		packet.serialize();

		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(padding);
		expect(packet.getPacketType()).toBe(RtcpPacketType.RR);
		expect(packet.getCount()).toBe(0);
		expect(packet.getLength()).toBe(3);
		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), bufferWithPadding)).toBe(true);
	});

	test('packet.clone() succeeds', () =>
	{
		const bufferWithPadding = new Uint8Array(
			[
				0xa0, 0xc9, 0x00, 0x03, // Padding, Type: 201, Count: 0, Length: 3
				0x5d, 0x93, 0x15, 0x34, // Sender SSRC: 0x5d931534
				0x00, 0x00, 0x00, 0x00, // Padding (8 bytes)
				0x00, 0x00, 0x00, 0x08
			]
		).buffer;

		const packet = new ReceiverReportPacket(bufferWithPadding);
		const clonedPacket = packet.clone();

		expect(clonedPacket.getPadding()).toBe(packet.getPadding());
		expect(clonedPacket.getVersion()).toBe(packet.getVersion());
		expect(clonedPacket.getPadding()).toBe(packet.getPadding());
		expect(clonedPacket.getPacketType()).toBe(packet.getPacketType());
		expect(clonedPacket.getCount()).toBe(packet.getCount());
		expect(packet.getLength()).toBe(3);
		expect(clonedPacket.getSsrc()).toBe(packet.getSsrc());
		expect(clonedPacket.getReports()).toEqual(packet.getReports());
		expect(clonedPacket.dump()).toEqual(packet.dump());
		// Compare buffers.
		expect(areBuffersEqual(clonedPacket.getBuffer(), packet.getBuffer())).toBe(true);
	});
});

describe('create RTCP Receiver Report', () =>
{
	test('creating a Receiver Report succeeds', () =>
	{
		const report = new ReceiverReport();

		expect(report).toBeDefined();

		report.setSsrc(report1data.ssrc);
		report.setFractionLost(report1data.fractionLost);
		report.setTotalLost(report1data.totalLost);
		report.setHighestSeqNumber(report1data.highestSeq);
		report.setJitter(report1data.jitter);
		report.setLastSRTimestamp(report1data.lsr);
		report.setDelaySinceLastSR(report1data.dlsr);

		checkReport(report, report1data);
	});

	test('report.clone() succeeds', () =>
	{
		const report = new ReceiverReport();

		expect(report).toBeDefined();

		report.setSsrc(report2data.ssrc);
		report.setFractionLost(report2data.fractionLost);
		report.setTotalLost(report2data.totalLost);
		report.setHighestSeqNumber(report2data.highestSeq);
		report.setJitter(report2data.jitter);
		report.setLastSRTimestamp(report2data.lsr);
		report.setDelaySinceLastSR(report2data.dlsr);

		const clonedReceivedReport = report.clone();

		expect(clonedReceivedReport.dump()).toEqual(report.dump());
		// Compare buffers.
		expect(areBuffersEqual(
			clonedReceivedReport.getBuffer(),
			report.getBuffer())
		).toBe(true);
	});
});

function checkReport(report: ReceiverReport, data: ReceiverReportDump)
{
	expect(report.getSsrc()).toBe(data.ssrc);
	expect(report.getFractionLost()).toBe(data.fractionLost);
	expect(report.getTotalLost()).toBe(data.totalLost);
	expect(report.getHighestSeqNumber()).toBe(data.highestSeq);
	expect(report.getJitter()).toBe(data.jitter);
	expect(report.getLastSRTimestamp()).toBe(data.lsr);
	expect(report.getDelaySinceLastSR()).toBe(data.dlsr);
}
