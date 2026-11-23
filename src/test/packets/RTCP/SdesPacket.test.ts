import {
	MAX_CHUNKS,
	SdesPacket,
	SdesItemType,
	type SdesChunk,
} from '../../../packets/RTCP/SdesPacket';
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

describe('RTCP SDES Packet', () => {
	test('SdesPacket.parse() succeeds', () => {
		function checkChunks(packet: SdesPacket): void {
			expect(packet.getChunksCount()).toBe(3);
			expect(packet.getChunks()).toEqual([
				{
					ssrc: 0x9f65e742,
					items: [{ type: SdesItemType.CNAME, text: 't7mkYnCm46OcINy/' }],
				},
				{
					ssrc: 1234,
					items: [
						{ type: SdesItemType.CNAME, text: 'qwerty' },
						{ type: SdesItemType.TOOL, text: 'iñaki' },
					],
				},
				{
					ssrc: 5678,
					items: [],
				},
			]);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, SC=3, PT:202, Length: 14
			0b10000011, 0xca, 0x00, 0x0e,
			// Chunk 1
			// SSRC: 0x9f65e742
			0x9f, 0x65, 0xe7, 0x42,
			// Item type: 1 (CNAME), Length: 16, Text: "t7mkYnCm46OcINy/"
			0x01, 0x10, 0x74, 0x37,
			0x6d, 0x6b, 0x59, 0x6e,
			0x43, 0x6d, 0x34, 0x36,
			0x4f, 0x63, 0x49, 0x4e,
			// End of text "y/", null octet and 1 octet of padding
			0x79, 0x2f, 0x00, 0x00,
			// Chunk 2
			// SSRC: 1234
			0x00, 0x00, 0x04, 0xd2,
			// Item type: 1 (CNAME), Length: 6, Text: "qwerty"
			0x01, 0x06, 0x71, 0x77,
			0x65, 0x72, 0x74, 0x79,
			// Item type: 6 (TOOL), Length: 6, Text: "iñaki"
			0x06, 0x06, 0x69, 0xc3,
			0xb1, 0x61, 0x6b, 0x69,
			// 4 null octets
			0x00, 0x00, 0x00, 0x00,
			// Chunk 3
			// SSRC: 5678
			0x00, 0x00, 0x16, 0x2e,
			// 4 null octets (no items)
			0x00, 0x00, 0x00, 0x00,
		]);
		const packet = SdesPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 60,
			packetType: RtcpPacketType.SDES,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		checkChunks(packet);

		// No space to add more chunks.
		expect(() => packet.addChunk({ ssrc: 3333, items: [] })).toThrow(TypeError);

		// No space to add more items.
		const chunksWithMoreItems = packet.getChunks();

		chunksWithMoreItems[2]!.items.push({
			type: SdesItemType.NAME,
			text: 'foo',
		});

		expect(() => packet.setChunks(chunksWithMoreItems)).toThrow(TypeError);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xff);

		checkRtcpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		checkChunks(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		checkChunks(clonedPacket);

		/* Modify it. */

		// Add an item to the last chunk (which has no items).
		const chunks = clonedPacket.getChunks();

		chunks[2]!.items.push({ type: SdesItemType.LOC, text: 'ab' });

		clonedPacket.setChunks(chunks);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 64,
		});

		expect(clonedPacket.getChunksCount()).toBe(3);
		expect(clonedPacket.getChunks()[2]).toEqual({
			ssrc: 5678,
			items: [{ type: SdesItemType.LOC, text: 'ab' }],
		});

		// Check the null octet and padding bytes.
		const clonedBuffer = clonedPacket.getBuffer();

		expect(clonedBuffer[clonedPacket.getLength() - 4]).toBe(0);
		expect(clonedBuffer[clonedPacket.getLength() - 3]).toBe(0);
		expect(clonedBuffer[clonedPacket.getLength() - 2]).toBe(0);
		expect(clonedBuffer[clonedPacket.getLength() - 1]).toBe(0);
	});

	test('SdesPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, SC=1, PT:202, Length: 4
			0b10100001, 0xca, 0x00, 0x04,
			// Chunk 1
			// SSRC: 1234
			0x00, 0x00, 0x04, 0xd2,
			// Item type: 1 (CNAME), Length: 2, Text: "ab"
			0x01, 0x02, 0x61, 0x62,
			// 4 null octets
			0x00, 0x00, 0x00, 0x00,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
			// Extra space in the buffer
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
		]);
		const packet = SdesPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 20,
			packetType: RtcpPacketType.SDES,
			hasPadding: true,
			padding: 4,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getChunksCount()).toBe(1);
		expect(packet.getChunks()).toEqual([
			{ ssrc: 1234, items: [{ type: SdesItemType.CNAME, text: 'ab' }] },
		]);

		/* Modify it (it removes the padding). */

		packet.addChunk({ ssrc: 5678, items: [] });

		checkRtcpPacket(packet, {
			...expected,
			length: 24,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getChunksCount()).toBe(2);
		expect(packet.getChunks()[0]!.items.length).toBe(1);

		// The new chunk goes where the padding was.
		const packetBuffer = packet.getBuffer();
		const view = new DataView(
			packetBuffer.buffer,
			packetBuffer.byteOffset,
			packetBuffer.byteLength
		);

		expect(view.getUint32(16)).toBe(5678);
		expect(view.getUint32(20)).toBe(0);
	});

	test('SdesPacket.parse() fails', () => {
		// SC field announces 2 chunks but there is only 1.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, SC=2, PT:202, Length: 2
			0b10000010, 0xca, 0x00, 0x02,
			// SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// 4 null octets (no items)
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => SdesPacket.parse(buffer1)).toThrow(TypeError);

		// Item length exceeds the packet length.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, SC=1, PT:202, Length: 2
			0b10000001, 0xca, 0x00, 0x02,
			// SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// Item type: 1 (CNAME), Length: 20, Text: "ab"
			0x01, 0x14, 0x61, 0x62,
		]);

		expect(() => SdesPacket.parse(buffer2)).toThrow(TypeError);

		// Missing null octet terminating the items.
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, SC=1, PT:202, Length: 2
			0b10000001, 0xca, 0x00, 0x02,
			// SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// Item type: 1 (CNAME), Length: 2, Text: "ab"
			0x01, 0x02, 0x61, 0x62,
		]);

		expect(() => SdesPacket.parse(buffer3)).toThrow(TypeError);

		// Non null octet in the padding.
		// prettier-ignore
		const buffer4 = new Uint8Array([
			// V=2, P=0, SC=1, PT:202, Length: 3
			0b10000001, 0xca, 0x00, 0x03,
			// SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// Item type: 1 (CNAME), Length: 3, Text: "abc"
			0x01, 0x03, 0x61, 0x62,
			// End of text "c", null octet and 2 octets of padding (the last one
			// non null)
			0x63, 0x00, 0x00, 0x01,
		]);

		expect(() => SdesPacket.parse(buffer4)).toThrow(TypeError);

		// Length field should be 2 (12 bytes) since the packet must end right
		// after the last chunk, but it announces 4 extra bytes.
		// prettier-ignore
		const buffer5 = new Uint8Array([
			// V=2, P=0, SC=1, PT:202, Length: 3
			0b10000001, 0xca, 0x00, 0x03,
			// SSRC: 1111
			0x00, 0x00, 0x04, 0x57,
			// 4 null octets (no items)
			0x00, 0x00, 0x00, 0x00,
			// 4 extra bytes
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => SdesPacket.parse(buffer5)).toThrow(TypeError);
	});

	test('SdesPacket.factory() succeeds', () => {
		function checkChunks(packet: SdesPacket): void {
			const packetBuffer = packet.getBuffer();

			expect(packet.getChunksCount()).toBe(2);
			expect(packet.getChunks()).toEqual([
				{ ssrc: 1111, items: [{ type: SdesItemType.CNAME, text: 'foo' }] },
				{ ssrc: 2222, items: [{ type: SdesItemType.NOTE, text: 'bar baz' }] },
			]);

			// Check the null octet and padding bytes of the first chunk.
			expect(packetBuffer[13]).toBe(0);
			expect(packetBuffer[14]).toBe(0);
			expect(packetBuffer[15]).toBe(0);

			// Check the null octet and padding bytes of the second chunk.
			expect(packetBuffer[29]).toBe(0);
			expect(packetBuffer[30]).toBe(0);
			expect(packetBuffer[31]).toBe(0);
		}

		const packet = SdesPacket.factory(factoryBuffer);
		const expected: ExpectedRtcpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 4,
			packetType: RtcpPacketType.SDES,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getChunksCount()).toBe(0);
		expect(packet.getChunks()).toEqual([]);

		/* Modify it. */

		packet.addChunk({
			ssrc: 1111,
			items: [{ type: SdesItemType.CNAME, text: 'foo' }],
		});
		packet.addChunk({
			ssrc: 2222,
			items: [{ type: SdesItemType.NOTE, text: 'bar baz' }],
		});

		checkRtcpPacket(packet, { ...expected, length: 32 });

		checkChunks(packet);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		checkRtcpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 32,
		});

		checkChunks(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 32,
		});

		checkChunks(clonedPacket);
	});

	test('sdesPacket.addChunk() and sdesPacket.setChunks() throw', () => {
		const packet = SdesPacket.factory(factoryBuffer);

		for (let ssrc = 1; ssrc <= MAX_CHUNKS; ++ssrc) {
			packet.addChunk({ ssrc, items: [] });
		}

		expect(packet.getChunksCount()).toBe(31);
		expect(packet.getLength()).toBe(4 + 31 * 8);

		// No more than 31 chunks.
		expect(() => packet.addChunk({ ssrc: 32, items: [] })).toThrow(TypeError);

		expect(packet.getChunksCount()).toBe(31);
		expect(packet.getLength()).toBe(4 + 31 * 8);

		const text255 = 'a'.repeat(255);
		const text256 = 'a'.repeat(256);
		const chunks: SdesChunk[] = packet.getChunks();

		// No more than 255 bytes in the text.
		chunks[30]!.items = [{ type: SdesItemType.NAME, text: text256 }];

		expect(() => packet.setChunks(chunks)).toThrow(TypeError);

		expect(packet.getChunks().every(chunk => chunk.items.length === 0)).toBe(
			true
		);
		expect(packet.getLength()).toBe(4 + 31 * 8);

		// Item type 0 is not allowed since it terminates the list of items.
		chunks[30]!.items = [{ type: 0 as SdesItemType, text: 'a' }];

		expect(() => packet.setChunks(chunks)).toThrow(TypeError);

		expect(packet.getChunks().every(chunk => chunk.items.length === 0)).toBe(
			true
		);
		expect(packet.getLength()).toBe(4 + 31 * 8);

		chunks[30]!.items = [{ type: SdesItemType.NAME, text: text255 }];

		packet.setChunks(chunks);

		const lastChunk = packet.getChunks()[30]!;

		expect(lastChunk.ssrc).toBe(31);
		expect(lastChunk.items).toEqual([
			{ type: SdesItemType.NAME, text: text255 },
		]);

		// 4 (header) + 30 empty chunks + 1 chunk with SSRC, item header, item
		// text and null octet padded to 4 bytes.
		expect(packet.getLength()).toBe(4 + 30 * 8 + 264);
	});

	test('sdesPacket.setChunks() throws if there is no space in the buffer', () => {
		const packet = SdesPacket.factory(factoryBuffer.subarray(0, 12));

		packet.addChunk({ ssrc: 1111, items: [] });

		expect(packet.getLength()).toBe(12);

		// The item would need 16 bytes in total.
		expect(() =>
			packet.setChunks([
				{ ssrc: 1111, items: [{ type: SdesItemType.CNAME, text: 'abcd' }] },
			])
		).toThrow(TypeError);

		expect(packet.getLength()).toBe(12);
		expect(packet.getChunksCount()).toBe(1);
		expect(packet.getChunks()).toEqual([{ ssrc: 1111, items: [] }]);
	});

	test('SdesPacket with a chunk whose null octet ends at a 32-bit boundary', () => {
		function checkChunks(packet: SdesPacket): void {
			expect(packet.getChunksCount()).toBe(2);
			expect(packet.getChunks()).toEqual([
				{
					ssrc: 0x11223344,
					items: [{ type: SdesItemType.LOC, text: 'abcdefghijklmnopq' }],
				},
				{ ssrc: 5678, items: [{ type: SdesItemType.CNAME, text: 'ab' }] },
			]);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, SC=2, PT:202, Length: 9
			0b10000010, 0xca, 0x00, 0x09,
			// Chunk 1
			// SSRC: 0x11223344
			0x11, 0x22, 0x33, 0x44,
			// Item type: 5 (LOC), Length: 17, Text: "abcdefghijklmnopq"
			0x05, 0x11, 0x61, 0x62,
			0x63, 0x64, 0x65, 0x66,
			0x67, 0x68, 0x69, 0x6a,
			0x6b, 0x6c, 0x6d, 0x6e,
			// End of text "opq" and null octet (no padding)
			0x6f, 0x70, 0x71, 0x00,
			// Chunk 2
			// SSRC: 5678
			0x00, 0x00, 0x16, 0x2e,
			// Item type: 1 (CNAME), Length: 2, Text: "ab"
			0x01, 0x02, 0x61, 0x62,
			// Null octet and 3 octets of padding
			0x00, 0x00, 0x00, 0x00,
		]);

		/* Parse it. */

		const parsedPacket = SdesPacket.parse(buffer);

		checkRtcpPacket(parsedPacket, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 40,
			packetType: RtcpPacketType.SDES,
			hasPadding: false,
			padding: 0,
		});

		checkChunks(parsedPacket);

		/* Build the same packet. */

		const packet = SdesPacket.factory(factoryBuffer);

		packet.addChunk({
			ssrc: 0x11223344,
			items: [{ type: SdesItemType.LOC, text: 'abcdefghijklmnopq' }],
		});

		expect(packet.getLength()).toBe(28);

		packet.addChunk({
			ssrc: 5678,
			items: [{ type: SdesItemType.CNAME, text: 'ab' }],
		});

		checkRtcpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 40,
			packetType: RtcpPacketType.SDES,
			hasPadding: false,
			padding: 0,
		});

		checkChunks(packet);

		expect(areBuffersEqual(packet.getBuffer(), buffer)).toBe(true);
	});

	test('SdesPacket.computeChunkLengthFor() succeeds', () => {
		// The SSRC/CSRC and the null octet, padded to 4 bytes.
		expect(SdesPacket.computeChunkLengthFor([])).toBe(8);

		const packet = SdesPacket.factory(factoryBuffer);
		const lengthBefore = packet.getLength();

		packet.addChunk({
			ssrc: 1111,
			items: [
				{ type: SdesItemType.CNAME, text: 'abc' },
				{ type: SdesItemType.NAME, text: 'de' },
			],
		});

		// 4 + (2 + 3) + (2 + 2) + 1, padded to 4 bytes.
		expect(SdesPacket.computeChunkLengthFor([3, 2])).toBe(16);
		expect(packet.getLength() - lengthBefore).toBe(
			SdesPacket.computeChunkLengthFor([3, 2])
		);
	});

	test('SdesPacket.computeLengthFor() succeeds', () => {
		expect(SdesPacket.computeLengthFor(0)).toBe(4);

		const packet = SdesPacket.factory(factoryBuffer);

		packet.addChunk({
			ssrc: 1111,
			items: [{ type: SdesItemType.CNAME, text: 'abc' }],
		});
		packet.addChunk({
			ssrc: 2222,
			items: [{ type: SdesItemType.CNAME, text: 'defgh' }],
		});

		const length = SdesPacket.computeLengthFor(
			SdesPacket.computeChunkLengthFor([3]) +
				SdesPacket.computeChunkLengthFor([5])
		);

		// 4 + (4 + 2 + 3 + 1 -> 12) + (4 + 2 + 5 + 1 -> 12).
		expect(length).toBe(28);
		expect(packet.getLength()).toBe(length);
	});
});
