import { Packet, isRtp } from '../../../packets/RTP/Packet';
import { areBuffersEqual } from '../../../utils/buffers';
import { throwBuffer } from '../../testHelpers';

export type ExpectedPacket = {
	buffer: Uint8Array;
	bufferLength: number;
	length: number;
	payloadType: number;
	marker: boolean;
	sequenceNumber: number;
	timestamp: number;
	ssrc: number;
	hasCsrcs: boolean;
	hasHeaderExtension: boolean;
	headerExtensionValueLength: number;
	hasOneByteExtensions: boolean;
	hasTwoBytesExtensions: boolean;
	hasPayload: boolean;
	payloadLength: number;
	hasPadding: boolean;
	padding: number;
};

export function checkPacket(packet: Packet, expected: ExpectedPacket): void {
	const packetBuffer = packet.getBuffer();
	const view = new DataView(
		packetBuffer.buffer,
		packetBuffer.byteOffset,
		packetBuffer.byteLength
	);
	const firstByte = view.getUint8(0);
	const csrcCount = firstByte & 0b00001111;
	const hasHeaderExtension = (firstByte & 0b00010000) !== 0;
	const hasPadding = (firstByte & 0b00100000) !== 0;
	const headerExtensionOffset = 12 + csrcCount * 4;
	const headerExtensionId = hasHeaderExtension
		? view.getUint16(headerExtensionOffset)
		: undefined;
	const headerExtensionValueLength = hasHeaderExtension
		? view.getUint16(headerExtensionOffset + 2) * 4
		: 0;

	expect(isRtp(packetBuffer, expected.length)).toBe(true);

	const originalBuffer = expected.buffer.slice(0, expected.bufferLength);

	expect(packetBuffer.buffer).toBe(expected.buffer.buffer);
	expect(packetBuffer.byteOffset).toBe(expected.buffer.byteOffset);
	expect(packet.getBufferLength()).not.toBe(0);
	expect(packet.getBufferLength()).toBe(expected.bufferLength);
	expect(packet.getLength()).not.toBe(0);
	expect(packet.getLength()).toBe(expected.length);
	expect(packet.getAvailableLength()).toBe(
		packet.getBufferLength() - packet.getLength()
	);
	expect(firstByte >> 6).toBe(2);
	expect(packet.getPayloadType()).toBe(expected.payloadType);
	expect(packet.getMarker()).toBe(expected.marker);
	expect(packet.getSequenceNumber()).toBe(expected.sequenceNumber);
	expect(packet.getTimestamp()).toBe(expected.timestamp);
	expect(packet.getSsrc()).toBe(expected.ssrc);
	expect(packet.getCsrcs().length > 0).toBe(expected.hasCsrcs);
	expect(hasHeaderExtension).toBe(expected.hasHeaderExtension);
	expect(headerExtensionValueLength).toBe(expected.headerExtensionValueLength);
	expect(headerExtensionId === 0xbede).toBe(expected.hasOneByteExtensions);
	expect(
		headerExtensionId !== undefined &&
			(headerExtensionId & 0b1111111111110000) === 0b0001000000000000
	).toBe(expected.hasTwoBytesExtensions);

	if (!hasHeaderExtension) {
		expect(packet.getExtensions().size).toBe(0);
	}

	expect(packet.getPayload().byteLength > 0).toBe(expected.hasPayload);
	expect(packet.getPayload().byteLength).toBe(expected.payloadLength);
	expect(hasPadding).toBe(expected.hasPadding);
	expect(packet.getPadding()).toBe(expected.padding);

	if (!hasPadding) {
		expect(packet.getPadding()).toBe(0);
	}

	expect(() => Packet.parse(packetBuffer)).not.toThrow();
	expect(() => packet.setPayloadType(packet.getPayloadType())).not.toThrow();
	expect(() => packet.setMarker(packet.getMarker())).not.toThrow();
	expect(() =>
		packet.setSequenceNumber(packet.getSequenceNumber())
	).not.toThrow();
	expect(() => packet.setTimestamp(packet.getTimestamp())).not.toThrow();
	expect(() => packet.setSsrc(packet.getSsrc())).not.toThrow();

	if (!hasHeaderExtension) {
		expect(() => packet.clearExtensions()).not.toThrow();
	}

	if (!expected.hasPadding) {
		expect(() => packet.setPayload(packet.getPayload())).not.toThrow();
		expect(
			areBuffersEqual(
				expected.buffer.subarray(0, expected.bufferLength),
				originalBuffer
			)
		).toBe(true);
	}

	expect(() =>
		packet.setPayload(new Uint8Array(packet.getBufferLength()))
	).toThrow(TypeError);
	expect(() => packet.setPadding(packet.getPadding())).not.toThrow();

	if (packet.getLength() % 4 === 0 && packet.getPadding() < 4) {
		expect(() => packet.padTo4Bytes()).not.toThrow();
		expect(
			areBuffersEqual(
				expected.buffer.subarray(0, expected.bufferLength),
				originalBuffer
			)
		).toBe(true);
	}

	expect(() =>
		packet.serialize(throwBuffer.subarray(0, expected.length - 1))
	).toThrow(TypeError);
	expect(() =>
		packet.clone(throwBuffer.subarray(0, expected.length - 1))
	).toThrow(TypeError);
	expect(() => Packet.parse(packet.getBuffer())).not.toThrow();
	expect(
		areBuffersEqual(
			expected.buffer.subarray(0, expected.bufferLength),
			originalBuffer
		)
	).toBe(true);
}
