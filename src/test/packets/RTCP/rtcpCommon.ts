import {
	type RtcpPacket,
	type RtcpPacketType,
	isRtcp,
} from '../../../packets/RTCP/RtcpPacket.js';
import type {
	ExtendedReport,
	ExtendedReportBlockType,
} from '../../../packets/RTCP/ExtendedReport.js';
import type { CompoundPacket } from '../../../packets/RTCP/CompoundPacket.js';
import { areBuffersEqual } from '../../../utils/buffers.js';
import { throwBuffer } from '../../testHelpers.js';

export type ExpectedRtcpCompoundPacket = {
	buffer: Uint8Array;
	bufferLength: number;
	length: number;
	packetsCount: number;
};

export type ExpectedRtcpExtendedReport = {
	buffer: Uint8Array;
	bufferLength: number;
	length: number;
	blockType: ExtendedReportBlockType;
};

export type ExpectedRtcpPacket = {
	buffer: Uint8Array;
	bufferLength: number;
	length: number;
	packetType: RtcpPacketType;
	hasPadding: boolean;
	padding: number;
};

export function checkRtcpCompoundPacket(
	compoundPacket: CompoundPacket,
	expected: ExpectedRtcpCompoundPacket
): void {
	const compoundPacketBuffer = compoundPacket.getBuffer();
	const originalBuffer = expected.buffer.slice(0, expected.bufferLength);

	expect(isRtcp(compoundPacketBuffer, expected.length)).toBe(true);
	expect(compoundPacketBuffer.buffer).toBe(expected.buffer.buffer);
	expect(compoundPacketBuffer.byteOffset).toBe(expected.buffer.byteOffset);
	expect(compoundPacket.getBufferLength()).not.toBe(0);
	expect(compoundPacket.getBufferLength()).toBe(expected.bufferLength);
	expect(compoundPacket.getLength()).not.toBe(0);
	expect(compoundPacket.getLength()).toBe(expected.length);
	expect(compoundPacket.getAvailableBufferLength()).toBe(
		compoundPacket.getBufferLength() - compoundPacket.getLength()
	);
	expect(compoundPacket.getLength() % 4).toBe(0);
	expect(compoundPacket.getPackets().length).toBe(expected.packetsCount);
	expect(() =>
		compoundPacket.serialize(throwBuffer.subarray(0, expected.length - 1))
	).toThrow(TypeError);
	expect(() =>
		compoundPacket.clone(throwBuffer.subarray(0, expected.length - 1))
	).toThrow(TypeError);
	expect(
		areBuffersEqual(
			expected.buffer.subarray(0, expected.bufferLength),
			originalBuffer
		)
	).toBe(true);
}

export function checkRtcpPacket(
	packet: RtcpPacket,
	expected: ExpectedRtcpPacket
): void {
	const packetBuffer = packet.getBuffer();
	const view = new DataView(
		packetBuffer.buffer,
		packetBuffer.byteOffset,
		packetBuffer.byteLength
	);
	const firstByte = view.getUint8(0);
	const hasPadding = (firstByte & 0b00100000) !== 0;

	expect(isRtcp(packetBuffer, expected.length)).toBe(true);

	const originalBuffer = expected.buffer.slice(0, expected.bufferLength);

	expect(packetBuffer.buffer).toBe(expected.buffer.buffer);
	expect(packetBuffer.byteOffset).toBe(expected.buffer.byteOffset);
	expect(packet.getBufferLength()).not.toBe(0);
	expect(packet.getBufferLength()).toBe(expected.bufferLength);
	expect(packet.getLength()).not.toBe(0);
	expect(packet.getLength()).toBe(expected.length);
	expect((view.getUint16(2) + 1) * 4).toBe(expected.length);
	expect(packet.getAvailableBufferLength()).toBe(
		packet.getBufferLength() - packet.getLength()
	);
	expect(packet.getLength() % 4).toBe(0);
	expect(firstByte >> 6).toBe(2);
	expect(packet.getPacketType()).toBe(expected.packetType);
	expect(hasPadding).toBe(expected.hasPadding);
	expect(packet.getPadding()).toBe(expected.padding);

	if (!hasPadding) {
		expect(packet.getPadding()).toBe(0);
	}

	expect(() =>
		packet.serialize(throwBuffer.subarray(0, expected.length - 1))
	).toThrow(TypeError);
	expect(() =>
		packet.clone(throwBuffer.subarray(0, expected.length - 1))
	).toThrow(TypeError);
	expect(
		areBuffersEqual(
			expected.buffer.subarray(0, expected.bufferLength),
			originalBuffer
		)
	).toBe(true);
}

export function checkRtcpExtendedReport(
	extendedReport: ExtendedReport,
	expected: ExpectedRtcpExtendedReport
): void {
	const extendedReportBuffer = extendedReport.getBuffer();
	const view = new DataView(
		extendedReportBuffer.buffer,
		extendedReportBuffer.byteOffset,
		extendedReportBuffer.byteLength
	);
	const originalBuffer = expected.buffer.slice(0, expected.bufferLength);

	expect(extendedReportBuffer.buffer).toBe(expected.buffer.buffer);
	expect(extendedReportBuffer.byteOffset).toBe(expected.buffer.byteOffset);
	expect(extendedReport.getBufferLength()).not.toBe(0);
	expect(extendedReport.getBufferLength()).toBe(expected.bufferLength);
	expect(extendedReport.getLength()).not.toBe(0);
	expect(extendedReport.getLength()).toBe(expected.length);
	expect((view.getUint16(2) + 1) * 4).toBe(expected.length);
	expect(extendedReport.getAvailableBufferLength()).toBe(
		extendedReport.getBufferLength() - extendedReport.getLength()
	);
	expect(extendedReport.getLength() % 4).toBe(0);
	expect(extendedReport.getBlockType()).toBe(expected.blockType);
	expect(() =>
		extendedReport.serialize(throwBuffer.subarray(0, expected.length - 1))
	).toThrow(TypeError);
	expect(() =>
		extendedReport.clone(throwBuffer.subarray(0, expected.length - 1))
	).toThrow(TypeError);
	expect(
		areBuffersEqual(
			expected.buffer.subarray(0, expected.bufferLength),
			originalBuffer
		)
	).toBe(true);
}
