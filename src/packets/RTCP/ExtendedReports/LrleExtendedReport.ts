import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	COMMON_HEADER_LENGTH
} from './ExtendedReport';
import { padTo4Bytes } from '../../../utils/helpers';
import {
	readBitsInDataView,
	writeBitsInDataView
} from '../../../utils/bitOps';

// Common header + SSRC of source + begin seq + end seq.
const LRLE_EXTENDED_REPORT_MIN_LENGTH = COMMON_HEADER_LENGTH + 8;

/**
 * Loss RLE Extended Report dump.
 *
 * @category RTCP Extended Reports
 */
export type LrleExtendedReportDump = ExtendedReportDump &
{
	thinning: number;
	ssrc: number;
	beginSeq: number;
	endSeq: number;
	chunks: number[];
};

/**
 * Loss RLE Extended Report.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=1      | rsvd. |   T   |         block length          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                        SSRC of source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |          begin_seq            |             end_seq           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |          chunk 1              |             chunk 2           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |          chunk n-1            |             chunk n           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP Extended Reports
 *
 * @see
 * - [RFC 3611 section 4.1](https://datatracker.ietf.org/doc/html/rfc3611#section-4.1)
 */
export class LrleExtendedReport extends ExtendedReport
{
	// Chunks (2 bytes numbers, unparsed).
	#chunks: number[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty Loss RLE
	 *   Extended Report will be created.
	 */
	constructor(view?: DataView)
	{
		super(ExtendedReportType.LRLE, view);

		if (!this.view)
		{
			this.view = new DataView(
				new ArrayBuffer(LRLE_EXTENDED_REPORT_MIN_LENGTH)
			);

			// Write report type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength < LRLE_EXTENDED_REPORT_MIN_LENGTH)
		{
			throw new TypeError('wrong byte length for a Loss RLE Extended Report');
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to chunks.
		pos += LRLE_EXTENDED_REPORT_MIN_LENGTH;

		while (pos < this.view.byteLength)
		{
			const chunk = this.view.getUint16(pos);

			if (chunk === 0)
			{
				break;
			}

			this.#chunks.push(chunk);

			pos += 2;
		}
	}

	/**
	 * Dump Loss RLE Extended Report info.
	 */
	dump(): LrleExtendedReportDump
	{
		return {
			...super.dump(),
			thinning : this.getThinning(),
			ssrc     : this.getSsrc(),
			beginSeq : this.getBeginSeq(),
			endSeq   : this.getEndSeq(),
			chunks   : this.getChunks()
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

		// Common header + SSRC + begin seq + end seq.
		let reportLength = LRLE_EXTENDED_REPORT_MIN_LENGTH;

		// Add chunks.
		reportLength += this.#chunks.length * 2;

		// The list of chunks must terminate in terminating null chunks, which
		// basically means padding them to 4 bytes.
		reportLength = padTo4Bytes(reportLength);

		return reportLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void
	{
		const view = this.serializeBase(buffer, byteOffset);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to the fixed header fields after the common header.
		pos += COMMON_HEADER_LENGTH;

		// Copy the rest of the fixed fields into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset + pos,
				LRLE_EXTENDED_REPORT_MIN_LENGTH - COMMON_HEADER_LENGTH
			),
			pos
		);

		// Move to chunks.
		pos += LRLE_EXTENDED_REPORT_MIN_LENGTH - COMMON_HEADER_LENGTH;

		// Copy chunks.
		for (const chunk of this.#chunks)
		{
			view.setUint16(pos, chunk);

			pos += 2;
		}

		// NOTE: Must pad the content to 4 bytes.
		pos = padTo4Bytes(pos);

		if (pos !== view.byteLength)
		{
			throw new RangeError(
				`filled length (${pos} bytes) does not match the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number
	): LrleExtendedReport
	{
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new LrleExtendedReport(view);
	}

	/**
	 * Get thinning.
	 */
	getThinning(): number
	{
		return readBitsInDataView({ view: this.view, pos: 1, mask: 0x0F });
	}

	/**
	 * Set thinning.
	 */
	setThinning(thinning: number): void
	{
		writeBitsInDataView(
			{ view: this.view, pos: 1, mask: 0x0F, value: thinning }
		);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get SSRC of source.
	 */
	getSsrc(): number
	{
		return this.view.getUint32(4);
	}

	/**
	 * Set SSRC of source.
	 */
	setSsrc(ssrc: number): void
	{
		this.view.setUint32(4, ssrc);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get begin sequence number.
	 */
	getBeginSeq(): number
	{
		return this.view.getUint16(8);
	}

	/**
	 * Set begin sequence number.
	 */
	setBeginSeq(seq: number): void
	{
		this.view.setUint16(8, seq);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get end sequence number.
	 */
	getEndSeq(): number
	{
		return this.view.getUint16(10);
	}

	/**
	 * Set end sequence number.
	 */
	setEndSeq(seq: number): void
	{
		this.view.setUint16(10, seq);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get chunks.
	 *
	 * @remarks
	 * - Chunks are given as a list of 2 byte integers.
	 * - Use {@link parseExtendedReportChunk} to parse them.
	 */
	getChunks(): number[]
	{
		return Array.from(this.#chunks);
	}

	/**
	 * Set chunks.
	 *
	 * @remarks
	 * - Chunks must be given as a list of 2 byte integers.
	 * - Use {@link createExtendedReportRunLengthChunk} or
	 *   {@link createExtendedReportBitVectorChunk} to create them.
	 */
	setChunks(chunks: number[]): void
	{
		this.#chunks = Array.from(chunks);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add chunk.
	 *
	 * @remarks
	 * - Chunk must be given as 2 byte integer.
	 * - Use {@link createExtendedReportRunLengthChunk} or
	 *   {@link createExtendedReportBitVectorChunk} to create it.
	 * - Given chunk cannot be a terminating null chunk (0 number).
	 */
	addChunk(chunk: number): void
	{
		if (chunk === 0)
		{
			throw new TypeError('cannot add terminating null chunks');
		}

		this.#chunks.push(chunk);

		this.setSerializationNeeded(true);
	}
}
