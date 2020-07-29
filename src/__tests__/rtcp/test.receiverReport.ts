import { ReceiverReport, ReceiverReportPacket } from '../../rtcp/receiverReport';
import { isRtcp } from '../../rtcp/packet';

const ssrc = 26422708;
const fractionLost = 80;
const totalLost = 216;
const highestSeqNumber = 342342;
const jitter = 0;
const lastSenderReport = 8234;
const delaySinceLastSenderReport = 5;

const buffer = Buffer.from(
	[
		0x81, 0xc9, 0x00, 0x07, // Type: 201 (Receiver Report), Count: 1, Length: 7
		0x5d, 0x93, 0x15, 0x34, // Sender SSRC: 0x5d931534
		// Receiver Report
		0x01, 0x93, 0x2d, 0xb4, // SSRC. 0x01932db4
		0x50, 0x00, 0x00, 0xd8, // Fraction lost: 0, Total lost: 1
		0x00, 0x05, 0x39, 0x46, // Extended highest sequence number: 0
		0x00, 0x00, 0x00, 0x00, // Jitter: 0
		0x00, 0x00, 0x20, 0x2a, // Last SR: 0
		0x00, 0x00, 0x00, 0x05  // DLSR: 0
	]
);

describe('parse RTCP Receiver Report packet', () =>
{
	test('packet processing succeeds', () =>
	{
		const packet = new ReceiverReportPacket(buffer);
		const report = packet.getReports()[0];

		expect(packet.getVersion()).toBe(2);
		expect(packet.getPadding()).toBe(false);
		expect(packet.getPacketType()).toBe(201);
		expect(packet.getCount()).toBe(1);
		expect(packet.getSsrc()).toBe(0x5d931534);

		checkReport(report);
	});

	test('parsing a buffer which length does not fit the indicated count throws', () =>
	{
		// Parse the first 8 bytes of buffer, indicating 1 Receiver Report and
		// holding no report at all.
		expect(() => (new ReceiverReportPacket(buffer.slice(undefined, 8)))).toThrowError(TypeError);
	});
});

describe('parse RTCP Receiver Report', () =>
{
	test('report processing succeeds', () =>
	{
		const report = new ReceiverReport(buffer.slice(8));

		expect(report).toBeDefined();

		checkReport(report);
	});

	test('parsing a buffer which length does not fit the report size throws', () =>
	{
		// Parse a 23 bytes buffer.
		expect(() => (new ReceiverReport(new Buffer(23)))).toThrowError(TypeError);
	});
});

describe('serialize RTCP Receiver Report packet', () =>
{
	test('serialized buffer equals original one', () =>
	{
		const packet = new ReceiverReportPacket(buffer);

		packet.getBuffer();

		expect(packet.getBuffer().compare(buffer)).toBe(0);
	});
});

describe('serialize RTCP Receiver Report', () =>
{
	test('serialized buffer equals original one', () =>
	{
		const packet = new ReceiverReport(buffer.slice(8));

		packet.getBuffer();

		expect(packet.getBuffer().compare(buffer.slice(8))).toBe(0);
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
});

function checkReport(report: ReceiverReport)
{
	expect(report.getSsrc()).toBe(ssrc);
	expect(report.getFractionLost()).toBe(fractionLost);
	expect(report.getTotalLost()).toBe(totalLost);
	expect(report.getHighestSeqNumber()).toBe(highestSeqNumber);
	expect(report.getJitter()).toBe(jitter);
	expect(report.getLastSRTimestamp()).toBe(lastSenderReport);
	expect(report.getDelaySinceLastSR()).toBe(delaySinceLastSenderReport);
}
