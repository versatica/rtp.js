import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	getExtendedReportLength,
	COMMON_HEADER_LENGTH
} from './ExtendedReport';
import { padTo4Bytes } from '../../utils';
import { readBitsInDataView, writeBitsInDataView } from '../../bitOps';

/**
 * 0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=2      | rsvd. |   T   |         block length          |
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
 */

// Common header + SSRC + begin seq + end seq.
const EXTENDED_REPORT_DRLE_MIN_LENGTH = COMMON_HEADER_LENGTH + 8;

/**
 * Duplicate RLE Extended Report dump.
 */
export type ExtendedReportDRLEDump = ExtendedReportDump &
{
	thinning: number;
	ssrc: number;
	beginSeq: number;
	endSeq: number;
	chunks: number[];
};

/**
 * Duplicate RLE Extended Report.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class ExtendedReportDRLE extends ExtendedReport
{
	// Chunks (2 bytes numbers, unparsed).
	#chunks: number[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty Duplicate RLE
	 *   Extended Report will be created.
	 */
	constructor(view?: DataView)
	{
		super(ExtendedReportType.DRLE, view);

		if (!this.view)
		{
			this.view = new DataView(
				new ArrayBuffer(EXTENDED_REPORT_DRLE_MIN_LENGTH)
			);

			// Write report type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength < EXTENDED_REPORT_DRLE_MIN_LENGTH)
		{
			throw new TypeError(
				'wrong byte length for a Duplicate RLE Extended Report'
			);
		}
		else if (this.view.byteLength % 4 !== 0)
		{
			throw new RangeError(
				`Duplicate RLE Extended Report length must be multiple of 4 bytes but it is ${this.view.byteLength} bytes`
			);
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to chunks.
		pos += EXTENDED_REPORT_DRLE_MIN_LENGTH;

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
	 * Dump Duplicate RLE Extended Report info.
	 */
	dump(): ExtendedReportDRLEDump
	{
		return {
			...super.dump(),
			thinning : this.getThinning(),
			ssrc     : this.getSsrc(),
			beginSeq : this.getBeginSeq(),
			endSeq   : this.getEndSeq(),
			chunks   : Array.from(this.#chunks)
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
		let reportLength = EXTENDED_REPORT_DRLE_MIN_LENGTH;

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
	serialize(): void
	{
		const view = super.serializeBase();

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to source of SSRC.
		pos += 4;

		// Copy the SSRC.
		view.setUint32(pos, this.getSsrc());

		// Move to being seq.
		pos += 4;

		// Copy being seq.
		view.setUint16(pos, this.getBeginSeq());

		// Move to end seq.
		pos += 2;

		// Copy end seq.
		view.setUint16(pos, this.getEndSeq());

		// Move to chunks.
		pos += 2;

		// Copy chunks.
		for (const chunk of this.#chunks)
		{
			view.setUint16(pos, chunk);

			pos += 2;
		}

		// NOTE: No need to care about chunk padding since the obtained buffer
		// has the proper size (multiple of 4 bytes) and is filled with zeroes.

		// Assert that RTCP header length field is correct.
		if (getExtendedReportLength(view) !== view.byteLength)
		{
			throw new RangeError(
				`length in the Extended Report header (${getExtendedReportLength(view)} bytes) does not match the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): ExtendedReportDRLE
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new ExtendedReportDRLE(view);
	}

	/**
	 * Get thinning.
	 */
	getThinning(): number
	{
		return readBitsInDataView({ view: this.view, byte: 1, mask: 0x0F });
	}

	/**
	 * Set thinning.
	 */
	setThinning(thinning: number): void
	{
		writeBitsInDataView(
			{ view: this.view, byte: 1, mask: 0x0F, value: thinning }
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
