import { RrtExtendedReport } from '../../../../packets/RTCP/extendedReports/RrtExtendedReport.js';
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

describe('RTCP XR Receiver Reference Time Extended Report', () => {
	test('RrtExtendedReport.parse() succeeds', () => {
		function checkFields(extendedReport: RrtExtendedReport): void {
			expect(extendedReport.getNtp()).toEqual({
				seconds: 0x12345678,
				fractions: 0x23456789,
			});
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// BT: 4 (RRT), Reserved: 0, Block length: 2
			0x04, 0x00, 0x00, 0x02,
			// NTP timestamp, most significant word: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// NTP timestamp, least significant word: 0x23456789
			0x23, 0x45, 0x67, 0x89,
		]);
		const extendedReport = RrtExtendedReport.parse(buffer);
		const expected: ExpectedRtcpExtendedReport = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 12,
			blockType: ExtendedReportBlockType.RRT,
		};

		checkRtcpExtendedReport(extendedReport, expected);

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

	test('RrtExtendedReport.parse() fails', () => {
		// Block length field is not 2.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// BT: 4 (RRT), Reserved: 0, Block length: 3
			0x04, 0x00, 0x00, 0x03,
			0x12, 0x34, 0x56, 0x78,
			0x23, 0x45, 0x67, 0x89,
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => RrtExtendedReport.parse(buffer1)).toThrow(TypeError);

		// Block length field is not 2.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// BT: 4 (RRT), Reserved: 0, Block length: 1
			0x04, 0x00, 0x00, 0x01,
			0x12, 0x34, 0x56, 0x78,
		]);

		expect(() => RrtExtendedReport.parse(buffer2)).toThrow(TypeError);

		// Wrong block type (DLRR).
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// BT: 5 (DLRR), Reserved: 0, Block length: 2
			0x05, 0x00, 0x00, 0x02,
			0x12, 0x34, 0x56, 0x78,
			0x23, 0x45, 0x67, 0x89,
		]);

		expect(() => RrtExtendedReport.parse(buffer3)).toThrow(TypeError);

		// Block length field announces more bytes than the buffer has.
		// prettier-ignore
		const buffer4 = new Uint8Array([
			// BT: 4 (RRT), Reserved: 0, Block length: 2
			0x04, 0x00, 0x00, 0x02,
			0x12, 0x34, 0x56, 0x78,
		]);

		expect(() => RrtExtendedReport.parse(buffer4)).toThrow(TypeError);
	});

	test('RrtExtendedReport.factory() succeeds', () => {
		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			// BT: 4 (RRT), Reserved: 0, Block length: 2
			0x04, 0x00, 0x00, 0x02,
			// NTP timestamp, most significant word: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// NTP timestamp, least significant word: 0x23456789
			0x23, 0x45, 0x67, 0x89,
		]);

		// Dirty the buffer to check that factory() writes zeros in the block.
		factoryBuffer.fill(0xff);

		const extendedReport = RrtExtendedReport.factory(factoryBuffer);

		checkRtcpExtendedReport(extendedReport, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 12,
			blockType: ExtendedReportBlockType.RRT,
		});

		expect(extendedReport.getNtp()).toEqual({ seconds: 0, fractions: 0 });

		/* Modify it. */

		extendedReport.setNtp({ seconds: 0x12345678, fractions: 0x23456789 });

		expect(extendedReport.getNtp()).toEqual({
			seconds: 0x12345678,
			fractions: 0x23456789,
		});
		expect(areBuffersEqual(extendedReport.getBuffer(), expectedBuffer)).toBe(
			true
		);
	});

	test('RrtExtendedReport.factory() throws if the buffer is too small', () => {
		expect(() =>
			RrtExtendedReport.factory(factoryBuffer.subarray(0, 11))
		).toThrow(TypeError);
	});
});
