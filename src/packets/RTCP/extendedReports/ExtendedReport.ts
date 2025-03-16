import { Serializable, SerializableDump } from '../../Serializable';
import { assertUnreachable } from '../../../utils/helpers';

export const COMMON_HEADER_LENGTH = 4;

/**
 * Extended Report types.
 *
 * @category RTCP Extended Reports
 */
export enum ExtendedReportType {
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
	VM = 7,
	/**
	 * ECN Summary Report.
	 */
	ECN = 13,
}

/**
 * Extended Report dump.
 *
 * @category RTCP Extended Reports
 */
export type ExtendedReportDump = SerializableDump & {
	reportType: ExtendedReportType;
};

/**
 * Get the RTCP packet type.
 *
 * @hidden
 */
export function getExtendedReportType(view: DataView): ExtendedReportType {
	return view.getUint8(0);
}

/**
 * Read the report length value of an Extended Report and compute its size in
 * bytes (including first octet).
 *
 * @hidden
 */
export function getExtendedReportLength(view: DataView): number {
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
export function setExtendedReportLength(
	view: DataView,
	byteLength: number
): void {
	// Report byte length must be multiple of 4.
	if (byteLength % 4 !== 0) {
		throw new RangeError(
			`Extended Report byte length must be multiple of 4 but given byte length is ${byteLength} bytes`
		);
	}

	const length = byteLength / 4 - 1;

	view.setUint16(2, length);
}

/**
 * Parent class of all {@link XrPacket} Extended Reports.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |      BT       | type-specific |         block length          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :             type-specific block contents                      :
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP Extended Reports
 *
 * @see
 * - [RFC 3611 section 3](https://datatracker.ietf.org/doc/html/rfc3611#section-3)
 */
export abstract class ExtendedReport extends Serializable {
	readonly #reportType: ExtendedReportType;

	protected constructor(reportType: ExtendedReportType, view?: DataView) {
		super(view);

		this.#reportType = reportType;

		if (this.view) {
			if (this.view.byteLength < COMMON_HEADER_LENGTH) {
				throw new TypeError('too small buffer');
			}
			// Extended Report byte length must be multiple of 4.
			else if (this.view.byteLength % 4 !== 0) {
				throw new RangeError(
					`Extended Report byte length must be multiple of 4 but given buffer view is ${this.view.byteLength} bytes`
				);
			} else if (getExtendedReportType(this.view) !== reportType) {
				throw new TypeError(
					`not a ${reportTypeToString(reportType)} Extended Report`
				);
			} else if (getExtendedReportLength(this.view) !== this.view.byteLength) {
				throw new RangeError(
					`length in the RTCP header (${getExtendedReportLength(
						this.view
					)} bytes) does not match view length (${this.view.byteLength} bytes)`
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
	dump(): ExtendedReportDump {
		return {
			...super.dump(),
			reportType: this.getReportType(),
		};
	}

	/**
	 * Get the Extended Report type.
	 */
	getReportType(): ExtendedReportType {
		return this.view.getUint8(0);
	}

	protected writeCommonHeader(): void {
		this.setReportType(this.#reportType);

		// Update the report length field in the report header.
		setExtendedReportLength(this.view, this.view.byteLength);
	}

	/**
	 * Serialize base RTCP packet into a new buffer.
	 */
	protected serializeBase(
		buffer?: ArrayBufferLike,
		byteOffset?: number
	): DataView {
		const bufferData = this.getSerializationBuffer(buffer, byteOffset);

		// Create new DataView with new buffer.
		const view = new DataView(
			bufferData.buffer,
			bufferData.byteOffset,
			bufferData.byteLength
		);
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
		setExtendedReportLength(view, view.byteLength);

		return view;
	}

	/**
	 * Set the Extended Report type.
	 *
	 * @privateRemarks
	 * - This method is not public since users should not manipulate this field
	 *   directly.
	 */
	private setReportType(reportType: ExtendedReportType): void {
		this.view.setUint8(0, reportType);
	}
}

function reportTypeToString(reportType: ExtendedReportType): string {
	switch (reportType) {
		case ExtendedReportType.LRLE: {
			return 'Loss RLE';
		}

		case ExtendedReportType.DRLE: {
			return 'Duplicate RLE';
		}

		case ExtendedReportType.PRT: {
			return 'Packet Receipt Times';
		}

		case ExtendedReportType.RRT: {
			return 'Receiver Reference Time';
		}

		case ExtendedReportType.DLRR: {
			return 'DLRR';
		}

		case ExtendedReportType.SS: {
			return 'Statistics Summary';
		}

		case ExtendedReportType.VM: {
			return 'VoIP Metrics';
		}

		case ExtendedReportType.ECN: {
			return 'ECN Summary';
		}

		default: {
			assertUnreachable(reportType);
		}
	}
}
