import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	COMMON_HEADER_LENGTH,
} from './ExtendedReport';

// Common header + NTP timestamp.
const RRT_EXTENDED_REPORT_LENGTH = COMMON_HEADER_LENGTH + 8;

/**
 * Receiver Reference Time Extended Report dump.
 *
 * @category RTCP Extended Reports
 */
export type RrtExtendedReportDump = ExtendedReportDump & {
	ntpSeq: number;
	ntpFraction: number;
};

/**
 * Receiver Reference Time Extended Report.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=4      |   reserved    |       block length = 2        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |              NTP timestamp, most significant word             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |             NTP timestamp, least significant word             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP Extended Reports
 *
 * @see
 * - [RFC 3611 section 4.4](https://datatracker.ietf.org/doc/html/rfc3611#section-4.4)
 */
export class RrtExtendedReport extends ExtendedReport {
	/**
	 * @param view - If given it will be parsed. Otherwise an empty Receiver
	 *   Reference Time Extended Report will be created.
	 */
	constructor(view?: DataView) {
		super(ExtendedReportType.RRT, view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(RRT_EXTENDED_REPORT_LENGTH));

			// Write report type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength !== RRT_EXTENDED_REPORT_LENGTH) {
			throw new TypeError(
				'wrong byte length for a Receiver Reference Time Extended Report',
			);
		}
	}

	/**
	 * Dump Receiver Reference Time Extended Report info.
	 */
	dump(): RrtExtendedReportDump {
		return {
			...super.dump(),
			ntpSeq: this.getNtpSeconds(),
			ntpFraction: this.getNtpFraction(),
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		return RRT_EXTENDED_REPORT_LENGTH;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void {
		const view = this.serializeBase(buffer, byteOffset);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength,
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to the fixed header fields after the common header.
		pos += COMMON_HEADER_LENGTH;

		// Copy the rest of the Extended Report into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset + pos,
				RRT_EXTENDED_REPORT_LENGTH - COMMON_HEADER_LENGTH,
			),
			pos,
		);

		// Move to the end.
		pos += RRT_EXTENDED_REPORT_LENGTH - COMMON_HEADER_LENGTH;

		if (pos !== view.byteLength) {
			throw new RangeError(
				`filled length (${pos} bytes) does not match the available buffer size (${view.byteLength} bytes)`,
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
		serializationByteOffset?: number,
	): RrtExtendedReport {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset,
		);

		return new RrtExtendedReport(view);
	}

	/**
	 * Get NTP seconds.
	 */
	getNtpSeconds(): number {
		return this.view.getUint32(4);
	}

	/**
	 * Set NTP seconds.
	 */
	setNtpSeconds(seconds: number): void {
		this.view.setUint32(4, seconds);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get NTP fraction.
	 */
	getNtpFraction(): number {
		return this.view.getUint32(8);
	}

	/**
	 * Set NTP fraction.
	 */
	setNtpFraction(fraction: number): void {
		this.view.setUint32(8, fraction);

		this.setSerializationNeeded(true);
	}
}
