import {
	RtcpPacket,
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacketDump,
} from './RtcpPacket.js';
import {
	isUnsignedInteger8,
	isUnsignedInteger32,
} from '../../utils/numbers.js';
import { padTo4Bytes } from '../../utils/buffers.js';

/**
 * Maximum number of chunks in a SDES packet (the SC field has 5 bits).
 */
const MAX_CHUNKS = 31;

/**
 * Maximum length (in bytes) of the text of a SDES item.
 */
const MAX_ITEM_TEXT_LENGTH = 255;

const textEncoder = new TextEncoder();
// NOTE: `ignoreBOM` keeps a leading byte order mark in the decoded text, so
// valid UTF-8 is written back byte by byte as it was.
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });

/**
 * SDES item type.
 */
export enum SdesItemType {
	/**
	 * Canonical End-Point Identifier.
	 */
	CNAME = 1,
	/**
	 * User Name.
	 */
	NAME = 2,
	/**
	 * Electronic Mail Address.
	 */
	EMAIL = 3,
	/**
	 * Phone Number.
	 */
	PHONE = 4,
	/**
	 * Geographic User Location.
	 */
	LOC = 5,
	/**
	 * Application or Tool Name.
	 */
	TOOL = 6,
	/**
	 * Notice/Status.
	 */
	NOTE = 7,
	/**
	 * Private Extensions.
	 */
	PRIV = 8,
}

/**
 * SDES item.
 */
export type SdesItem = {
	/**
	 * Item type. In a parsed packet it may not be a member of
	 * {@link SdesItemType}.
	 */
	type: SdesItemType;
	/**
	 * Item text (UTF-8).
	 */
	text: string;
};

/**
 * SDES chunk.
 */
export type SdesChunk = {
	/**
	 * SSRC/CSRC of the chunk.
	 */
	ssrc: number;
	/**
	 * Items of the chunk.
	 */
	items: SdesItem[];
};

/**
 * RTCP SDES packet info dump.
 */
export type SdesPacketDump = RtcpPacketDump & {
	/**
	 * SDES chunks.
	 */
	chunks: SdesChunk[];
};

/**
 * SDES chunk whose item texts are already encoded.
 */
type EncodedSdesChunk = {
	ssrc: number;
	items: { type: SdesItemType; text: Uint8Array }[];
};

/**
 * RTCP SDES packet.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|    SC   |  PT=SDES=202  |             Length            |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |                          SSRC/CSRC_1                          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                           SDES items                          |
 * |                              ...                              |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |                          SSRC/CSRC_2                          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                           SDES items                          |
 * |                              ...                              |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * ```
 *
 * - Source count (SC) (5 bits): The number of SSRC/CSRC chunks contained in
 *   this SDES packet.
 * - Chunk: A SSRC/CSRC identifier followed by a list of zero or more items.
 *   Each chunk starts on a 32-bit boundary.
 *
 * Each SDES item:
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     Type      |    Length     |         Text               ...
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * - Type (8 bits): Item type.
 * - Length (8 bits): Number of bytes of the text.
 * - Text (variable length): Item text, with no padding.
 *
 * The list of items in each chunk is terminated by a null octet (which is
 * interpreted as an item type of 0), followed by null octets to pad the chunk
 * until the next 32-bit boundary.
 *
 * @remarks
 * - The text of every item is decoded as UTF-8, so the prefix of the PRIV
 *   item is not interpreted.
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized. Modifications that need more bytes throw if
 *   the buffer has no space for them, in which case the packet is not
 *   modified.
 *
 * @see
 * - [RFC 3550 section 6.5](https://datatracker.ietf.org/doc/html/rfc3550#section-6.5)
 */
export class SdesPacket extends RtcpPacket {
	/**
	 * Parse a RTCP SDES packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP SDES packet.
	 */
	static parse(buffer: Uint8Array): SdesPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new SdesPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.SDES);
		packet.#validate();

		return packet;
	}

	/**
	 * Create a RTCP SDES packet with no chunks.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than the length of the
	 *   Common Header.
	 */
	static factory(buffer: Uint8Array): SdesPacket {
		const packet = new SdesPacket(buffer);

		packet.initializeHeader(RtcpPacketType.SDES, 0, COMMON_HEADER_LENGTH);

		return packet;
	}

	/**
	 * Length (in bytes) of a RTCP SDES packet carrying the given chunks.
	 *
	 * @param chunksLength - Sum of what {@link computeChunkLengthFor} returns
	 *   for each chunk the packet will carry.
	 *
	 * @internal
	 */
	static computeLengthFor(chunksLength: number): number {
		// The chunks go right after the Common Header, and each one is already
		// padded to 4 bytes.
		return COMMON_HEADER_LENGTH + chunksLength;
	}

	/**
	 * Length (in bytes) of a chunk carrying items with texts of the given
	 * lengths, padding included.
	 *
	 * @param itemTextLengths - Length (in bytes) of the UTF-8 encoded text of
	 *   each item.
	 *
	 * @internal
	 */
	static computeChunkLengthFor(itemTextLengths: number[]): number {
		// The SSRC/CSRC (4 bytes).
		let length = 4;

		// Each item takes its type and length (1 byte each) and its text.
		for (const itemTextLength of itemTextLengths) {
			length += 2 + itemTextLength;
		}

		// The null octet that terminates the list of items, and the padding up to
		// the next 32-bit boundary.
		return padTo4Bytes(length + 1);
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP SDES packet info.
	 */
	override dump(): SdesPacketDump {
		return {
			...super.dump(),
			chunks: this.getChunks(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): SdesPacket {
		const clonedPacket = new SdesPacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	/**
	 * Get the number of chunks (value of the SC field).
	 */
	getChunksCount(): number {
		return this.getCount();
	}

	/**
	 * Get the chunks.
	 */
	getChunks(): SdesChunk[] {
		const view = this.getView();
		const buffer = this.getBuffer();
		const chunksCount = this.getChunksCount();
		const chunks: SdesChunk[] = [];

		let pos = COMMON_HEADER_LENGTH;

		for (let chunkIdx = 0; chunkIdx < chunksCount; ++chunkIdx) {
			const chunk: SdesChunk = { ssrc: view.getUint32(pos), items: [] };

			pos += 4;

			while (view.getUint8(pos) !== 0) {
				const textLength = view.getUint8(pos + 1);

				chunk.items.push({
					type: view.getUint8(pos),
					text: textDecoder.decode(
						buffer.subarray(pos + 2, pos + 2 + textLength)
					),
				});

				pos += 2 + textLength;
			}

			chunks.push(chunk);

			// The null octet and the padding until the next 32-bit boundary.
			pos = padTo4Bytes(pos + 1);
		}

		return chunks;
	}

	/**
	 * Set the chunks. If `chunks` is not given (or if it's an empty array) all
	 * chunks are removed.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if more than 31 chunks are given.
	 * - `TypeError` if some chunk is not valid (see {@link addChunk}).
	 * - `TypeError` if the buffer has no space for the given chunks.
	 */
	setChunks(chunks: SdesChunk[] = []): void {
		if (chunks.length > MAX_CHUNKS) {
			throw new TypeError(
				`cannot set more than ${MAX_CHUNKS} chunks (${chunks.length} given)`
			);
		}

		const encodedChunks = chunks.map(chunk => this.#encodeChunk(chunk));
		let chunksLength = 0;

		for (const encodedChunk of encodedChunks) {
			chunksLength += this.#computeEncodedChunkLength(encodedChunk);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(chunksLength);

		let pos = COMMON_HEADER_LENGTH;

		for (const encodedChunk of encodedChunks) {
			pos = this.#writeChunk(pos, encodedChunk);
		}

		this.setCount(chunks.length);
	}

	/**
	 * Add a chunk at the end of the packet.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if the packet already has 31 chunks.
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295.
	 * - `TypeError` if the type of some item is not an integer between 1 and
	 *   255.
	 * - `TypeError` if the UTF-8 encoded text of some item is longer than 255
	 *   bytes.
	 * - `TypeError` if the buffer has no space for the chunk.
	 */
	addChunk(chunk: SdesChunk): void {
		const chunksCount = this.getChunksCount();

		if (chunksCount === MAX_CHUNKS) {
			throw new TypeError(`cannot add more than ${MAX_CHUNKS} chunks`);
		}

		const encodedChunk = this.#encodeChunk(chunk);
		// The packet (excluding padding) ends right after the last chunk.
		const pos = this.getLength() - this.getPadding();

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(
			this.getBodyLength() + this.#computeEncodedChunkLength(encodedChunk)
		);

		this.#writeChunk(pos, encodedChunk);

		this.setCount(chunksCount + 1);
	}

	#validate(): void {
		const view = this.getView();
		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();
		const chunksCount = this.getChunksCount();

		let pos = COMMON_HEADER_LENGTH;

		for (let chunkIdx = 0; chunkIdx < chunksCount; ++chunkIdx) {
			// SSRC/CSRC of the chunk.
			if (pos + 4 > contentLength) {
				throw new TypeError(`no space for SSRC/CSRC of chunk ${chunkIdx}`);
			}

			pos += 4;

			// Items until the null octet that terminates the list.
			while (true) {
				if (pos >= contentLength) {
					throw new TypeError(
						`missing null octet terminating the items of chunk ${chunkIdx}`
					);
				}

				if (view.getUint8(pos) === 0) {
					break;
				}

				if (pos + 2 > contentLength) {
					throw new TypeError(`no space for item header in chunk ${chunkIdx}`);
				}

				const textLength = view.getUint8(pos + 1);

				if (pos + 2 + textLength > contentLength) {
					throw new TypeError(
						`item length (${textLength} bytes) exceeds the packet length in chunk ${chunkIdx}`
					);
				}

				pos += 2 + textLength;
			}

			// The null octet and the padding until the next 32-bit boundary.
			const chunkEndPos = padTo4Bytes(pos + 1);

			if (chunkEndPos > contentLength) {
				throw new TypeError(`no space for padding of chunk ${chunkIdx}`);
			}

			for (; pos < chunkEndPos; ++pos) {
				if (view.getUint8(pos) !== 0) {
					throw new TypeError(`non null octet in padding of chunk ${chunkIdx}`);
				}
			}
		}

		// The packet (excluding padding) must end right after the last chunk.
		if (pos !== contentLength) {
			throw new TypeError(
				`packet length (${contentLength} bytes, excluding padding) does not end right after the last chunk (${pos} bytes)`
			);
		}
	}

	/**
	 * Validate the given chunk and encode the texts of its items.
	 *
	 * @throws
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295.
	 * - `TypeError` if the type of some item is not an integer between 1 and
	 *   255.
	 * - `TypeError` if the UTF-8 encoded text of some item is longer than 255
	 *   bytes.
	 */
	#encodeChunk(chunk: SdesChunk): EncodedSdesChunk {
		if (!isUnsignedInteger32(chunk.ssrc)) {
			throw new TypeError(
				`ssrc (${chunk.ssrc}) must be an integer between 0 and 4294967295`
			);
		}

		const items = chunk.items.map(({ type, text }) => {
			// An item type of 0 terminates the list of items, so it's not valid.
			if (!isUnsignedInteger8(type) || (type as number) === 0) {
				throw new TypeError(
					`item type (${type}) must be an integer between 1 and 255`
				);
			}

			const encodedText = textEncoder.encode(text);

			if (encodedText.byteLength > MAX_ITEM_TEXT_LENGTH) {
				throw new TypeError(
					`item text length (${encodedText.byteLength} bytes) cannot be greater than ${MAX_ITEM_TEXT_LENGTH} bytes`
				);
			}

			return { type, text: encodedText };
		});

		return { ssrc: chunk.ssrc, items };
	}

	#computeEncodedChunkLength(encodedChunk: EncodedSdesChunk): number {
		return SdesPacket.computeChunkLengthFor(
			encodedChunk.items.map(item => item.text.byteLength)
		);
	}

	/**
	 * Write the given chunk at the given position, including the null octet
	 * that terminates its list of items and its padding.
	 *
	 * @returns Position where the chunk ends.
	 */
	#writeChunk(pos: number, encodedChunk: EncodedSdesChunk): number {
		const view = this.getView();
		const buffer = this.getBuffer();
		const chunkEndPos = pos + this.#computeEncodedChunkLength(encodedChunk);

		view.setUint32(pos, encodedChunk.ssrc);

		pos += 4;

		for (const { type, text } of encodedChunk.items) {
			view.setUint8(pos, type);
			view.setUint8(pos + 1, text.byteLength);
			buffer.set(text, pos + 2);

			pos += 2 + text.byteLength;
		}

		// The null octet that terminates the list of items and the padding.
		buffer.fill(0, pos, chunkEndPos);

		return chunkEndPos;
	}
}
