import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	COMMON_HEADER_LENGTH
} from './ExtendedReport';

/**
 * DLRR Extended Report dump.
 */
export type ExtendedReportDLRRDump = ExtendedReportDump &
{
	subReports: DLRRSubReport[];
};

/**
 * DLRR Sub-Report.
 */
export type DLRRSubReport =
{
	/**
	 * SSRC of receiver.
	 */
	ssrc: number;
	/**
	 * Last RR timestamp.
	 */
	lrr: number;
	/**
	 * Delay since last RR.
	 */
	dlrr: number;
};

/**
 * DLRR Extended Report.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=5      |   reserved    |         block length          |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |                 SSRC_1 (SSRC of first receiver)               | sub-
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ block
 * |                         last RR (LRR)                         |   1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                   delay since last RR (DLRR)                  |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |                 SSRC_2 (SSRC of second receiver)              | sub-
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ block
 * :                               ...                             :   2
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * ```
 *
 * @see
 * - [RFC 3611 section 4.5](https://datatracker.ietf.org/doc/html/rfc3611#section-4.5)
 */
export class ExtendedReportDLRR extends ExtendedReport
{
	// Sub-reports.
	#subReports: DLRRSubReport[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty DLRR Extended
	 *   Report will be created.
	 */
	constructor(view?: DataView)
	{
		super(ExtendedReportType.DLRR, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(COMMON_HEADER_LENGTH));

			// Write report type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength < COMMON_HEADER_LENGTH)
		{
			throw new TypeError(
				'wrong byte length for a DLRR Extended Report'
			);
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to sub-reports.
		pos += COMMON_HEADER_LENGTH;

		while (pos < this.view.byteLength)
		{
			const ssrc = this.view.getUint32(pos);

			pos += 4;

			const lrr = this.view.getUint32(pos);

			pos += 4;

			const dlrr = this.view.getUint32(pos);

			pos += 4;

			this.#subReports.push({ ssrc, lrr, dlrr });
		}
	}

	/**
	 * Dump DLRR Extended Report info.
	 */
	dump(): ExtendedReportDLRRDump
	{
		return {
			...super.dump(),
			subReports : this.getSubReports()
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

		let reportLength = COMMON_HEADER_LENGTH;

		// Add sub-reports.
		reportLength += this.#subReports.length * 12;

		return reportLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void
	{
		const view = this.serializeBase(buffer, byteOffset);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to sub-reports.
		pos += COMMON_HEADER_LENGTH;

		// Copy sub-reports.
		for (const { ssrc, lrr, dlrr } of this.#subReports)
		{
			view.setUint32(pos, ssrc);

			pos += 4;

			view.setUint32(pos, lrr);

			pos += 4;

			view.setUint32(pos, dlrr);

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
	clone(
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number
	): ExtendedReportDLRR
	{
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new ExtendedReportDLRR(view);
	}

	/**
	 * Get sub-reports.
	 */
	getSubReports(): DLRRSubReport[]
	{
		return Array.from(this.#subReports);
	}

	/**
	 * Set sub-reports.
	 */
	setSubReports(subReports: DLRRSubReport[]): void
	{
		this.#subReports = Array.from(subReports);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add sub-report.
	 */
	addSubReport(subReport: DLRRSubReport): void
	{
		this.#subReports.push(subReport);

		this.setSerializationNeeded(true);
	}
}
