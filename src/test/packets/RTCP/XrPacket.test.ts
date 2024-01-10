import { XrPacket, XrPacketDump } from '../../../packets/RTCP/XrPacket';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { ExtendedReportType } from '../../../packets/RTCP/ExtendedReports/ExtendedReport';
import {
	LrleExtendedReport,
	LrleExtendedReportDump,
} from '../../../packets/RTCP/ExtendedReports/LrleExtendedReport';
import {
	DlrrExtendedReport,
	DlrrExtendedReportDump,
} from '../../../packets/RTCP/ExtendedReports/DlrrExtendedReport';
import {
	parseExtendedReportChunk,
	createExtendedReportRunLengthChunk,
	createExtendedReportBitVectorChunk,
} from '../../../packets/RTCP/ExtendedReports/chunks';
import { areDataViewsEqual } from '../../../utils/helpers';

const runLengthZerosChunk = 0b0010101010101010;
const runLengthOnesChunk = 0b0110101010101010;
const bitVectorChunk = 0b1110101010101010;
const terminatingNullChunk = 0b0000000000000000;

const report1Dump: LrleExtendedReportDump = {
	byteLength: 20,
	reportType: ExtendedReportType.LRLE,
	thinning: 9,
	ssrc: 0x03932db4,
	beginSeq: 0x11,
	endSeq: 0x22,
	chunks: [runLengthZerosChunk, runLengthOnesChunk, bitVectorChunk],
};

const report2Dump: DlrrExtendedReportDump = {
	byteLength: 28,
	reportType: ExtendedReportType.DLRR,
	subReports: [
		{ ssrc: 0x11121314, lrr: 0x00110011, dlrr: 0x11001100 },
		{ ssrc: 0x21222324, lrr: 0x00220022, dlrr: 0x22002200 },
	],
};

const packetDump: XrPacketDump = {
	byteLength: 60,
	padding: 4,
	packetType: RtcpPacketType.XR,
	count: 0, // No count field in XR packets.
	ssrc: 0x5d931534,
	reports: [report1Dump, report2Dump],
};

describe('parse RTCP XR packet', () => {
	const array = new Uint8Array([
		0xa0,
		0xcf,
		0x00,
		0x0e, // Padding, Type: 207 (XR), Length: 14
		0x5d,
		0x93,
		0x15,
		0x34, // Sender SSRC: 0x5d931534
		// Extended Report LRLE
		0x01,
		0x09,
		0x00,
		0x04, // BT: 1 (LRLE), T: 9, Block Length: 4
		0x03,
		0x93,
		0x2d,
		0xb4, // SSRC of source: 0x03932db4
		0x00,
		0x11,
		0x00,
		0x22, // Begin Seq: 0x11, End Seq: 0x22
		0b00101010,
		0b10101010, // Run Lengh Chunk (zeros)
		0b01101010,
		0b10101010, // Run Lengh Chunk (ones)
		0b11101010,
		0b10101010, // Bit Vector Chunk
		0b00000000,
		0b00000000, // Terminating Null Chunk
		// Extended Report DLRR
		0x05,
		0x00,
		0x00,
		0x06, // BT: 5 (DLRR), Block Length: 6
		0x11,
		0x12,
		0x13,
		0x14, // SSRC 1
		0x00,
		0x11,
		0x00,
		0x11, // LRR 1
		0x11,
		0x00,
		0x11,
		0x00, // DLRR 1
		0x21,
		0x22,
		0x23,
		0x24, // SSRC 2
		0x00,
		0x22,
		0x00,
		0x22, // LRR 2
		0x22,
		0x00,
		0x22,
		0x00, // DLRR 2
		0x00,
		0x00,
		0x00,
		0x04, // Padding (4 bytes)
	]);

	const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

	test('buffer view is RTCP', () => {
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		const packet = new XrPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(60);
		expect(packet.getPacketType()).toBe(RtcpPacketType.XR);
		// No count field in XR packetd, so this must be 0.
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(4);
		expect(packet.getSsrc()).toBe(0x5d931534);
		expect(packet.getReports().length).toBe(2);
		expect(packet.dump()).toEqual(packetDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const report1 = packet.getReports()[0] as LrleExtendedReport;

		expect(report1.needsSerialization()).toBe(false);
		expect(report1.getByteLength()).toBe(20);
		expect(report1.getReportType()).toBe(ExtendedReportType.LRLE);
		expect(report1.getThinning()).toBe(9);
		expect(report1.getSsrc()).toBe(0x03932db4);
		expect(report1.getBeginSeq()).toBe(0x11);
		expect(report1.getEndSeq()).toBe(0x22);
		expect(report1.getChunks()).toEqual([
			runLengthZerosChunk,
			runLengthOnesChunk,
			bitVectorChunk,
		]);
		expect(report1.dump()).toEqual(report1Dump);

		const report2 = packet.getReports()[1] as DlrrExtendedReport;

		expect(report2.needsSerialization()).toBe(false);
		expect(report2.getByteLength()).toBe(28);
		expect(report2.getReportType()).toBe(ExtendedReportType.DLRR);
		expect(report2.getSubReports()).toEqual([
			{ ssrc: 0x11121314, lrr: 0x00110011, dlrr: 0x11001100 },
			{ ssrc: 0x21222324, lrr: 0x00220022, dlrr: 0x22002200 },
		]);
		expect(report2.dump()).toEqual(report2Dump);
	});
});

describe('create RTCP XR packet', () => {
	test('creating a XR packet succeeds', () => {
		const packet = new XrPacket();

		expect(isRtcp(packet.getView())).toBe(true);
		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 8 (fixed header).
		expect(packet.getByteLength()).toBe(8);
		expect(packet.getPacketType()).toBe(RtcpPacketType.XR);
		// No count in RTCP XR packet.
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getSsrc()).toBe(0);
		expect(packet.getReports()).toEqual([]);
		expect(packet.needsSerialization()).toBe(false);

		packet.setSsrc(0x5d931534);
		expect(packet.needsSerialization()).toBe(false);

		const report1 = new LrleExtendedReport();

		expect(report1.needsSerialization()).toBe(false);
		expect(report1.getByteLength()).toBe(12);
		expect(report1.getReportType()).toBe(ExtendedReportType.LRLE);
		expect(report1.getThinning()).toBe(0);
		expect(report1.getSsrc()).toBe(0);
		expect(report1.getBeginSeq()).toBe(0);
		expect(report1.getEndSeq()).toBe(0);
		expect(report1.getChunks()).toEqual([]);

		report1.setThinning(9);
		report1.setSsrc(0x03932db4);
		report1.setBeginSeq(0x11);
		report1.setEndSeq(0x22);
		report1.addChunk(runLengthZerosChunk);
		report1.addChunk(runLengthOnesChunk);
		report1.addChunk(bitVectorChunk);
		expect(report1.dump()).toEqual(report1Dump);
		expect(report1.needsSerialization()).toBe(true);

		packet.addReport(report1);

		const report2 = new DlrrExtendedReport();

		expect(report2.needsSerialization()).toBe(false);
		expect(report2.getByteLength()).toBe(4);
		expect(report2.getReportType()).toBe(ExtendedReportType.DLRR);
		expect(report2.getSubReports()).toEqual([]);

		report2.setSubReports(report2Dump.subReports);
		expect(report2.dump()).toEqual(report2Dump);
		expect(report2.needsSerialization()).toBe(true);

		packet.addReport(report2);

		// We cannot add padding to RTCP packets so fix the dump.
		expect(packet.dump()).toEqual({
			...packetDump,
			byteLength: 56,
			padding: 0,
		});

		packet.serialize();
		expect(packet.needsSerialization()).toBe(false);
		expect(report1.needsSerialization()).toBe(false);
		expect(report2.needsSerialization()).toBe(false);
		// We cannot add padding to RTCP packets so fix the dump.
		expect(packet.dump()).toEqual({
			...packetDump,
			byteLength: 56,
			padding: 0,
		});

		const clonedPacket = packet.clone();

		expect(clonedPacket.dump()).toEqual({
			...packetDump,
			byteLength: 56,
			padding: 0,
		});
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(
			true,
		);
	});
});

describe('chunks parsing and creation', () => {
	test('parseExtendedReportChunk()', () => {
		expect(parseExtendedReportChunk(runLengthZerosChunk)).toEqual({
			chunkType: 'run-length',
			runType: 'zeros',
			runLength: 0b10101010101010,
		});

		expect(parseExtendedReportChunk(runLengthOnesChunk)).toEqual({
			chunkType: 'run-length',
			runType: 'ones',
			runLength: 0b10101010101010,
		});

		expect(parseExtendedReportChunk(bitVectorChunk)).toEqual({
			chunkType: 'bit-vector',
			bitVector: 0b110101010101010,
		});

		expect(parseExtendedReportChunk(terminatingNullChunk)).toEqual({
			chunkType: 'terminating-null',
		});
	});

	test('createExtendedReportRunLengthChunk()', () => {
		expect(createExtendedReportRunLengthChunk('zeros', 0b10101010101010)).toBe(
			runLengthZerosChunk,
		);

		expect(createExtendedReportRunLengthChunk('ones', 0b10101010101010)).toBe(
			runLengthOnesChunk,
		);
	});

	test('createExtendedReportBitVectorChunk()', () => {
		expect(createExtendedReportBitVectorChunk(0b110101010101010)).toBe(
			bitVectorChunk,
		);
	});
});
