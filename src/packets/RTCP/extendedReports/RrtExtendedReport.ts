import {
	ExtendedReport,
	ExtendedReportBlockType,
	EXTENDED_REPORT_HEADER_LENGTH,
	isExtendedReport,
	type ExtendedReportDump,
} from '../ExtendedReport';
import type { Ntp } from '../../../utils/types';
import { isUnsignedInteger } from '../../../utils/numbers';

/**
 * Length (in bytes) of the Receiver Reference Time Report Block.
 */
const RRT_EXTENDED_REPORT_LENGTH = 12;

/**
 * RTCP XR Receiver Reference Time Report Block info dump.
 */
export type RrtExtendedReportDump = ExtendedReportDump & {
	/**
	 * NTP timestamp.
	 */
	ntp: Ntp;
};

/**
 * RTCP XR Receiver Reference Time Report Block (4).
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
 * - Block type (BT) (8 bits): 4.
 * - Reserved (8 bits): Must be set to zero and must be ignored by the
 *   receiver.
 * - Block length (16 bits): The constant 2.
 * - NTP timestamp (64 bits): Wallclock time when this block was sent.
 *
 * @see
 * - [RFC 3611 section 4.4](https://datatracker.ietf.org/doc/html/rfc3611#section-4.4)
 */
export class RrtExtendedReport extends ExtendedReport {
	/**
	 * Parse a RTCP XR Receiver Reference Time Report Block.
	 *
	 * @param buffer - Buffer holding the block. Its `byteLength` is the maximum
	 *   length the block can take and it can be greater than the length of the
	 *   block, which is given by its block length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP XR Receiver
	 *   Reference Time Report Block.
	 */
	static parse(buffer: Uint8Array): RrtExtendedReport {
		if (!isExtendedReport(buffer)) {
			throw new TypeError('not a RTCP XR Extended Report block');
		}

		const extendedReport = new RrtExtendedReport(buffer);

		extendedReport.parseHeader(ExtendedReportBlockType.RRT);
		extendedReport.#validate();

		return extendedReport;
	}

	/**
	 * Create a RTCP XR Receiver Reference Time Report Block with the NTP
	 * timestamp set to 0.
	 *
	 * @param buffer - Buffer for the block. Its `byteLength` is the maximum
	 *   length the block can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than 12 bytes.
	 */
	static factory(buffer: Uint8Array): RrtExtendedReport {
		const extendedReport = new RrtExtendedReport(buffer);

		extendedReport.initializeHeader(
			ExtendedReportBlockType.RRT,
			0,
			RRT_EXTENDED_REPORT_LENGTH
		);

		// Set NTP timestamp to 0.
		buffer.fill(0, EXTENDED_REPORT_HEADER_LENGTH, RRT_EXTENDED_REPORT_LENGTH);

		return extendedReport;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP XR Receiver Reference Time Report Block info.
	 */
	override dump(): RrtExtendedReportDump {
		return {
			...super.dump(),
			ntp: this.getNtp(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): RrtExtendedReport {
		const clonedExtendedReport = new RrtExtendedReport(buffer);

		this.cloneInto(clonedExtendedReport);

		return clonedExtendedReport;
	}

	/**
	 * Get the NTP timestamp.
	 *
	 * @see
	 * - {@link utils!ntpToTimeUs} to convert it into microseconds.
	 */
	getNtp(): Ntp {
		const view = this.getView();

		return {
			seconds: view.getUint32(4),
			fractions: view.getUint32(8),
		};
	}

	/**
	 * Set the NTP timestamp.
	 *
	 * @throws
	 * - `TypeError` if `ntp.seconds` or `ntp.fractions` is not an integer
	 *   between 0 and 4294967295.
	 *
	 * @see
	 * - {@link utils!timeUsToNtp} to convert microseconds into it.
	 */
	setNtp(ntp: Ntp): void {
		if (
			!isUnsignedInteger(ntp.seconds, 0xffffffff) ||
			!isUnsignedInteger(ntp.fractions, 0xffffffff)
		) {
			throw new TypeError(
				'ntp seconds and fractions must be integers between 0 and 4294967295'
			);
		}

		const view = this.getView();

		view.setUint32(4, ntp.seconds);
		view.setUint32(8, ntp.fractions);
	}

	#validate(): void {
		if (this.getLength() !== RRT_EXTENDED_REPORT_LENGTH) {
			throw new TypeError(
				`block length (${this.getLength()} bytes) must be ${RRT_EXTENDED_REPORT_LENGTH} bytes`
			);
		}
	}
}
