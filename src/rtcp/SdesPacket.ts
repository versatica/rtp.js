import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	getRtcpLength,
	COMMON_HEADER_LENGTH
} from './RtcpPacket';
import { Serializable } from '../Serializable';
import {
	padTo4Bytes,
	dataViewToString,
	stringToUint8Array,
	getStringByteLength
} from '../utils';

/**
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    SC   |  PT=SDES=202  |             length            |
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * chunk  |                          SSRC/CSRC_1                          |
 *   1    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                           SDES items                          |
 *        |                              ...                              |
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * chunk  |                          SSRC/CSRC_2                          |
 *   2    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                           SDES items                          |
 *        |                              ...                              |
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 */

// SSRC (4 bytes) + null type (1 byte) + padding (3 bytes).
const SDES_CHUNK_MIN_LENGTH = 8;

/**
 * SDES Chunk Item types.
 */
// ESLint absurdly complains about "'SdesItemType' is already declared in the
// upper scope".
// eslint-disable-next-line no-shadow
export enum SdesItemType
{
	/**
	 * Canonical End-Point Identifier SDES Item.
	 */
	CNAME = 1,
	/**
	 * User Name SDES Item.
	 */
	NAME = 2,
	/**
	 * Electronic Mail Address SDES Item.
	 */
	EMAIL = 3,
	/**
	 * Phone Number SDES Item.
	 */
	PHONE = 4,
	/**
	 * Geographic User Location SDES Item.
	 */
	LOC = 5,
	/**
	 * Application or Tool Name SDES Item.
	 */
	TOOL = 6,
	/**
	 * Notice/Status SDES Item.
	 */
	NOTE = 7,
	/**
	 * Private Extensions SDES Item.
	 */
	PRIV = 8
}

/**
 * RTCP SDES packet info dump.
 */
export type SdesPacketDump = RtcpPacketDump &
{
	chunks: SdesChunkDump[];
};

/**
 * SDES Chunk dump.
 */
export type SdesChunkDump =
{
	ssrc: number;
	items: { type: SdesItemType; text: string }[];
};

/**
 * RTCP SDES packet.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class SdesPacket extends RtcpPacket
{
	// SDES Chunks.
	#chunks: SdesChunk[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP SDES
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP SDES packet.
	 */
	constructor(view?: DataView)
	{
		super(RtcpPacketType.SDES, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(COMMON_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to chunks.
		pos += COMMON_HEADER_LENGTH;

		let count = this.getCount();

		while (count-- > 0)
		{
			const chunkPos = pos;
			let chunkLength = 0;

			// First 4 bytes contain the chunk's ssrc.
			pos += 4;
			chunkLength += 4;

			// Read the length of all items in this chunk until we find an item with
			// type 0.
			while (pos < this.view.byteLength - this.padding)
			{
				const itemType = this.view.getUint8(pos);

				++pos;
				++chunkLength;

				// Item type 0 means padding (to both indicate end of items and also
				// beginning of padding).
				if (itemType === 0)
				{
					// Read up to 3 more additional null octests.
					let additionalNumNullOctets = 0;

					while (
						pos < this.view.byteLength - this.padding &&
						additionalNumNullOctets < 3 &&
						this.view.getUint8(pos) === 0
					)
					{
						++pos;
						++chunkLength;
						++additionalNumNullOctets;
					}

					break;
				}

				const itemLength = this.view.getUint8(pos);

				++pos;
				++chunkLength;

				pos += itemLength;
				chunkLength += itemLength;
			}

			const chunkView = new DataView(
				this.view.buffer,
				this.view.byteOffset + chunkPos,
				chunkLength
			);

			const chunk = new SdesChunk(chunkView);

			this.#chunks.push(chunk);
		}

		if (this.#chunks.length !== this.getCount())
		{
			throw new RangeError(
				`num of parsed SDES Chunks (${this.#chunks.length}) doesn't match RTCP count field ({${this.getCount()}})`
			);
		}

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump Receiver Report packet info.
	 */
	dump(): SdesPacketDump
	{
		return {
			...super.dump(),
			chunks : this.#chunks.map((chunk) => chunk.dump())
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		if (!this.needsSerialization())
		{
			return this.view.byteLength;
		}

		const packetLength =
			COMMON_HEADER_LENGTH +
			this.#chunks.reduce(
				(sum, chunk) => sum + chunk.getByteLength(),
				0
			) +
			this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	needsSerialization(): boolean
	{
		return (
			super.needsSerialization() ||
			this.#chunks.some((chunk) => chunk.needsSerialization())
		);
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const view = super.serializeBase();

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to chunks.
		pos += COMMON_HEADER_LENGTH;

		// Write chunks.
		for (const chunk of this.#chunks)
		{
			// Serialize the chunk into the current position.
			chunk.prependOnceListener('will-serialize', (length, cb) =>
			{
				cb(view.buffer, view.byteOffset + pos);

				pos += length;
			});

			chunk.serialize();
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength)
		{
			throw new RangeError(
				`computed packet length (${pos} bytes) is different than the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Assert that RTCP header length field is correct.
		if (getRtcpLength(view) !== view.byteLength)
		{
			throw new RangeError(
				`length in the RTCP header (${getRtcpLength(view)} bytes) does not match the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): SdesPacket
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new SdesPacket(view);
	}

	/**
	 * Get SDES Chunks.
	 */
	getChunks(): SdesChunk[]
	{
		return Array.from(this.#chunks);
	}

	/**
	 * Set SDES Chunks.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setChunks(chunks: SdesChunk[]): void
	{
		this.#chunks = Array.from(chunks);

		// Update RTCP count.
		this.setCount(this.#chunks.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add SDES Chunk.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	addChunk(chunk: SdesChunk): void
	{
		this.#chunks.push(chunk);

		// Update RTCP count.
		this.setCount(this.#chunks.length);

		this.setSerializationNeeded(true);
	}
}

/**
 * SDES Chunk.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class SdesChunk extends Serializable
{
	// SDES Items indexed by type with text as value.
	readonly #items: Map<SdesItemType, string> = new Map();

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP SDES
	 *   Chunk will be created.
	 */
	constructor(view?: DataView)
	{
		super(view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(SDES_CHUNK_MIN_LENGTH));

			return;
		}

		if (this.view.byteLength < SDES_CHUNK_MIN_LENGTH)
		{
			throw new TypeError('wrong byte length for a SDES Chunk');
		}
		else if (this.view.byteLength % 4 !== 0)
		{
			throw new RangeError(`SDES Chunk length must be multiple of 4 bytes but it is ${this.view.byteLength} bytes`);
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to items.
		pos += 4;

		while (pos < this.view.byteLength)
		{
			const itemType = this.view.getUint8(pos);

			// NOTE: Don't increase pos here since we don't want it increased if 0.

			// Item type 0 means padding.
			if (itemType === 0)
			{
				break;
			}

			// So increase it here.
			++pos;

			const itemLength = this.view.getUint8(pos);

			++pos;

			const itemView = new DataView(
				this.view.buffer,
				this.view.byteOffset + pos,
				itemLength
			);

			pos += itemLength;

			this.#items.set(itemType, dataViewToString(itemView));
		}

		// There must be a null octet at the end of the items and up to 3 more null
		// octets to pad the chunk to 4 bytes.
		const numNullOctets = this.view.byteLength - pos;

		if (numNullOctets < 1 || numNullOctets > 4)
		{
			throw new RangeError(`SDES Chunk has wrong number of null octests at the end (${numNullOctets} null octets)`);
		}
	}

	/**
	 * Dump SDES Chunk info.
	 */
	dump(): SdesChunkDump
	{
		const items = Array.from(this.#items)
			.map(([ itemType, itemText ]) =>
			{
				return {
					type : itemType,
					text : itemText
				};
			});

		return {
			ssrc  : this.getSsrc(),
			items : items
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		// SSRC (4 bytes).
		let chunkLength = 4;

		chunkLength += Array.from(this.#items.values())
			.reduce(
				(sum, text) =>
				{
					// Item type field + item length field + text length.
					return sum + 2 + getStringByteLength(text);
				},
				0
			);

		// The list of items in each chunk MUST be terminated by one or more null
		// octets, so add a byte to hold a null byte.
		++chunkLength;

		// Each chunk must be padded to 4 bytes.
		chunkLength = padTo4Bytes(chunkLength);

		return chunkLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const chunkLength = this.getByteLength();
		const { buffer, byteOffset } = this.getSerializationBuffer(chunkLength);
		const view = new DataView(buffer, byteOffset, chunkLength);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		let pos = 0;

		// Copy the SSRC.
		view.setUint32(pos, this.getSsrc());

		// Move to items.
		pos += 4;

		for (const [ itemType, itemText ] of this.#items)
		{
			const itemUint8Array = stringToUint8Array(itemText);

			view.setUint8(pos, itemType);
			view.setUint8(pos + 1, itemUint8Array.byteLength);

			pos += 2;

			uint8Array.set(itemUint8Array, pos);

			pos += itemUint8Array.byteLength;
		}

		// NOTE: No need to care about chunk padding since the obtained buffer
		// has the proper size (multiple of 4 bytes) and is filled with zeroes.

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): SdesChunk
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new SdesChunk(view);
	}

	/**
	 * Get SDES Chunk SSRC.
	 */
	getSsrc(): number
	{
		return this.view.getUint32(0);
	}

	/**
	 * Set SDES Chunk SSRC.
	 */
	setSsrc(ssrc: number): void
	{
		this.view.setUint32(0, ssrc);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the value of the SDES Item with given `type`.
	 */
	getItem(type: SdesItemType): string | undefined
	{
		return this.#items.get(type);
	}

	/**
	 * Get a map with all the SDES Items indexed by their type.
	 */
	getItems(): Map<SdesItemType, string>
	{
		return new Map(this.#items);
	}

	/**
	 * Set the value of the SDES Item with given `type`.
	 */
	setItem(type: SdesItemType, text: string): void
	{
		this.#items.set(type, text);

		this.setSerializationNeeded(true);
	}

	/**
	 * Delete the SDES Item with given `type`.
	 */
	deleteItem(type: SdesItemType): void
	{
		if (!this.#items.delete(type))
		{
			return;
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Clear all SDES Items.
	 */
	clearItems(): void
	{
		if (this.#items.size === 0)
		{
			return;
		}

		this.#items.clear();

		this.setSerializationNeeded(true);
	}
}
