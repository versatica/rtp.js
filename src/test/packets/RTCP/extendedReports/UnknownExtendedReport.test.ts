import { UnknownExtendedReport } from '../../../../packets/RTCP/extendedReports/UnknownExtendedReport';
import type { ExtendedReportBlockType } from '../../../../packets/RTCP/ExtendedReport';
import {
	checkRtcpExtendedReport,
	type ExpectedRtcpExtendedReport,
} from '../rtcpCommon';
import {
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../../testHelpers';

beforeEach(resetBuffers);

describe('RTCP XR Unknown Extended Report', () => {
	test('UnknownExtendedReport.parse() succeeds', () => {
		function checkFields(extendedReport: UnknownExtendedReport): void {
			expect(extendedReport.getUnknownValue().byteLength).toBe(8);
			expect(extendedReport.getUnknownValue()[0]).toBe(0x11);
			expect(extendedReport.getUnknownValue()[1]).toBe(0x22);
			expect(extendedReport.getUnknownValue()[7]).toBe(0x88);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// BT: 42, Type-specific: 0xab, Block length: 2
			0x2a, 0xab, 0x00, 0x02,
			// 8 bytes of value
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
		]);
		const extendedReport = UnknownExtendedReport.parse(buffer);
		const expected: ExpectedRtcpExtendedReport = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 12,
			blockType: 42 as ExtendedReportBlockType,
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

	test('UnknownExtendedReport.parse() without value succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// BT: 99, Type-specific: 0, Block length: 0
			0x63, 0x00, 0x00, 0x00,
		]);
		const extendedReport = UnknownExtendedReport.parse(buffer);

		checkRtcpExtendedReport(extendedReport, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 4,
			blockType: 99 as ExtendedReportBlockType,
		});

		expect(extendedReport.getUnknownValue().byteLength).toBe(0);
	});

	test('UnknownExtendedReport.parse() fails', () => {
		// Less bytes than the Extended Report block header.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			0x2a, 0x00, 0x00,
		]);

		expect(() => UnknownExtendedReport.parse(buffer1)).toThrow(TypeError);

		// Block length field announces more bytes than the buffer has.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// BT: 42, Type-specific: 0, Block length: 2
			0x2a, 0x00, 0x00, 0x02,
			// 4 bytes of value
			0x11, 0x22, 0x33, 0x44,
		]);

		expect(() => UnknownExtendedReport.parse(buffer2)).toThrow(TypeError);
	});
});
