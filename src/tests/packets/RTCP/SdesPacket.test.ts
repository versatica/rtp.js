import {
	SdesPacket,
	SdesPacketDump,
	SdesChunk,
	SdesChunkDump,
	SdesItemType
} from '../../../packets/RTCP/SdesPacket';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { areDataViewsEqual } from '../../../utils/helpers';

const sdesChunkDump1: SdesChunkDump =
{
	byteLength : 24,
	ssrc       : 0x9f65e742,
	items      :
	[
		{ type: SdesItemType.CNAME, text: 't7mkYnCm46OcINy/' }
	]
};

const sdesChunkDump2: SdesChunkDump =
{
	byteLength : 44,
	ssrc       : 0x9f65e743,
	items      :
	[
		{ type: SdesItemType.NAME, text: 't7mkYnCm46OcINy/' },
		{ type: SdesItemType.NOTE, text: 't7mkYnCm46OcINy/' }
	]
};

const sdesChunkDump3: SdesChunkDump =
{
	byteLength : 12,
	ssrc       : 0x11223344,
	items      :
	[
		{ type: 5, text: 'ab' }
	]
};

describe('parse SDES packet', () =>
{
	const array = new Uint8Array(
		[
			0x81, 0xca, 0x00, 0x06, // Type: 202 (SDES), Count: 1, Length: 6
			// Chunk
			0x9f, 0x65, 0xe7, 0x42, // SSRC: 0x9f65e742
			0x01, 0x10, 0x74, 0x37, // Item Type: 1 (CNAME), Length: 16,
			0x6d, 0x6b, 0x59, 0x6e, //   Text: "t7mkYnCm46OcINy/"
			0x43, 0x6d, 0x34, 0x36,
			0x4f, 0x63, 0x49, 0x4e,
			0x79, 0x2f, 0x00, 0x00 // 2 null octets
		]
	);

	const view = new DataView(
		array.buffer,
		array.byteOffset,
		array.byteLength
	);

	test('buffer view is RTCP', () =>
	{
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () =>
	{
		const packet = new SdesPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 4 (common header) + 24 (1 chunk) = 28.
		expect(packet.getByteLength()).toBe(28);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SDES);
		expect(packet.getCount()).toBe(1);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getChunks().length).toBe(1);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const chunk1 = packet.getChunks()[0];

		expect(chunk1.getByteLength()).toBe(24);
		expect(chunk1.dump()).toEqual(sdesChunkDump1);
	});

	test('packet processing succeeds for a buffer view with padding', () =>
	{
		const array2 = new Uint8Array(
			[
				0xa2, 0xca, 0x00, 0x12, // Padding, Type: 202 (SDES), Count: 2, Length: 18
				// Chunk
				0x9f, 0x65, 0xe7, 0x42, // SSRC: 0x9f65e742
				0x01, 0x10, 0x74, 0x37, // Item Type: 1 (CNAME), Length: 16,
				0x6d, 0x6b, 0x59, 0x6e, //   Text: "t7mkYnCm46OcINy/"
				0x43, 0x6d, 0x34, 0x36,
				0x4f, 0x63, 0x49, 0x4e,
				0x79, 0x2f, 0x00, 0x00, // 2 null octets
				// Chunk
				0x9f, 0x65, 0xe7, 0x43, // SSRC: 0x9f65e743
				0x02, 0x10, 0x74, 0x37, // Item Type: 2 (NAME), Length: 16,
				0x6d, 0x6b, 0x59, 0x6e, //   Text: "t7mkYnCm46OcINy/"
				0x43, 0x6d, 0x34, 0x36,
				0x4f, 0x63, 0x49, 0x4e,
				0x79, 0x2f,
				0x07, 0x10, 0x74, 0x37, // Item Type: 7 (NOTE), Length: 16,
				0x6d, 0x6b, 0x59, 0x6e, //   Text: "t7mkYnCm46OcINy/"
				0x43, 0x6d, 0x34, 0x36,
				0x4f, 0x63, 0x49, 0x4e,
				0x79, 0x2f,
				0x00, 0x00, 0x00, 0x00, // 4 null octets
				0x00, 0x00, 0x00, 0x04 // Padding (4 bytes)
			]
		);

		const view2 = new DataView(
			array2.buffer,
			array2.byteOffset,
			array2.byteLength
		);

		const packet = new SdesPacket(view2);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(76);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SDES);
		expect(packet.getCount()).toBe(2);
		expect(packet.getPadding()).toBe(4);
		expect(packet.getChunks().length).toBe(2);
		expect(areDataViewsEqual(packet.getView(), view2)).toBe(true);

		const chunk1 = packet.getChunks()[0];
		const chunk2 = packet.getChunks()[1];

		expect(chunk1.getByteLength()).toBe(24);
		expect(chunk1.dump()).toEqual(sdesChunkDump1);

		expect(chunk2.getByteLength()).toBe(44);
		expect(chunk2.dump()).toEqual(sdesChunkDump2);

		// If a change is done in a chunk, the SDES packet must need serialization.
		chunk1.setSsrc(1234);
		expect(chunk1.needsSerialization()).toBe(true);
		expect(packet.needsSerialization()).toBe(true);

		// And if we serialize the packet, it should unset the serialization needed
		// flag.
		packet.serialize();
		expect(chunk1.needsSerialization()).toBe(false);
		expect(packet.needsSerialization()).toBe(false);
	});

	test('packet processing succeeds with padded item', () =>
	{
		const array3 = new Uint8Array(
			[
				0x81, 0xca, 0x00, 0x03, // Type: 202 (SDES), Count: 1, Length: 3
				// Chunk
				0x11, 0x22, 0x33, 0x44, // SSRC: 0x11223344
				0x05, 0x02, 0x61, 0x62, // Item Type: 5 (LOC), Length: 2, Text: "ab"
				0x00, 0x00, 0x00, 0x00 // 4 null octets
			]
		);

		const view3 = new DataView(
			array3.buffer,
			array3.byteOffset,
			array3.byteLength
		);

		const packet = new SdesPacket(view3);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.getByteLength()).toBe(16);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SDES);
		expect(packet.getCount()).toBe(1);
		expect(packet.getPadding()).toBe(0);
		expect(packet.getChunks().length).toBe(1);
		expect(areDataViewsEqual(packet.getView(), view3)).toBe(true);

		const chunk1 = packet.getChunks()[0];

		expect(chunk1.getByteLength()).toBe(12);
		expect(chunk1.dump()).toEqual(sdesChunkDump3);

		// If a change is done in a chunk, the SDES packet must need serialization.
		chunk1.setSsrc(0x99887766);
		expect(chunk1.needsSerialization()).toBe(true);
		expect(packet.needsSerialization()).toBe(true);

		// And if we serialize the packet, it should unset the serialization needed
		// flag.
		packet.serialize();
		expect(chunk1.needsSerialization()).toBe(false);
		expect(packet.needsSerialization()).toBe(false);
	});

	test('another packet processing succeeds', () =>
	{
		const array4 = new Uint8Array(
			[
				0x82, 0xca, 0x00, 0x0c, // Type: 202 (SDES), Count: 2, Length: 12
				// Chunk
				0x00, 0x00, 0x04, 0xd2, // SSRC: 1234
				0x01, 0x06, 0x71, 0x77, // Item Type: 1 (CNAME), Length: 6, Text: "qwerty"
				0x65, 0x72, 0x74, 0x79,
				0x06, 0x06, 0x69, 0xc3, // Item Type: 6 (TOOL), Length: 6, Text: "iñaki"
				0xb1, 0x61, 0x6b, 0x69,
				0x00, 0x00, 0x00, 0x00, // 4 null octets
				// Chunk
				0x00, 0x00, 0x16, 0x2e, // SSRC: 5678
				0x05, 0x11, 0x73, 0x6f, // Item Type: 5 (LOC), Length: 17, Text: "somewhere œæ€"
				0x6d, 0x65, 0x77, 0x68,
				0x65, 0x72, 0x65, 0x20,
				0xc5, 0x93, 0xc3, 0xa6,
				0xe2, 0x82, 0xac, 0x00 // 1 null octet
			]
		);

		const packetDump: SdesPacketDump =
		{
			packetType : RtcpPacketType.SDES,
			byteLength : 52,
			padding    : 0,
			count      : 2,
			chunks     :
			[
				{
					byteLength : 24,
					ssrc       : 1234,
					items      :
					[
						{ type: SdesItemType.CNAME, text: 'qwerty' },
						{ type: SdesItemType.TOOL, text: 'iñaki' }
					]
				},
				{
					byteLength : 24,
					ssrc       : 5678,
					items      : [ { type: SdesItemType.LOC, text: 'somewhere œæ€' } ]
				}
			]
		};

		const view4 = new DataView(
			array4.buffer,
			array4.byteOffset,
			array4.byteLength
		);

		const packet = new SdesPacket(view4);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(packetDump);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(packetDump);
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(true);
	});

	test('parsing a buffer view which length does not fit the indicated count throws', () =>
	{
		// Parse just the first 26 bytes of buffer.
		const view5 = new DataView(
			array.buffer,
			array.byteOffset,
			26
		);

		expect(() => (new SdesPacket(view5)))
			.toThrowError(RangeError);
	});

	test('parsing a packet with missing null octets in the chunk throws', () =>
	{
		const array6 = new Uint8Array(
			[
				0x81, 0xca, 0x00, 0x02, // Type: 202 (SDES), Count: 1, Length: 2
				// Chunk
				0x11, 0x22, 0x33, 0x44, // SSRC: 0x11223344
				0x08, 0x02, 0x61, 0x62 // Item Type: 8 (PRIV), Length: 2, Text: "ab"
			]
		);

		const view6 = new DataView(
			array6.buffer,
			array6.byteOffset,
			array6.byteLength
		);

		expect(() => (new SdesPacket(view6)))
			.toThrowError(RangeError);
	});
});

describe('create RTCP SDES packet', () =>
{
	test('creating a SDES packet succeeds', () =>
	{
		const packet = new SdesPacket();

		expect(isRtcp(packet.getView())).toBe(true);
		expect(packet.needsSerialization()).toBe(false);
		// Byte length must be 4 (common header).
		expect(packet.getByteLength()).toBe(4);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SDES);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.needsSerialization()).toBe(false);

		packet.padTo4Bytes();
		// After padding to 4 bytes, nothing should change since the rest of the
		// packet always fits into groups of 4 bytes.
		expect(packet.getByteLength()).toBe(4);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SDES);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.needsSerialization()).toBe(false);

		packet.serialize();

		expect(packet.getByteLength()).toBe(4);
		expect(packet.getPacketType()).toBe(RtcpPacketType.SDES);
		expect(packet.getCount()).toBe(0);
		expect(packet.getPadding()).toBe(0);
		expect(packet.needsSerialization()).toBe(false);
		expect(isRtcp(packet.getView())).toBe(true);

		const chunk1 = new SdesChunk();

		chunk1.setSsrc(1234);
		chunk1.setItem(SdesItemType.CNAME, 'qwerty');
		chunk1.setItem(SdesItemType.TOOL, 'iñaki');

		packet.addChunk(chunk1);

		const chunk2 = new SdesChunk();

		chunk2.setSsrc(5678);
		chunk2.setItem(SdesItemType.LOC, 'somewhere œæ€');

		packet.addChunk(chunk2);

		expect(isRtcp(packet.getView())).toBe(true);

		const clonedPacket = packet.clone();

		expect(isRtcp(clonedPacket.getView())).toBe(true);
		expect(clonedPacket.dump()).toEqual(packet.dump());
		expect(areDataViewsEqual(clonedPacket.getView(), packet.getView())).toBe(true);

		const clonedChunk1 = clonedPacket.getChunks()[0];

		expect(clonedChunk1.dump()).toEqual(chunk1.dump());

		const chunk3 = new SdesChunk();

		chunk3.setSsrc(0x66666666);
		chunk3.setItem(SdesItemType.PRIV, 'ab');

		packet.addChunk(chunk3);

		packet.serialize();
		expect(packet.getPacketType()).toBe(RtcpPacketType.SDES);
		expect(packet.getCount()).toBe(3);
		expect(packet.getPadding()).toBe(0);
		expect(packet.needsSerialization()).toBe(false);
		expect(isRtcp(packet.getView())).toBe(true);

		const chunk1B = packet.getChunks()[0];

		expect(chunk1B.needsSerialization()).toBe(false);
		expect(chunk1B.dump()).toEqual(
			{
				byteLength : 24,
				ssrc       : 1234,
				items      :
				[
					{ type: SdesItemType.CNAME, text: 'qwerty' },
					{ type: SdesItemType.TOOL, text: 'iñaki' }
				]
			}
		);

		const chunk2B = packet.getChunks()[1];

		expect(chunk2B.needsSerialization()).toBe(false);
		expect(chunk2B.dump()).toEqual(
			{
				byteLength : 24,
				ssrc       : 5678,
				items      : [ { type: SdesItemType.LOC, text: 'somewhere œæ€' } ]
			}
		);

		const chunk3B = packet.getChunks()[2];

		expect(chunk3B.needsSerialization()).toBe(false);
		expect(chunk3B.dump()).toEqual(
			{
				byteLength : 12,
				ssrc       : 0x66666666,
				items      : [ { type: SdesItemType.PRIV, text: 'ab' } ]
			}
		);
	});
});

describe('create SDES Chunk', () =>
{
	test('creating a Chunk succeeds', () =>
	{
		const chunk = new SdesChunk();

		expect(chunk.needsSerialization()).toBe(false);
		chunk.setSsrc(sdesChunkDump2.ssrc);

		for (const item of sdesChunkDump2.items)
		{
			chunk.setItem(item.type, item.text);
		}

		expect(chunk.needsSerialization()).toBe(true);
		expect(chunk.dump()).toEqual(sdesChunkDump2);

		const serializationBuffer = new ArrayBuffer(2000);
		const serializationByteOffset = 234;

		const cloningBuffer = new ArrayBuffer(1000);
		const cloningByteOffset = 123;

		// Clone the chunk instead of just serializing it since clone() will
		// serialize it anyway.
		const clonedChunk = chunk.clone(
			cloningBuffer,
			cloningByteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		expect(chunk.needsSerialization()).toBe(false);
		expect(chunk.getView().buffer === serializationBuffer).toBe(true);
		expect(chunk.getView().byteOffset).toBe(serializationByteOffset);
		expect(chunk.dump()).toEqual(sdesChunkDump2);

		expect(clonedChunk.needsSerialization()).toBe(false);
		expect(clonedChunk.getView().buffer === cloningBuffer).toBe(true);
		expect(clonedChunk.getView().byteOffset).toBe(cloningByteOffset);
		expect(clonedChunk.dump()).toEqual(sdesChunkDump2);
	});
});
