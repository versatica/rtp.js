import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	COMMON_HEADER_LENGTH
} from './ExtendedReport';

/**
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=4      |   reserved    |       block length = 2        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |              NTP timestamp, most significant word             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |             NTP timestamp, least significant word             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
*/

// Common header + NTP timestamp.
const EXTENDED_REPORT_RRT_LENGTH = COMMON_HEADER_LENGTH + 8;

/**
 * Receiver Reference Time Extended Report dump.
 */
export type ExtendedReportRRTDump = ExtendedReportDump &
{
	ntpSeq: number;
	ntpFraction: number;
};

/**
 * Receiver Reference Time Extended Report.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class ExtendedReportRRT extends ExtendedReport
{
	/**
	 * @param view - If given it will be parsed. Otherwise an empty Receiver
	 *   Reference Time Extended Report will be created.
	 */
	constructor(view?: DataView)
	{
		super(ExtendedReportType.RRT, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(EXTENDED_REPORT_RRT_LENGTH));

			// Write report type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength !== EXTENDED_REPORT_RRT_LENGTH)
		{
			throw new TypeError(
				'wrong byte length for a Receiver Reference Time Extended Report'
			);
		}
	}

	/**
	 * Dump Receiver Reference Time Extended Report info.
	 */
	dump(): ExtendedReportRRTDump
	{
		return {
			...super.dump(),
			ntpSeq      : this.getNtpSeconds(),
			ntpFraction : this.getNtpFraction()
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		return EXTENDED_REPORT_RRT_LENGTH;
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const view = super.serializeBase();
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
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
				EXTENDED_REPORT_RRT_LENGTH - COMMON_HEADER_LENGTH
			),
			pos
		);

		// Move to the end.
		pos += EXTENDED_REPORT_RRT_LENGTH - COMMON_HEADER_LENGTH;

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
	clone(buffer?: ArrayBuffer, byteOffset?: number): ExtendedReportRRT
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new ExtendedReportRRT(view);
	}

	/**
	 * Get NTP seconds.
	 */
	getNtpSeconds(): number
	{
		return this.view.getUint32(4);
	}

	/**
	 * Set NTP seconds.
	 */
	setNtpSeconds(seconds: number): void
	{
		this.view.setUint32(4, seconds);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get NTP fraction.
	 */
	getNtpFraction(): number
	{
		return this.view.getUint32(8);
	}

	/**
	 * Set NTP fraction.
	 */
	setNtpFraction(fraction: number): void
	{
		this.view.setUint32(8, fraction);

		this.setSerializationNeeded(true);
	}
}
