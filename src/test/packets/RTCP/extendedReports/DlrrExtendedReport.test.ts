import { DlrrExtendedReport } from '../../../../packets/RTCP/extendedReports/DlrrExtendedReport.js';
import { ExtendedReportBlockType } from '../../../../packets/RTCP/ExtendedReport.js';
import { areBuffersEqual } from '../../../../utils/buffers.js';
import {
	checkRtcpExtendedReport,
	type ExpectedRtcpExtendedReport,
} from '../rtcpCommon.js';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../../testHelpers.js';

beforeEach(resetBuffers);

describe('RTCP XR DLRR Extended Report', () => {
	test('DlrrExtendedReport.parse() succeeds', () => {
		function checkFields(extendedReport: DlrrExtendedReport): void {
			expect(extendedReport.getNumberOfSubBlocks()).toBe(2);
			expect(extendedReport.getSubBlocks()).toEqual([
				{
					ssrc: 0x11121314,
					lastReceiverReport: 0x00110011,
					delaySinceLastReceiverReport: 0x11001100,
				},
				{
					ssrc: 0x21222324,
					lastReceiverReport: 0x00220022,
					delaySinceLastReceiverReport: 0x22002200,
				},
			]);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// BT: 5 (DLRR), Reserved: 0, Block length: 6
			0x05, 0x00, 0x00, 0x06,
			// SSRC 1: 0x11121314
			0x11, 0x12, 0x13, 0x14,
			// LRR 1: 0x00110011
			0x00, 0x11, 0x00, 0x11,
			// DLRR 1: 0x11001100
			0x11, 0x00, 0x11, 0x00,
			// SSRC 2: 0x21222324
			0x21, 0x22, 0x23, 0x24,
			// LRR 2: 0x00220022
			0x00, 0x22, 0x00, 0x22,
			// DLRR 2: 0x22002200
			0x22, 0x00, 0x22, 0x00,
		]);
		const extendedReport = DlrrExtendedReport.parse(buffer);
		const expected: ExpectedRtcpExtendedReport = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 28,
			blockType: ExtendedReportBlockType.DLRR,
		};

		checkRtcpExtendedReport(extendedReport, expected);

		checkFields(extendedReport);

		// No space to add more sub-blocks.
		expect(() =>
			extendedReport.addSubBlock({
				ssrc: 1,
				lastReceiverReport: 2,
				delaySinceLastReceiverReport: 3,
			})
		).toThrow(TypeError);

		checkFields(extendedReport);

		/* Serialize it. */

		extendedReport.serialize(serializeBuffer);

		buffer.fill(0xff);

		checkRtcpExtendedReport(extendedReport, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		checkFields(extendedReport);

		/* Clone it. */

		const clonedExtendedReport = extendedReport.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpExtendedReport(clonedExtendedReport, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		checkFields(clonedExtendedReport);
	});

	test('DlrrExtendedReport.parse() with one sub-block succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// BT: 5 (DLRR), Reserved: 0, Block length: 3
			0x05, 0x00, 0x00, 0x03,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// LRR: 0x23344556
			0x23, 0x34, 0x45, 0x56,
			// DLRR: 0x33343536
			0x33, 0x34, 0x35, 0x36,
		]);
		const extendedReport = DlrrExtendedReport.parse(buffer);

		checkRtcpExtendedReport(extendedReport, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 16,
			blockType: ExtendedReportBlockType.DLRR,
		});

		expect(extendedReport.getNumberOfSubBlocks()).toBe(1);
		expect(extendedReport.getSubBlocks()).toEqual([
			{
				ssrc: 0x12345678,
				lastReceiverReport: 0x23344556,
				delaySinceLastReceiverReport: 0x33343536,
			},
		]);
	});

	test('DlrrExtendedReport.parse() without sub-blocks succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// BT: 5 (DLRR), Reserved: 0, Block length: 0
			0x05, 0x00, 0x00, 0x00,
		]);
		const extendedReport = DlrrExtendedReport.parse(buffer);

		checkRtcpExtendedReport(extendedReport, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 4,
			blockType: ExtendedReportBlockType.DLRR,
		});

		expect(extendedReport.getNumberOfSubBlocks()).toBe(0);
		expect(extendedReport.getSubBlocks()).toEqual([]);
	});

	test('DlrrExtendedReport.parse() fails', () => {
		// Parse succeeds only when the block length (in 32-bit words, excluding
		// the header) is multiple of 3.
		const buffer1 = new Uint8Array(256);

		buffer1[0] = 0x05;

		buffer1[3] = 3;

		expect(() => DlrrExtendedReport.parse(buffer1)).not.toThrow();

		buffer1[3] = 4;

		expect(() => DlrrExtendedReport.parse(buffer1)).toThrow(TypeError);

		buffer1[3] = 5;

		expect(() => DlrrExtendedReport.parse(buffer1)).toThrow(TypeError);

		// Wrong block type (RRT).
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// BT: 4 (RRT), Reserved: 0, Block length: 3
			0x04, 0x00, 0x00, 0x03,
			0x12, 0x34, 0x56, 0x78,
			0x23, 0x34, 0x45, 0x56,
			0x33, 0x34, 0x35, 0x36,
		]);

		expect(() => DlrrExtendedReport.parse(buffer2)).toThrow(TypeError);

		// Block length field announces more bytes than the buffer has.
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// BT: 5 (DLRR), Reserved: 0, Block length: 3
			0x05, 0x00, 0x00, 0x03,
			0x12, 0x34, 0x56, 0x78,
			0x23, 0x34, 0x45, 0x56,
		]);

		expect(() => DlrrExtendedReport.parse(buffer3)).toThrow(TypeError);
	});

	test('DlrrExtendedReport.factory() succeeds', () => {
		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			// BT: 5 (DLRR), Reserved: 0, Block length: 3
			0x05, 0x00, 0x00, 0x03,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// LRR: 0x23344556
			0x23, 0x34, 0x45, 0x56,
			// DLRR: 0x33343536
			0x33, 0x34, 0x35, 0x36,
		]);

		const extendedReport = DlrrExtendedReport.factory(factoryBuffer);

		checkRtcpExtendedReport(extendedReport, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 4,
			blockType: ExtendedReportBlockType.DLRR,
		});

		expect(extendedReport.getNumberOfSubBlocks()).toBe(0);
		expect(extendedReport.getSubBlocks()).toEqual([]);

		/* Modify it. */

		extendedReport.addSubBlock({
			ssrc: 0x12345678,
			lastReceiverReport: 0x23344556,
			delaySinceLastReceiverReport: 0x33343536,
		});

		checkRtcpExtendedReport(extendedReport, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 16,
			blockType: ExtendedReportBlockType.DLRR,
		});

		expect(areBuffersEqual(extendedReport.getBuffer(), expectedBuffer)).toBe(
			true
		);
		expect(extendedReport.getNumberOfSubBlocks()).toBe(1);
		expect(extendedReport.getSubBlocks()).toEqual([
			{
				ssrc: 0x12345678,
				lastReceiverReport: 0x23344556,
				delaySinceLastReceiverReport: 0x33343536,
			},
		]);
	});

	test('DlrrExtendedReport with many sub-blocks', () => {
		const numberOfSubBlocks = 50;
		const extendedReport = DlrrExtendedReport.factory(factoryBuffer);

		for (let idx = 1; idx <= numberOfSubBlocks; ++idx) {
			extendedReport.addSubBlock({
				ssrc: 0x12345678 + idx,
				lastReceiverReport: 0x23344556 + idx,
				delaySinceLastReceiverReport: 0x33343536 + idx,
			});
		}

		checkRtcpExtendedReport(extendedReport, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 4 + numberOfSubBlocks * 12,
			blockType: ExtendedReportBlockType.DLRR,
		});

		/* Parse it. */

		const parsedExtendedReport = DlrrExtendedReport.parse(
			extendedReport.getBuffer()
		);

		expect(parsedExtendedReport.getLength()).toBe(4 + numberOfSubBlocks * 12);
		expect(parsedExtendedReport.getNumberOfSubBlocks()).toBe(numberOfSubBlocks);

		const subBlocks = parsedExtendedReport.getSubBlocks();

		expect(subBlocks.length).toBe(numberOfSubBlocks);
		expect(subBlocks[0]!.ssrc).toBe(0x12345679);
		expect(subBlocks[49]).toEqual({
			ssrc: 0x123456aa,
			lastReceiverReport: 0x23344588,
			delaySinceLastReceiverReport: 0x33343568,
		});
	});

	test('DlrrExtendedReport.factory() throws if the buffer is too small', () => {
		expect(() =>
			DlrrExtendedReport.factory(factoryBuffer.subarray(0, 3))
		).toThrow(TypeError);
	});

	test('DlrrExtendedReport.computeLengthFor() succeeds', () => {
		expect(DlrrExtendedReport.computeLengthFor(0)).toBe(4);

		const extendedReport = DlrrExtendedReport.factory(factoryBuffer);

		extendedReport.addSubBlock({
			ssrc: 1,
			lastReceiverReport: 1001,
			delaySinceLastReceiverReport: 2001,
		});
		extendedReport.addSubBlock({
			ssrc: 2,
			lastReceiverReport: 1002,
			delaySinceLastReceiverReport: 2002,
		});

		expect(DlrrExtendedReport.computeLengthFor(2)).toBe(28);
		expect(extendedReport.getLength()).toBe(
			DlrrExtendedReport.computeLengthFor(2)
		);
	});
});
