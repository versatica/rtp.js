import { Serializable } from '../../Serializable';
import { assertUnreachable } from '../../utils';

export const COMMON_HEADER_LENGTH = 4;

/**
 * Extended Report types.
 */
// ESLint absurdly complains about "'ExtendedReportType' is already declared in
// the upper scope".
// eslint-disable-next-line no-shadow
export enum ExtendedReportType
{
	/**
	 * Loss RLE Report.
	 */
	LRLE = 1,
	/**
	 * Duplicate RLE Report.
	 */
	DRLE = 2,
	/**
	 * Packet Receipt Times Report.
	 */
	PRT = 3,
	/**
	 * Receiver Reference Time Report.
	 */
	RRT = 4,
	/**
	 * DLRR Report.
	 */
	DLRR = 5,
	/**
	 * Statistics Summary Report.
	 */
	SS = 6,
	/**
	 * VoIP Metrics Report.
	 */
	VM = 7
}

/**
 * Extended Report dump.
 */
export type ExtendedReportDump =
{
	reportType: ExtendedReportType;
};

/**
 * Get the RTCP packet type.
 *
 * @hidden
 */
export function getExtendedReportType(view: DataView): ExtendedReportType
{
	return view.getUint8(0);
}

/**
 * Read the report length value of an Extended Report and compute its size in
 * bytes (including first octet).
 *
 * @hidden
 */
export function getExtendedReportLength(view: DataView): number
{
	// As per RFC 3611, this is the length of this Extended Report in 32-bit words
	// minus one, including the header and any padding.
	const length = view.getUint16(2);
	const byteLength = (length + 1) * 4;

	return byteLength;
}

/**
 * Writes given length (in bytes) in the report length field of an Extended
 * Report.
 *
 * @hidden
 */
export function setExtendedReportLength(view: DataView, byteLength: number): void
{
	// Report byte length must be multiple of 4.
	if (byteLength % 4 !== 0)
	{
		throw new RangeError(
			`Extended Report byte length must be multiple of 4 but given byte length is ${byteLength} bytes`
		);
	}

	const length = (byteLength / 4) - 1;

	view.setUint16(2, length);
}

export function reportTypeToString(reportType: ExtendedReportType): string
{
	switch (reportType)
	{
		case ExtendedReportType.LRLE:
		{
			return 'Loss RLE';
		}

		case ExtendedReportType.DRLE:
		{
			return 'Duplicate RLE';
		}

		case ExtendedReportType.PRT:
		{
			return 'Packet Receipt Times';
		}

		case ExtendedReportType.RRT:
		{
			return 'Receiver Reference Time';
		}

		case ExtendedReportType.DLRR:
		{
			return 'DLRR';
		}

		case ExtendedReportType.SS:
		{
			return 'Statistics Summary';
		}

		case ExtendedReportType.VM:
		{
			return 'VoIP Metrics';
		}

		default:
		{
			assertUnreachable(reportType);
		}
	}
}

/**
 * Parent class of all Extended Reports.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export abstract class ExtendedReport extends Serializable
{
	readonly #reportType: ExtendedReportType;

	protected constructor(reportType: ExtendedReportType, view?: DataView)
	{
		super(view);

		this.#reportType = reportType;

		if (this.view)
		{
			// Extended Report byte length must be multiple of 4.
			if (this.view.byteLength % 4 !== 0)
			{
				throw new RangeError(
					`Extended Report byte length must be multiple of 4 but given buffer view is ${this.view.byteLength} bytes`
				);
			}
			else if (getExtendedReportType(this.view) !== reportType)
			{
				throw new TypeError(`not a ${reportTypeToString(reportType)} Extended Report`);
			}
			else if (getExtendedReportLength(this.view) !== this.view.byteLength)
			{
				throw new RangeError(
					`length in the RTCP header (${getExtendedReportLength(this.view)} bytes) does not match view length (${this.view.byteLength} bytes)`
				);
			}
		}
	}

	/**
	 * Base Extended Report dump.
	 *
	 * @remarks
	 * - Read the info dump type of each Extended Report instead.
	 */
	dump(): ExtendedReportDump
	{
		return {
			reportType : this.#reportType
		};
	}

	/**
	 * Get the Extended Report type.
	 */
	getReportType(): ExtendedReportType
	{
		return this.view.getUint8(0);
	}

	protected writeCommonHeader(): void
	{
		this.setReportType(this.#reportType);
	}

	/**
	 * Serialize base RTCP packet into a new buffer.
	 */
	protected serializeBase(): DataView
	{
		const reportLength = this.getByteLength();
		const { buffer, byteOffset } = this.getSerializationBuffer(reportLength);

		// Create new DataView with new buffer.
		const view = new DataView(buffer, byteOffset, reportLength);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Copy the common header into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset,
				COMMON_HEADER_LENGTH
			),
			0
		);

		// Update the report length field in the report header.
		setExtendedReportLength(view, reportLength);

		return view;
	}

	/**
	 * Set the Extended Report type.
	 *
	 * @privateRemarks
	 * - This method is not public since users should not manipulate this field
	 *   directly.
	 */
	private setReportType(reportType: ExtendedReportType): void
	{
		this.view.setUint8(0, reportType);
	}
}
