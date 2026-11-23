import { XrPacket } from '../../../packets/RTCP/XrPacket';
import {
	ExtendedReportBlockType,
	type ExtendedReport,
} from '../../../packets/RTCP/ExtendedReport';
import { RrtExtendedReport } from '../../../packets/RTCP/extendedReports/RrtExtendedReport';
import { DlrrExtendedReport } from '../../../packets/RTCP/extendedReports/DlrrExtendedReport';
import { UnknownExtendedReport } from '../../../packets/RTCP/extendedReports/UnknownExtendedReport';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { areBuffersEqual } from '../../../utils/buffers';
import { checkRtcpPacket, type ExpectedRtcpPacket } from './rtcpCommon';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers';

beforeEach(resetBuffers);

/**
 * Whether the given Extended Report block lives at `offset` bytes from the
 * start of the given packet.
 */
function isAtOffset(
	extendedReport: ExtendedReport,
	packet: XrPacket,
	offset: number
): boolean {
	const extendedReportBuffer = extendedReport.getBuffer();
	const packetBuffer = packet.getBuffer();

	return (
		extendedReportBuffer.buffer === packetBuffer.buffer &&
		extendedReportBuffer.byteOffset === packetBuffer.byteOffset + offset
	);
}

describe('RTCP XR Packet', () => {
	test('XrPacket.parse() succeeds', () => {
		const checkFields = (packet: XrPacket): void => {
			const extendedReports = packet.getExtendedReports();

			expect(packet.getSsrc()).toBe(0x5d931534);
			expect(extendedReports.length).toBe(3);
			expect(extendedReports[3]).toBeUndefined();

			const extendedReport1 = extendedReports[0] as RrtExtendedReport;

			expect(packet.getFirstExtendedReportOfType(RrtExtendedReport)).toBe(
				extendedReport1
			);
			expect(isAtOffset(extendedReport1, packet, 8)).toBe(true);
			expect(extendedReport1.getLength()).toBe(12);
			expect(extendedReport1.getBlockType()).toBe(ExtendedReportBlockType.RRT);
			expect(extendedReport1.getNtp()).toEqual({
				seconds: 0xaabbccdd,
				fractions: 0x11223344,
			});

			const extendedReport2 = extendedReports[1] as DlrrExtendedReport;

			expect(packet.getFirstExtendedReportOfType(DlrrExtendedReport)).toBe(
				extendedReport2
			);
			expect(isAtOffset(extendedReport2, packet, 20)).toBe(true);
			expect(extendedReport2.getLength()).toBe(16);
			expect(extendedReport2.getBlockType()).toBe(ExtendedReportBlockType.DLRR);
			expect(extendedReport2.getSubBlocks()).toEqual([
				{
					ssrc: 0x11121314,
					lastReceiverReport: 0x00110011,
					delaySinceLastReceiverReport: 0x11001100,
				},
			]);

			const extendedReport3 = extendedReports[2] as UnknownExtendedReport;

			expect(packet.getFirstExtendedReportOfType(UnknownExtendedReport)).toBe(
				extendedReport3
			);
			expect(isAtOffset(extendedReport3, packet, 36)).toBe(true);
			expect(extendedReport3.getLength()).toBe(8);
			expect(extendedReport3.getBlockType()).toBe(42);
			expect(extendedReport3.getUnknownValue().byteLength).toBe(4);
			expect(extendedReport3.getUnknownValue()[0]).toBe(0x01);
			expect(extendedReport3.getUnknownValue()[3]).toBe(0x04);
		};

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, Reserved=0, PT:207, Length: 10
			0b10000000, 0xcf, 0x00, 0x0a,
			// SSRC: 0x5d931534
			0x5d, 0x93, 0x15, 0x34,
			// Extended Report block 1
			// BT: 4 (RRT), Type-specific: 0, Block length: 2
			0x04, 0x00, 0x00, 0x02,
			// NTP timestamp
			0xaa, 0xbb, 0xcc, 0xdd,
			0x11, 0x22, 0x33, 0x44,
			// Extended Report block 2
			// BT: 5 (DLRR), Type-specific: 0, Block length: 3
			0x05, 0x00, 0x00, 0x03,
			// SSRC: 0x11121314
			0x11, 0x12, 0x13, 0x14,
			// LRR: 0x00110011
			0x00, 0x11, 0x00, 0x11,
			// DLRR: 0x11001100
			0x11, 0x00, 0x11, 0x00,
			// Extended Report block 3
			// BT: 42, Type-specific: 0, Block length: 1
			0x2a, 0x00, 0x00, 0x01,
			// 4 bytes of value
			0x01, 0x02, 0x03, 0x04,
		]);
		const packet = XrPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 44,
			packetType: RtcpPacketType.XR,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		checkFields(packet);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xff);

		checkRtcpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		checkFields(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		checkFields(clonedPacket);
	});

	test('XrPacket.parse() without Extended Report blocks succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, Reserved=0, PT:207, Length: 1
			0b10000000, 0xcf, 0x00, 0x01,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
		]);
		const packet = XrPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 8,
			packetType: RtcpPacketType.XR,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getSsrc()).toBe(0x12345678);
		expect(packet.getExtendedReports()).toEqual([]);
		expect(
			packet.getFirstExtendedReportOfType(UnknownExtendedReport)
		).toBeUndefined();
	});

	test('XrPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const extendedReportBuffer = new Uint8Array([
			// BT: 99, Type-specific: 0, Block length: 0
			0x63, 0x00, 0x00, 0x00,
		]);

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, Reserved=0, PT:207, Length: 4
			0b10100000, 0xcf, 0x00, 0x04,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// Extended Report block 1
			// BT: 42, Type-specific: 0, Block length: 1
			0x2a, 0x00, 0x00, 0x01,
			// 4 bytes of value
			0x01, 0x02, 0x03, 0x04,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
			// Extra space in the buffer
			0x00, 0x00, 0x00, 0x00,
		]);
		const packet = XrPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 20,
			packetType: RtcpPacketType.XR,
			hasPadding: true,
			padding: 4,
		});

		expect(packet.getSsrc()).toBe(0x12345678);
		expect(packet.getExtendedReports().length).toBe(1);

		/* Modify it (it removes the padding). */

		const extendedReport = UnknownExtendedReport.parse(extendedReportBuffer);

		packet.addExtendedReport(extendedReport);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 20,
			packetType: RtcpPacketType.XR,
			hasPadding: false,
			padding: 0,
		});

		const extendedReports = packet.getExtendedReports();

		expect(extendedReports.length).toBe(2);

		const extendedReport2 = extendedReports[1]!;

		// The new Extended Report block goes where the padding was.
		expect(isAtOffset(extendedReport2, packet, 16)).toBe(true);
		expect(extendedReport2.getLength()).toBe(4);
		expect(extendedReport2.getBlockType()).toBe(99);
	});

	test('XrPacket.parse() with padding and a DLRR block succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, Reserved=0, PT:207, Length: 9
			0xa0, 0xcf, 0x00, 0x09,
			// SSRC: 0x5d931534
			0x5d, 0x93, 0x15, 0x34,
			// Extended Report block 1
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
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
		]);
		const packet = XrPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 40,
			packetType: RtcpPacketType.XR,
			hasPadding: true,
			padding: 4,
		});

		expect(packet.getSsrc()).toBe(0x5d931534);
		expect(packet.getExtendedReports().length).toBe(1);

		const extendedReport = packet.getExtendedReports()[0] as DlrrExtendedReport;

		expect(extendedReport.getBlockType()).toBe(ExtendedReportBlockType.DLRR);
		expect(extendedReport.getLength()).toBe(28);
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
	});

	test('XrPacket.parse() fails', () => {
		// No space for the SSRC.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, Reserved=0, PT:207, Length: 0
			0b10000000, 0xcf, 0x00, 0x00,
		]);

		expect(() => XrPacket.parse(buffer1)).toThrow(TypeError);

		// Extended Report block length field exceeds the packet length.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, Reserved=0, PT:207, Length: 3
			0b10000000, 0xcf, 0x00, 0x03,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// BT: 42, Type-specific: 0, Block length: 2
			0x2a, 0x00, 0x00, 0x02,
			// 4 bytes of value
			0x01, 0x02, 0x03, 0x04,
		]);

		expect(() => XrPacket.parse(buffer2)).toThrow(TypeError);

		// Bytes left after the last Extended Report block that don't form a
		// block (2 bytes followed by 2 bytes of padding).
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=1, Reserved=0, PT:207, Length: 3
			0b10100000, 0xcf, 0x00, 0x03,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// BT: 42, Type-specific: 0, Block length: 0
			0x2a, 0x00, 0x00, 0x00,
			// 2 extra bytes, Padding: 2 bytes
			0x11, 0x22, 0x00, 0x02,
		]);

		expect(() => XrPacket.parse(buffer3)).toThrow(TypeError);

		// Extended Report block overlapping the padding.
		// prettier-ignore
		const buffer4 = new Uint8Array([
			// V=2, P=1, Reserved=0, PT:207, Length: 3
			0b10100000, 0xcf, 0x00, 0x03,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// BT: 42, Type-specific: 0, Block length: 1
			0x2a, 0x00, 0x00, 0x01,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
		]);

		expect(() => XrPacket.parse(buffer4)).toThrow(TypeError);

		// Malformed RRT block (block length is not 2).
		// prettier-ignore
		const buffer5 = new Uint8Array([
			// V=2, P=0, Reserved=0, PT:207, Length: 3
			0b10000000, 0xcf, 0x00, 0x03,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// BT: 4 (RRT), Reserved: 0, Block length: 1
			0x04, 0x00, 0x00, 0x01,
			0x11, 0x22, 0x33, 0x44,
		]);

		expect(() => XrPacket.parse(buffer5)).toThrow(TypeError);

		// Malformed DLRR block (sub-blocks length is not multiple of 12).
		// prettier-ignore
		const buffer6 = new Uint8Array([
			// V=2, P=0, Reserved=0, PT:207, Length: 3
			0b10000000, 0xcf, 0x00, 0x03,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// BT: 5 (DLRR), Reserved: 0, Block length: 1
			0x05, 0x00, 0x00, 0x01,
			0x11, 0x22, 0x33, 0x44,
		]);

		expect(() => XrPacket.parse(buffer6)).toThrow(TypeError);

		// Wrong packet type (RR).
		// prettier-ignore
		const buffer7 = new Uint8Array([
			// V=2, P=0, RC=0, PT:201, Length: 1
			0b10000000, 0xc9, 0x00, 0x01,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
		]);

		expect(() => XrPacket.parse(buffer7)).toThrow(TypeError);
	});

	test('XrPacket.factory() succeeds', () => {
		// prettier-ignore
		const extendedReportBuffer1 = new Uint8Array([
			// BT: 42, Type-specific: 0xab, Block length: 2
			0x2a, 0xab, 0x00, 0x02,
			// 8 bytes of value
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
		]);

		// prettier-ignore
		const extendedReportBuffer2 = new Uint8Array([
			// BT: 99, Type-specific: 0, Block length: 0
			0x63, 0x00, 0x00, 0x00,
		]);

		const checkFields = (packet: XrPacket): void => {
			const extendedReports = packet.getExtendedReports();

			expect(packet.getSsrc()).toBe(1234);
			expect(extendedReports.length).toBe(2);

			const extendedReport1 = extendedReports[0] as UnknownExtendedReport;

			expect(isAtOffset(extendedReport1, packet, 8)).toBe(true);
			expect(extendedReport1.getLength()).toBe(12);
			expect(extendedReport1.getBlockType()).toBe(42);
			expect(extendedReport1.getUnknownValue().byteLength).toBe(8);
			expect(extendedReport1.getUnknownValue()[0]).toBe(0x11);
			expect(extendedReport1.getUnknownValue()[7]).toBe(0x88);

			const extendedReport2 = extendedReports[1] as UnknownExtendedReport;

			expect(isAtOffset(extendedReport2, packet, 20)).toBe(true);
			expect(extendedReport2.getLength()).toBe(4);
			expect(extendedReport2.getBlockType()).toBe(99);
			expect(extendedReport2.getUnknownValue().byteLength).toBe(0);
		};

		const packet = XrPacket.factory(factoryBuffer);
		const expected: ExpectedRtcpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 8,
			packetType: RtcpPacketType.XR,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getSsrc()).toBe(0);
		expect(packet.getExtendedReports()).toEqual([]);

		/* Modify it. */

		packet.setSsrc(1234);

		const extendedReport1 = UnknownExtendedReport.parse(extendedReportBuffer1);
		const extendedReport2 = UnknownExtendedReport.parse(extendedReportBuffer2);

		packet.addExtendedReport(extendedReport1);
		packet.addExtendedReport(extendedReport2);

		checkRtcpPacket(packet, { ...expected, length: 24 });

		checkFields(packet);

		/* Parse it. */

		const parsedPacket = XrPacket.parse(packet.getBuffer());

		checkRtcpPacket(parsedPacket, {
			...expected,
			bufferLength: 24,
			length: 24,
		});

		checkFields(parsedPacket);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		checkRtcpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 24,
		});

		checkFields(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 24,
		});

		checkFields(clonedPacket);
	});

	test('XrPacket.factory() without Extended Report blocks succeeds', () => {
		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			// V=2, P=0, Reserved=0, PT:207, Length: 1
			0x80, 0xcf, 0x00, 0x01,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
		]);

		const packet = XrPacket.factory(factoryBuffer);

		packet.setSsrc(0x12345678);

		checkRtcpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 8,
			packetType: RtcpPacketType.XR,
			hasPadding: false,
			padding: 0,
		});

		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);
	});

	test('XrPacket.buildExtendedReportInPlace() succeeds', () => {
		const numberOfSubBlocks = 50;

		const checkFields = (packet: XrPacket): void => {
			const extendedReports = packet.getExtendedReports();

			expect(packet.getSsrc()).toBe(0x12345678);
			expect(extendedReports.length).toBe(2);

			const rrtExtendedReport =
				packet.getFirstExtendedReportOfType(RrtExtendedReport)!;

			expect(rrtExtendedReport).toBeDefined();
			expect(rrtExtendedReport).toBe(extendedReports[0]);
			expect(isAtOffset(rrtExtendedReport, packet, 8)).toBe(true);
			expect(rrtExtendedReport.getNtp()).toEqual({
				seconds: 1111,
				fractions: 2222,
			});

			const dlrrExtendedReport =
				packet.getFirstExtendedReportOfType(DlrrExtendedReport)!;

			expect(dlrrExtendedReport).toBeDefined();
			expect(dlrrExtendedReport).toBe(extendedReports[1]);
			expect(isAtOffset(dlrrExtendedReport, packet, 20)).toBe(true);
			expect(dlrrExtendedReport.getLength()).toBe(4 + numberOfSubBlocks * 12);

			const subBlocks = dlrrExtendedReport.getSubBlocks();

			expect(subBlocks.length).toBe(numberOfSubBlocks);
			expect(subBlocks[0]).toEqual({
				ssrc: 1,
				lastReceiverReport: 1001,
				delaySinceLastReceiverReport: 2001,
			});
			expect(subBlocks[49]).toEqual({
				ssrc: 50,
				lastReceiverReport: 1050,
				delaySinceLastReceiverReport: 2050,
			});
		};

		const packet = XrPacket.factory(factoryBuffer);

		packet.setSsrc(0x12345678);

		// An Extended Report block built in place and discarded leaves the packet
		// as it was.
		const discardedExtendedReport =
			packet.buildExtendedReportInPlace(RrtExtendedReport);

		expect(packet.needsConsolidation()).toBe(true);

		discardedExtendedReport.discard();

		expect(packet.needsConsolidation()).toBe(false);
		expect(packet.getLength()).toBe(8);
		expect(packet.getExtendedReports()).toEqual([]);

		const rrtExtendedReport =
			packet.buildExtendedReportInPlace(RrtExtendedReport);

		rrtExtendedReport.setNtp({ seconds: 1111, fractions: 2222 });
		rrtExtendedReport.consolidate();

		const dlrrExtendedReport =
			packet.buildExtendedReportInPlace(DlrrExtendedReport);

		for (let idx = 1; idx <= numberOfSubBlocks; ++idx) {
			dlrrExtendedReport.addSubBlock({
				ssrc: idx,
				lastReceiverReport: 1000 + idx,
				delaySinceLastReceiverReport: 2000 + idx,
			});
		}

		dlrrExtendedReport.consolidate();

		checkRtcpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 8 + 12 + 4 + numberOfSubBlocks * 12,
			packetType: RtcpPacketType.XR,
			hasPadding: false,
			padding: 0,
		});

		checkFields(packet);

		/* Parse it. */

		const parsedPacket = XrPacket.parse(packet.getBuffer());

		expect(parsedPacket.getLength()).toBe(packet.getLength());

		checkFields(parsedPacket);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		checkFields(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkFields(clonedPacket);
	});

	test('XrPacket.addExtendedReport() throws if there is no space in the buffer', () => {
		// prettier-ignore
		const extendedReportBuffer = new Uint8Array([
			// BT: 42, Type-specific: 0, Block length: 1
			0x2a, 0x00, 0x00, 0x01,
			// 4 bytes of value
			0x01, 0x02, 0x03, 0x04,
		]);

		const packet = XrPacket.factory(factoryBuffer.subarray(0, 12));
		const extendedReport = UnknownExtendedReport.parse(extendedReportBuffer);

		expect(() => packet.addExtendedReport(extendedReport)).toThrow(TypeError);

		// The packet is left as it was.
		checkRtcpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: 12,
			length: 8,
			packetType: RtcpPacketType.XR,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getExtendedReports()).toEqual([]);
	});

	test('XrPacket.addExtendedReport() throws if the Extended Report block lives where it would be cloned', () => {
		const packet = XrPacket.factory(factoryBuffer);

		// The Extended Report block lives in the free space of the buffer of the
		// packet, right where it would be cloned.
		// BT: 99, Type-specific: 0, Block length: 0
		factoryBuffer.set([0x63, 0x00, 0x00, 0x00], 8);

		const extendedReport = UnknownExtendedReport.parse(
			factoryBuffer.subarray(8, 12)
		);
		const buffer = packet.getBuffer().slice();

		expect(() => packet.addExtendedReport(extendedReport)).toThrow(TypeError);

		// The packet is left as it was.
		checkRtcpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 8,
			packetType: RtcpPacketType.XR,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getExtendedReports()).toEqual([]);
		expect(areBuffersEqual(packet.getBuffer(), buffer)).toBe(true);
	});

	test('XrPacket.factory() throws if the buffer is too small', () => {
		expect(() => XrPacket.factory(factoryBuffer.subarray(0, 7))).toThrow(
			TypeError
		);
	});

	test('XrPacket.computeLengthFor() succeeds', () => {
		expect(XrPacket.computeLengthFor(0)).toBe(8);

		const packet = XrPacket.factory(factoryBuffer);
		const dlrrExtendedReport =
			packet.buildExtendedReportInPlace(DlrrExtendedReport);

		dlrrExtendedReport.addSubBlock({
			ssrc: 1,
			lastReceiverReport: 1001,
			delaySinceLastReceiverReport: 2001,
		});
		dlrrExtendedReport.addSubBlock({
			ssrc: 2,
			lastReceiverReport: 1002,
			delaySinceLastReceiverReport: 2002,
		});
		dlrrExtendedReport.consolidate();

		const length = XrPacket.computeLengthFor(
			DlrrExtendedReport.computeLengthFor(2)
		);

		expect(length).toBe(36);
		expect(packet.getLength()).toBe(length);
	});
});
