import {
	ReceiverReport,
	ReceiverReportPacket,
	RECEIVER_REPORT_LENGTH
} from '../../rtcp/receiverReport';
import { isRtcp } from '../../rtcp';
import { areBuffersEqual, numericArrayToArrayBuffer } from '../../utils';

const ssrc = 26422708;
const fractionLost = 80;
const totalLost = 216;
const highestSeqNumber = 342342;
const jitter = 0;
const lastSenderReport = 8234;
const delaySinceLastSenderReport = 5;

const buffer = new Uint8Array(
	[
		0x82, 0xc9, 0x00, 0x0D, // Type: 201 (Receiver Report), Count: 1, Length: 13
		0x5d, 0x93, 0x15, 0x34, // Sender SSRC: 0x5d931534
		// Receiver Report
		0x01, 0x93, 0x2d, 0xb4, // SSRC. 0x01932db4
		0x50, 0x00, 0x00, 0xd8, // Fraction lost: 0, Total lost: 1
		0x00, 0x05, 0x39, 0x46, // Extended highest sequence number: 0
		0x00, 0x00, 0x00, 0x00, // Jitter: 0
		0x00, 0x00, 0x20, 0x2a, // Last SR: 8234
		0x00, 0x00, 0x00, 0x05, // DLSR: 5
		// Receiver Report
		0x02, 0x93, 0x2d, 0xb4, // SSRC. 0x02932db4
		0x50, 0x00, 0x00, 0xd8, // Fraction lost: 0, Total lost: 1
		0x00, 0x05, 0x39, 0x46, // Extended highest sequence number: 0
		0x00, 0x00, 0x00, 0x00, // Jitter: 0
		0x00, 0x00, 0x20, 0x2a, // Last SR: 8234
		0x00, 0x00, 0x00, 0x05 // DLSR: 5
	]
).buffer;

describe('parse RTCP Receiver Report packet', () =>
{
	test('buffer is RTCP', () =>
	{
		expect(isRtcp(buffer)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		const packet = new ReceiverReportPacket(buffer);
		const report1 = packet.getReports()[0];
		const report2 = packet.getReports()[1];

		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getPacketType()).toBe(201);
		expect(packet.getCount()).toBe(2);
		expect(packet.getSsrc()).toBe(0x5d931534);
		expect(packet.getLength()).toBe(13);

		checkReport(report1);
		checkReport(report2, /* customSrrc */ 0x02932db4);
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
				0x50, 0x00, 0x00, 0xd8, // Fraction lost: 0, Total lost: 1
				0x00, 0x05, 0x39, 0x46, // Extended highest sequence number: 0
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
		expect(packet.getPacketType()).toBe(201);
		expect(packet.getCount()).toBe(1);
		expect(packet.getSsrc()).toBe(0x5d931534);
		// Compare buffers.
		expect(areBuffersEqual(packet.getBuffer(), bufferWithPadding)).toBe(true);

		checkReport(report);
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

		checkReport(report);
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

		packet.serialize();

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

		expect(packet.getPadding()).toBe(8);
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

		report.setSsrc(ssrc);
		report.setFractionLost(fractionLost);
		report.setTotalLost(totalLost);
		report.setHighestSeqNumber(highestSeqNumber);
		report.setJitter(jitter);
		report.setLastSRTimestamp(lastSenderReport);
		report.setDelaySinceLastSR(delaySinceLastSenderReport);

		checkReport(report);
	});

	test('report.clone() succeeds', () =>
	{
		const receiverReport = new ReceiverReport();

		expect(receiverReport).toBeDefined();

		receiverReport.setSsrc(ssrc);
		receiverReport.setFractionLost(fractionLost);
		receiverReport.setTotalLost(totalLost);
		receiverReport.setHighestSeqNumber(highestSeqNumber);
		receiverReport.setJitter(jitter);
		receiverReport.setLastSRTimestamp(lastSenderReport);
		receiverReport.setDelaySinceLastSR(delaySinceLastSenderReport);

		const clonedReceivedReport = receiverReport.clone();

		expect(clonedReceivedReport.dump()).toEqual(receiverReport.dump());
		// Compare buffers.
		expect(areBuffersEqual(
			clonedReceivedReport.getBuffer(),
			receiverReport.getBuffer())
		).toBe(true);
	});
});

function checkReport(report: ReceiverReport, customSsrc?: number)
{
	expect(report.getSsrc()).toBe(customSsrc ?? ssrc);
	expect(report.getFractionLost()).toBe(fractionLost);
	expect(report.getTotalLost()).toBe(totalLost);
	expect(report.getHighestSeqNumber()).toBe(highestSeqNumber);
	expect(report.getJitter()).toBe(jitter);
	expect(report.getLastSRTimestamp()).toBe(lastSenderReport);
	expect(report.getDelaySinceLastSR()).toBe(delaySinceLastSenderReport);
}
