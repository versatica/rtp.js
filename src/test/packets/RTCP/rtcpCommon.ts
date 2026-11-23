import {
	type RtcpPacket,
	type RtcpPacketType,
	isRtcp,
} from '../../../packets/RTCP/RtcpPacket';
import { areBuffersEqual } from '../../../utils/buffers';
import { throwBuffer } from '../../testHelpers';

export type ExpectedPacket = {
	buffer: Uint8Array;
	bufferLength: number;
	length: number;
	packetType: RtcpPacketType;
	hasPadding: boolean;
	padding: number;
};

export function checkPacket(
	packet: RtcpPacket,
	expected: ExpectedPacket
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
	expect(packet.getAvailableLength()).toBe(
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
