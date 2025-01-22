import * as fs from 'fs';
import * as path from 'path';
import {
	isRtp,
	RtpPacket,
	RtpPacketDump,
} from '../../../packets/RTP/RtpPacket';
import {
	clone,
	areDataViewsEqual,
	nodeBufferToDataView,
	numericArrayToDataView,
	stringToDataView,
} from '../../../utils/helpers';

describe('parse RTP packet 1', () => {
	const view = nodeBufferToDataView(
		fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'rtppacket1.raw'))
	);

	let packet: RtpPacket;

	test('isRtp() succeeds', () => {
		expect(isRtp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		packet = new RtpPacket(view);

		expect(packet.getByteLength()).toBe(54);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getPayloadType()).toBe(111);
		expect(packet.getSequenceNumber()).toBe(23617);
		expect(packet.getTimestamp()).toBe(1660241882);
		expect(packet.getSsrc()).toBe(2674985186);
		expect(packet.getCsrcs()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.getExtension(1)).toEqual(numericArrayToDataView([255]));
		expect(packet.needsSerialization()).toBe(false);

		packet.setExtension(1, stringToDataView('foo œæ€å∫∂ ®†¥∂ƒ∑©√'));
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(1)).toEqual(
			stringToDataView('foo œæ€å∫∂ ®†¥∂ƒ∑©√')
		);
	});
});

describe('parse RTP packet 2', () => {
	const view = nodeBufferToDataView(
		fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'rtppacket2.raw'))
	);

	let packet: RtpPacket;

	test('isRtp() succeeds', () => {
		expect(isRtp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		packet = new RtpPacket(view);

		expect(packet.getByteLength()).toBe(102);
		expect(packet.getPayloadType()).toBe(111);
		expect(packet.getSequenceNumber()).toBe(19354);
		expect(packet.getTimestamp()).toBe(863466045);
		expect(packet.getSsrc()).toBe(235797202);
		expect(packet.getCsrcs()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.getExtension(3)).toEqual(
			numericArrayToDataView([0x65, 0x34, 0x1e])
		);
		expect(packet.getPayload().byteLength).toBe(78);
		expect(packet.needsSerialization()).toBe(false);
	});
});

describe('parse RTP packet 3', () => {
	const array = new Uint8Array([
		0b10010000,
		0b00000001,
		0x00,
		0x08,
		0x00,
		0x00,
		0x00,
		0x04,
		0x00,
		0x00,
		0x00,
		0x05,
		0xbe,
		0xde,
		0x00,
		0x03, // Header extension.
		0b00010000,
		0xff,
		0b00100001,
		0xff,
		0xff,
		0x00,
		0x00,
		0b00110011,
		0xff,
		0xff,
		0xff,
		0xff,
	]);

	const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

	let packet: RtpPacket;

	test('isRtp() succeeds', () => {
		expect(isRtp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		packet = new RtpPacket(view);

		expect(packet.getByteLength()).toBe(array.byteLength);
		expect(packet.getPayloadType()).toBe(1);
		expect(packet.getSequenceNumber()).toBe(8);
		expect(packet.getTimestamp()).toBe(4);
		expect(packet.getSsrc()).toBe(5);
		expect(packet.getCsrcs()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.getPayload().byteLength).toBe(0);
		expect(packet.needsSerialization()).toBe(false);
	});
});

describe('parse RTP packet 4', () => {
	const uselessExtensionAlignment = 4;

	// This RTP packet contains 4 extensions with id=0 meaning alignment so
	// those are discarded if the packet is serialized.
	const array = new Uint8Array([
		0b10010000,
		0b00000001,
		0x00,
		0x08,
		0x00,
		0x00,
		0x00,
		0x04,
		0x00,
		0x00,
		0x00,
		0x05,
		0b00010000,
		0x00,
		0x00,
		0x04, // Header extension.
		0x00,
		0x00,
		0x01,
		0x00,
		0x02,
		0x01,
		0x42,
		0x00,
		0x03,
		0x02,
		0x11,
		0x22,
		0x00,
		0x00,
		0x04,
		0x00,
	]);

	const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

	let packet: RtpPacket;

	test('isRtp() succeeds', () => {
		expect(isRtp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		packet = new RtpPacket(view);

		expect(packet.getByteLength()).toBe(
			array.byteLength - uselessExtensionAlignment
		);
		expect(packet.getPayloadType()).toBe(1);
		expect(packet.getSequenceNumber()).toBe(8);
		expect(packet.getTimestamp()).toBe(4);
		expect(packet.getSsrc()).toBe(5);
		expect(packet.getCsrcs()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(true);
		expect(packet.getExtensions().size).toBe(4);
		expect(packet.getExtension(1)).toEqual(new DataView(new ArrayBuffer(0)));
		expect(packet.getExtension(2)).toEqual(numericArrayToDataView([0x42]));
		expect(packet.getExtension(3)).toEqual(
			numericArrayToDataView([0x11, 0x22])
		);
		expect(packet.getExtension(4)).toEqual(new DataView(new ArrayBuffer(0)));
		expect(packet.getExtension(5)).toBeUndefined();
		expect(packet.getPayload().byteLength).toBe(0);
		expect(packet.needsSerialization()).toBe(false);

		packet.deleteExtension(2);
		expect(packet.getExtensions().size).toBe(3);
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(2)).toBeUndefined();
	});
});

describe('parse RTP packet 5 with uncommon header extension value', () => {
	const array = new Uint8Array([
		0b10010000,
		0b00000001,
		0x00,
		0x08,
		0x00,
		0x00,
		0x00,
		0x04,
		0x00,
		0x00,
		0x00,
		0x05,
		0xa1,
		0xb1,
		0x00,
		0x01, // Uncommon header extension id: 0xA1B1.
		0xa2,
		0xb2,
		0xc2,
		0xd2, // Uncommon header extension value: 0xA2B2C2D2)
		0x11,
		0x22,
		0x33,
		0x44, // Payload.
	]);

	const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

	let packet: RtpPacket;

	test('isRtp() succeeds', () => {
		expect(isRtp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		packet = new RtpPacket(view);

		const packetView = clone<DataView>(packet.getView());
		const payloadView = clone<DataView>(packet.getPayload());
		const packetDump = clone<RtpPacketDump>(packet.dump());

		expect(packet.getByteLength()).toBe(array.byteLength);
		expect(packet.getPayloadType()).toBe(1);
		expect(packet.getSequenceNumber()).toBe(8);
		expect(packet.getTimestamp()).toBe(4);
		expect(packet.getSsrc()).toBe(5);
		expect(packet.getCsrcs()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.getExtensions().size).toBe(0);
		expect(packet.getPayload().byteLength).toBe(4);
		expect(packet.needsSerialization()).toBe(false);

		// Serialize and then compare DataViews.
		// NOTE: serialize() will NOT discard non RFC 5285 header extensions, so
		// the packet will match the parsed one.
		packet.serialize();

		expect(areDataViewsEqual(packet.getView(), packetView)).toBe(true);
		expect(areDataViewsEqual(packet.getPayload(), payloadView)).toBe(true);
		expect(packet.dump()).toEqual(packetDump);
	});
});

describe('create RTP packet 6 from scratch', () => {
	let packet: RtpPacket;

	test('packet processing succeeds', () => {
		packet = new RtpPacket();

		expect(isRtp(packet.getView())).toBe(true);
		expect(packet.getPayloadType()).toBe(0);
		expect(packet.getSequenceNumber()).toBe(0);
		expect(packet.getTimestamp()).toBe(0);
		expect(packet.getSsrc()).toBe(0);
		expect(packet.getCsrcs()).toEqual([]);
		expect(packet.getMarker()).toBe(false);
		expect(packet.getPayload()).toEqual(new DataView(new ArrayBuffer(0)));
		expect(packet.getPadding()).toBe(0);
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.getExtensions().size).toBe(0);
		expect(packet.needsSerialization()).toBe(false);

		packet.setPayloadType(3);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getPayloadType()).toBe(3);

		packet.setPayloadType(127);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getPayloadType()).toBe(127);

		packet.setSequenceNumber(52345);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getSequenceNumber()).toBe(52345);

		packet.setTimestamp(1234567890);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getTimestamp()).toBe(1234567890);

		packet.setSsrc(3294967295);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getSsrc()).toBe(3294967295);

		packet.setMarker(true);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getMarker()).toBe(true);

		packet.setCsrcs([1111, 2222]);
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getCsrcs()).toEqual([1111, 2222]);

		packet.enableOneByteExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		expect(packet.getExtensions().size).toBe(0);

		packet.enableTwoBytesExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(true);
		expect(packet.getExtensions().size).toBe(0);

		packet.setExtension(1, stringToDataView('foo'));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.getExtension(1)).toEqual(stringToDataView('foo'));

		packet.setExtension(2, numericArrayToDataView([1, 2, 3, 4]));
		expect(packet.getExtensions().size).toBe(2);
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(2)).toEqual(
			numericArrayToDataView([1, 2, 3, 4])
		);

		packet.deleteExtension(1);
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtension(1)).toBeUndefined();

		packet.clearExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtensions().size).toBe(0);
		expect(packet.getExtension(2)).toBeUndefined();

		packet.setExtension(2, numericArrayToDataView([1, 2, 3, 4]));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.getExtension(2)).toEqual(
			numericArrayToDataView([1, 2, 3, 4])
		);

		packet.setPayload(stringToDataView('codec'));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getPayload()).toEqual(stringToDataView('codec'));
	});

	test('packet.clone() succeeds', () => {
		// Serialize to reset serialization packet.
		packet.serialize();
		expect(packet.needsSerialization()).toBe(false);

		const clonedPacket = packet.clone();

		expect(packet.needsSerialization()).toBe(false);
		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.getPayloadType()).toBe(127);
		expect(clonedPacket.getSequenceNumber()).toBe(52345);
		expect(clonedPacket.getTimestamp()).toBe(1234567890);
		expect(clonedPacket.getSsrc()).toBe(3294967295);
		expect(clonedPacket.getMarker()).toBe(true);
		expect(clonedPacket.getCsrcs()).toEqual([1111, 2222]);
		expect(clonedPacket.hasOneByteExtensions()).toBe(false);
		expect(clonedPacket.hasTwoBytesExtensions()).toBe(true);
		expect(clonedPacket.getExtension(2)).toEqual(
			numericArrayToDataView([1, 2, 3, 4])
		);
		expect(clonedPacket.getPayload()).toEqual(stringToDataView('codec'));
		expect(clonedPacket.getPadding()).toBe(0);
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(clonedPacket.needsSerialization()).toBe(false);
		// Packet views and payload views must be the same.
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(
			true
		);
		expect(
			areDataViewsEqual(clonedPacket.getPayload(), packet.getPayload())
		).toBe(true);
		// DataViews instances must be different since it's a cloned packet.
		expect(clonedPacket.getView() === packet.getView()).toBe(false);
		expect(clonedPacket.getPayload() === packet.getPayload()).toBe(false);
		// Internal ArrayBuffer instances must be different.
		expect(clonedPacket.getView().buffer === packet.getView().buffer).toBe(
			false
		);
		expect(
			clonedPacket.getPayload().buffer === packet.getPayload().buffer
		).toBe(false);

		// Clone again, now in a given buffer.
		const cloneBuffer = new ArrayBuffer(1500);
		const byteOffset = 245;
		const clonedPacket2 = packet.clone(cloneBuffer, byteOffset);

		// DataViews instances must be different since it's a cloned packet.
		expect(clonedPacket2.getView() === packet.getView()).toBe(false);
		expect(clonedPacket2.getPayload() === packet.getPayload()).toBe(false);
		// Internal ArrayBuffer instances must be different.
		expect(clonedPacket2.getView().buffer === packet.getView().buffer).toBe(
			false
		);
		expect(
			clonedPacket2.getPayload().buffer === packet.getPayload().buffer
		).toBe(false);
	});

	test('packet.rtxEncode() and packet.rtxDecode() succeed', () => {
		// Serialize to reset serialization needed.
		packet.serialize();
		expect(packet.needsSerialization()).toBe(false);

		const payloadType = packet.getPayloadType();
		const ssrc = packet.getSsrc();
		const sequenceNumber = packet.getSequenceNumber();
		const payloadLength = packet.getPayload().byteLength;
		const packetView = clone<DataView>(packet.getView());
		const payloadView = clone<DataView>(packet.getPayload());
		const packetDump = clone<RtpPacketDump>(packet.dump());

		packet.rtxEncode(69, 69696969, 6969);
		expect(packet.needsSerialization()).toBe(true);

		// Serialize to reset serialization needed.
		packet.serialize();

		const rtxPayloadView = packet.getPayload();

		expect(packet.getPayloadType()).toBe(69);
		expect(packet.getSequenceNumber()).toBe(6969);
		expect(packet.getSsrc()).toBe(69696969);
		expect(rtxPayloadView.byteLength).toBe(payloadLength + 2);
		expect(rtxPayloadView.getUint16(0)).toBe(sequenceNumber);

		const payloadWithoutSeqNumberView = new DataView(
			packet.getPayload().buffer,
			packet.getPayload().byteOffset + 2,
			packet.getPayload().byteLength - 2
		);

		expect(areDataViewsEqual(payloadWithoutSeqNumberView, payloadView)).toBe(
			true
		);

		packet.rtxDecode(payloadType, ssrc);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getPayloadType()).toBe(payloadType);
		expect(packet.getSequenceNumber()).toBe(sequenceNumber);
		expect(packet.getSsrc()).toBe(ssrc);
		expect(packet.getPayload().byteLength).toBe(payloadLength);
		expect(packet.needsSerialization()).toBe(true);
		// Packet and payload views must be the same.
		expect(areDataViewsEqual(packet.getView(), packetView)).toBe(true);
		expect(areDataViewsEqual(packet.getPayload(), payloadView)).toBe(true);
		expect(packet.dump()).toEqual(packetDump);
	});
});

describe('create RTP packet 7 from scratch', () => {
	let packet: RtpPacket;

	test('packet processing succeeds', () => {
		packet = new RtpPacket();

		// Adding an extension without having One-Byte or Two-Bytes extensions
		// enabled should force One-Byte.
		packet.setExtension(1, numericArrayToDataView([1, 2, 3, 4]));
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.getExtension(1)).toEqual(
			numericArrayToDataView([1, 2, 3, 4])
		);
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		// Packet total length must match RTP fixed header length (12) + header
		// extension id/length (4) + extension id 1 (5) = 21. Must add padding so
		// it becomes 24;
		expect(packet.getView().byteLength).toBe(24);
		expect(packet.needsSerialization()).toBe(false);

		packet.clearExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtensions().size).toBe(0);
		expect(packet.getExtension(1)).toBeUndefined();
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		// Packet total length must match RTP fixed header length (12).
		// getView() serializes if needed.
		expect(packet.getView().byteLength).toBe(12);
		expect(packet.needsSerialization()).toBe(false);
	});
});

describe('create RTP packet 8 from scratch', () => {
	let packet: RtpPacket;

	test('packet processing succeeds', () => {
		packet = new RtpPacket();

		packet.enableOneByteExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtensions().size).toBe(0);
		packet.setExtension(0, stringToDataView('ignore me'));
		packet.setExtension(1, numericArrayToDataView([1, 2, 3, 4]));
		packet.setExtension(15, stringToDataView('also ignore me'));
		packet.setExtension(16, stringToDataView('also ignore me'));
		// We don't validate extensions (`id` and value length) until the packet
		// is serialized.
		expect(packet.getExtensions().size).toBe(4);

		// Force serialization so extension with id 0 and id >= 15 must be ignored.
		packet.serialize();
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.getExtension(0)).toBeUndefined();
		expect(packet.getExtension(1)).toEqual(
			numericArrayToDataView([1, 2, 3, 4])
		);
		// Extension with id 16 (so 0 in 4 bits) must be ignored.
		expect(packet.getExtension(16)).toBeUndefined();
		expect(packet.hasOneByteExtensions()).toBe(true);
		expect(packet.hasTwoBytesExtensions()).toBe(false);
		// Packet total length must match RTP fixed header length (12) + header
		// extension id/length (4) + extension id 1 (5) = 21. Must add padding so
		// it becomes 24;
		// getView() serializes if needed.
		expect(packet.getView().byteLength).toBe(24);
		expect(packet.needsSerialization()).toBe(false);

		// Adding a extension with value longer than 16 bytes is not allowed in
		// One-Byte extensions, so it must fail when serializing.
		packet.setExtension(5, new DataView(new ArrayBuffer(17)));
		expect(() => packet.serialize()).toThrow(RangeError);
	});
});

describe('create RTP packet 9 from scratch', () => {
	let packet: RtpPacket;

	test('packet processing succeeds', () => {
		packet = new RtpPacket();

		packet.enableTwoBytesExtensions();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getExtensions().size).toBe(0);
		packet.setExtension(0, stringToDataView('ignore me'));
		packet.setExtension(1, numericArrayToDataView([1, 2, 3, 4]));
		packet.setExtension(256, stringToDataView('also ignore me'));
		packet.setExtension(257, stringToDataView('also ignore me'));
		// We don't validate extensions (`id` and value length) until the packet
		// is serialized.
		expect(packet.getExtensions().size).toBe(4);

		// Force serialization so extension with id 0, 256 and 257 must be ignored.
		packet.serialize();
		expect(packet.getExtensions().size).toBe(1);
		expect(packet.getExtension(0)).toBeUndefined();
		expect(packet.getExtension(1)).toEqual(
			numericArrayToDataView([1, 2, 3, 4])
		);
		// Extension with id 256 (so 0 in 8 bits) must be ignored.
		expect(packet.getExtension(256)).toBeUndefined();
		expect(packet.getExtension(257)).toBeUndefined();
		expect(packet.hasOneByteExtensions()).toBe(false);
		expect(packet.hasTwoBytesExtensions()).toBe(true);
		// Packet total length must match RTP fixed header length (12) + header
		// extension id/length (4) + extension id 1 (6) = 22. Must add padding so
		// it becomes 24;
		// getView() serializes if needed.
		expect(packet.getView().byteLength).toBe(24);
		expect(packet.needsSerialization()).toBe(false);

		// Adding a extension with value longer than 255 bytes is not allowed in
		// Two-Bytes extensions, so it must fail when serializing.
		packet.setExtension(5, new DataView(new ArrayBuffer(256)));
		expect(() => packet.serialize()).toThrow(RangeError);
	});
});

describe('create RTP packet 10 from scratch', () => {
	let packet: RtpPacket;

	test('packet processing succeeds', () => {
		packet = new RtpPacket();

		packet.setPayload(numericArrayToDataView([1, 2, 3, 4]));
		expect(packet.needsSerialization()).toBe(true);
		// Packet total length must match RTP fixed header length (12) + payload
		// (4), so 16.
		expect(packet.getView().byteLength).toBe(16);
		expect(packet.getByteLength()).toBe(16);

		// Nothing to do since already padded to 4 bytes.
		packet.padTo4Bytes();
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getView().byteLength).toBe(16);
		expect(packet.getByteLength()).toBe(16);
		expect(packet.getPadding()).toBe(0);

		// Padding a packet of 16 bytes (0 byte of padding) must become 16 bytes.
		packet.padTo4Bytes();
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getView().byteLength).toBe(16);
		expect(packet.getByteLength()).toBe(16);
		expect(packet.getPadding()).toBe(0);

		packet.setPayload(numericArrayToDataView([1, 2, 3, 4, 5]));
		expect(packet.getByteLength()).toBe(17);

		// Padding a packet of 17 bytes (0 bytes of padding) must become 20 bytes.
		packet.padTo4Bytes();
		expect(packet.needsSerialization()).toBe(true);
		expect(packet.getView().byteLength).toBe(20);
		expect(packet.getByteLength()).toBe(20);
		expect(packet.getPadding()).toBe(3);
	});
});

describe('serialize packet into a given buffer', () => {
	const packet = new RtpPacket();

	packet.setPayload(numericArrayToDataView([1, 2, 3, 4]));
	packet.serialize();

	const packetView = clone<DataView>(packet.getView());
	const payloadView = clone<DataView>(packet.getPayload());
	const packetDump = clone<RtpPacketDump>(packet.dump());

	test('serialization succeeds', () => {
		const buffer = new ArrayBuffer(2000);
		const byteOffset = 135;

		packet.serialize(buffer, byteOffset);

		// Packet and payload views must be the same.
		expect(areDataViewsEqual(packet.getView(), packetView)).toBe(true);
		expect(areDataViewsEqual(packet.getPayload(), payloadView)).toBe(true);
		expect(packet.getView().buffer === buffer).toBe(true);
		expect(packet.getView().byteOffset).toBe(byteOffset);
		expect(packet.dump()).toEqual(packetDump);
	});

	test('serialization fails if given buffer do not have enough space', () => {
		// Packet length is 16 byrtes so let's pass only 15 bytes to make it throw.
		const buffer = new ArrayBuffer(16);
		const byteOffset = 1;

		expect(() => packet.serialize(buffer, byteOffset)).toThrow(RangeError);
	});

	test('serialization corrupts the packet if current buffer is given with a byteOffset that makes the serialization overlap the packet content', () => {
		packet.setSequenceNumber(55555);
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getSequenceNumber()).toBe(55555);

		const buffer = new ArrayBuffer(1500);

		packet.serialize(buffer, 0);
		expect(packet.getSequenceNumber()).toBe(55555);

		// Here we are serializing the packet in its own buffer with an offset of 2,
		// so we are effectively overriding its current content, including the bytes
		// where the sequence number value is stored.
		packet.serialize(buffer, 2);
		expect(packet.getSequenceNumber()).not.toBe(55555);
	});
});

describe('clone packet into a given buffer', () => {
	const packet = new RtpPacket();

	packet.setPayload(numericArrayToDataView([1, 2, 3, 4]));
	packet.serialize();

	const packetView = clone<DataView>(packet.getView());
	const payloadView = clone<DataView>(packet.getPayload());
	const packetDump = clone<RtpPacketDump>(packet.dump());

	test('cloning succeeds', () => {
		const buffer = new ArrayBuffer(2000);
		const byteOffset = 135;

		const clonedPacket = packet.clone(buffer, byteOffset);

		// Packet and payload views must be the same.
		expect(areDataViewsEqual(clonedPacket.getView(), packetView)).toBe(true);
		expect(areDataViewsEqual(clonedPacket.getPayload(), payloadView)).toBe(
			true
		);
		expect(clonedPacket.getView().buffer === buffer).toBe(true);
		expect(clonedPacket.getView().byteOffset).toBe(byteOffset);
		expect(clonedPacket.dump()).toEqual(packetDump);
	});

	test('cloning fails if given buffer do not have enough space', () => {
		// Packet length is 16 byrtes so let's pass only 15 bytes to make it throw.
		const buffer = new ArrayBuffer(16);
		const byteOffset = 1;

		expect(() => packet.clone(buffer, byteOffset)).toThrow(RangeError);
	});
});
