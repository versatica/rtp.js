import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	COMMON_HEADER_LENGTH
} from './ExtendedReport';
import { readBitsInDataView, writeBitsInDataView } from '../../bitOps';

/**
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=3      | rsvd. |   T   |         block length          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                        SSRC of source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |          begin_seq            |             end_seq           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |       Receipt time of packet begin_seq                        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |       Receipt time of packet (begin_seq + 1) mod 65536        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |       Receipt time of packet (end_seq - 1) mod 65536          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
*/

// Common header + SSRC of source + begin seq + end seq.
const EXTENDED_REPORT_PRT_MIN_LENGTH = COMMON_HEADER_LENGTH + 8;

/**
 * Packet Receipt Times Extended Report dump.
 */
export type ExtendedReportPRTDump = ExtendedReportDump &
{
	thinning: number;
	ssrc: number;
	beginSeq: number;
	endSeq: number;
	receiptTimes: number[];
};

/**
 * Packet Receipt Times Extended Report.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class ExtendedReportPRT extends ExtendedReport
{
	// Receipt times (4 bytes numbers, unparsed).
	#receiptTimes: number[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty Packet Receipt
	 *   Times Extended Report will be created.
	 */
	constructor(view?: DataView)
	{
		super(ExtendedReportType.PRT, view);

		if (!this.view)
		{
			this.view = new DataView(
				new ArrayBuffer(EXTENDED_REPORT_PRT_MIN_LENGTH)
			);

			// Write report type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength < EXTENDED_REPORT_PRT_MIN_LENGTH)
		{
			throw new TypeError(
				'wrong byte length for a Packet Receipt Times Extended Report'
			);
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to receipt times.
		pos += EXTENDED_REPORT_PRT_MIN_LENGTH;

		while (pos < this.view.byteLength)
		{
			const receiptTime = this.view.getUint32(pos);

			this.#receiptTimes.push(receiptTime);

			pos += 4;
		}
	}

	/**
	 * Dump Packet Receipt Times Extended Report info.
	 */
	dump(): ExtendedReportPRTDump
	{
		return {
			...super.dump(),
			thinning     : this.getThinning(),
			ssrc         : this.getSsrc(),
			beginSeq     : this.getBeginSeq(),
			endSeq       : this.getEndSeq(),
			receiptTimes : this.getReceiptTimes()
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
		let reportLength = EXTENDED_REPORT_PRT_MIN_LENGTH;

		// Add receipt times.
		reportLength += this.#receiptTimes.length * 4;

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

		// Move to receipt times.
		pos += 2;

		// Copy receipt times.
		for (const receiptTime of this.#receiptTimes)
		{
			view.setUint32(pos, receiptTime);

			pos += 4;
		}

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
	clone(buffer?: ArrayBuffer, byteOffset?: number): ExtendedReportPRT
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new ExtendedReportPRT(view);
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
	 * Get receipt times.
	 *
	 * @remarks
	 * - Receipt times are given as a list of 4 byte integers.
	 */
	getReceiptTimes(): number[]
	{
		return Array.from(this.#receiptTimes);
	}

	/**
	 * Set receipt times.
	 *
	 * @remarks
	 * - Receipt times must be given as a list of 4 byte integers.
	 */
	seqReceiptTimes(receiptTimes: number[]): void
	{
		this.#receiptTimes = Array.from(receiptTimes);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add receipt time.
	 *
	 * @remarks
	 * - Receipt time must be given as 4 byte integer.
	 */
	addReceiptTime(receiptTime: number): void
	{
		this.#receiptTimes.push(receiptTime);

		this.setSerializationNeeded(true);
	}
}
