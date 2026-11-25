import { RtcpPacket, COMMON_HEADER_LENGTH } from './RtcpPacket.js';
import {
	isUnsignedInteger8,
	isUnsignedInteger32,
} from '../../utils/numbers.js';
import {
	readSigned3BytesInDataView,
	writeSigned3BytesInDataView,
} from '../../utils/bytes.js';

/**
 * Length (in bytes) of a reception report block.
 */
export const REPORT_LENGTH = 24;

/**
 * Maximum number of reception report blocks in a packet (the RC field has 5
 * bits).
 */
const MAX_REPORTS = 31;

/**
 * Minimum value of the cumulative number of packets lost (24 bits signed
 * integer).
 */
const MIN_TOTAL_LOST = -0x800000;

/**
 * Maximum value of the cumulative number of packets lost (24 bits signed
 * integer).
 */
const MAX_TOTAL_LOST = 0x7fffff;

/**
 * RTCP reception report block.
 */
export type ReceptionReport = {
	/**
	 * SSRC of the source this reception report block refers to.
	 */
	ssrc: number;
	/**
	 * Fraction of packets lost since the previous report, as a fixed point
	 * number with the binary point at the left edge (8 bits).
	 */
	fractionLost: number;
	/**
	 * Cumulative number of packets lost (24 bits signed integer).
	 */
	totalLost: number;
	/**
	 * Extended highest sequence number received.
	 */
	highestSeq: number;
	/**
	 * Interarrival jitter.
	 */
	jitter: number;
	/**
	 * Last SR timestamp (LSR): The middle 32 bits of the NTP timestamp of the
	 * last Sender Report received from the source (0 if none was received).
	 *
	 * @see
	 * - {@link utils!ntpToCompactNtp} to obtain it from the NTP timestamp.
	 * - {@link utils!compactNtpRttToTimeUs} to convert the round trip time
	 *   computed with it into microseconds.
	 */
	lsr: number;
	/**
	 * Delay since last SR (DLSR): Delay, in units of 1/65536 seconds, between
	 * receiving the last Sender Report from the source and sending this
	 * reception report block (0 if none was received).
	 *
	 * @see
	 * - {@link utils!timeUsToCompactNtpInterval} and
	 *   {@link utils!compactNtpIntervalToTimeUs} to convert it from and into
	 *   microseconds.
	 */
	dlsr: number;
};

/**
 * Parent class of RTCP Receiver Report and Sender Report packets.
 *
 * Both packets start with the Common Header followed by the SSRC of the packet
 * sender, and both end with RC reception report blocks optionally followed by
 * profile-specific extensions. The only difference is the length of the fixed
 * header that precedes the reception report blocks (the Sender Report includes
 * the sender info).
 *
 * Each reception report block:
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                 SSRC_n (SSRC of n-th source)                  |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | fraction lost |       cumulative number of packets lost       |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |           extended highest sequence number received           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                      interarrival jitter                      |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                         last SR (LSR)                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                   delay since last SR (DLSR)                  |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @remarks
 * - Profile-specific extensions are accepted when parsing but they are not
 *   exposed.
 *
 * @see
 * - [RFC 3550 section 6.4](https://datatracker.ietf.org/doc/html/rfc3550#section-6.4)
 */
export abstract class AnyReportPacket extends RtcpPacket {
	protected constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * @inheritDoc
	 */
	abstract override clone(buffer: Uint8Array): AnyReportPacket;

	/**
	 * Get the SSRC of the packet sender.
	 */
	getSsrc(): number {
		return this.getView().getUint32(4);
	}

	/**
	 * Set the SSRC of the packet sender.
	 *
	 * @throws
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295.
	 */
	setSsrc(ssrc: number): void {
		if (!isUnsignedInteger32(ssrc)) {
			throw new TypeError(
				`ssrc (${ssrc}) must be an integer between 0 and 4294967295`
			);
		}

		this.getView().setUint32(4, ssrc);
	}

	/**
	 * Get the number of reception report blocks (value of the RC field).
	 */
	getReportsCount(): number {
		return this.getCount();
	}

	/**
	 * Get the reception report blocks.
	 */
	getReports(): ReceptionReport[] {
		const view = this.getView();
		const headerLength = this.getHeaderLength();
		const reportsCount = this.getReportsCount();
		const reports: ReceptionReport[] = [];

		for (let idx = 0; idx < reportsCount; ++idx) {
			const pos = headerLength + idx * REPORT_LENGTH;

			reports.push({
				ssrc: view.getUint32(pos),
				fractionLost: view.getUint8(pos + 4),
				totalLost: readSigned3BytesInDataView(view, pos + 5),
				highestSeq: view.getUint32(pos + 8),
				jitter: view.getUint32(pos + 12),
				lsr: view.getUint32(pos + 16),
				dlsr: view.getUint32(pos + 20),
			});
		}

		return reports;
	}

	/**
	 * Set the reception report blocks. If `reports` is not given (or if it's an
	 * empty array) all reception report blocks are removed.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 * - `totalLost` is clamped to the range of a 24 bits signed integer as
	 *   stated in the appendix A.3 of RFC 3550.
	 *
	 * @throws
	 * - `TypeError` if more than 31 reception report blocks are given.
	 * - `TypeError` if some field of some reception report block is out of
	 *   range.
	 * - `TypeError` if the packet has profile-specific extensions.
	 * - `TypeError` if the buffer has no space for the given reception report
	 *   blocks.
	 */
	setReports(reports: ReceptionReport[] = []): void {
		if (reports.length > MAX_REPORTS) {
			throw new TypeError(
				`cannot set more than ${MAX_REPORTS} reception report blocks (${reports.length} given)`
			);
		}

		for (const report of reports) {
			this.#assertReport(report);
		}

		this.#assertNoProfileSpecificExtensions();

		const headerLength = this.getHeaderLength();

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(
			headerLength - COMMON_HEADER_LENGTH + reports.length * REPORT_LENGTH
		);

		for (const [idx, report] of reports.entries()) {
			this.#writeReport(headerLength + idx * REPORT_LENGTH, report);
		}

		this.setCount(reports.length);
	}

	/**
	 * Add a reception report block at the end of the packet.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 * - `totalLost` is clamped to the range of a 24 bits signed integer as
	 *   stated in the appendix A.3 of RFC 3550.
	 *
	 * @throws
	 * - `TypeError` if the packet already has 31 reception report blocks.
	 * - `TypeError` if some field of the reception report block is out of
	 *   range.
	 * - `TypeError` if the packet has profile-specific extensions.
	 * - `TypeError` if the buffer has no space for the reception report block.
	 */
	addReport(report: ReceptionReport): void {
		const reportsCount = this.getReportsCount();

		if (reportsCount === MAX_REPORTS) {
			throw new TypeError(
				`cannot add more than ${MAX_REPORTS} reception report blocks`
			);
		}

		this.#assertReport(report);
		this.#assertNoProfileSpecificExtensions();

		const pos = this.getHeaderLength() + reportsCount * REPORT_LENGTH;

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(pos + REPORT_LENGTH - COMMON_HEADER_LENGTH);

		this.#writeReport(pos, report);

		this.setCount(reportsCount + 1);
	}

	/**
	 * Length (in bytes) of the fixed header that precedes the reception report
	 * blocks, Common Header included.
	 */
	protected abstract getHeaderLength(): number;

	/**
	 * To be called by the `parse()` method of each subclass after
	 * {@link parseCommonHeader}.
	 *
	 * @throws
	 * - `TypeError` if the packet is shorter than its fixed header or if the
	 *   announced reception report blocks exceed the packet length.
	 */
	protected validateReports(): void {
		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();
		const headerLength = this.getHeaderLength();

		if (contentLength < headerLength) {
			throw new TypeError(
				`packet length (${contentLength} bytes, excluding padding) is lower than ${headerLength} bytes`
			);
		} else if (
			headerLength + this.getReportsCount() * REPORT_LENGTH >
			contentLength
		) {
			throw new TypeError('reception report blocks exceed the packet length');
		}
	}

	/**
	 * Whether there are profile-specific extensions after the reception report
	 * blocks.
	 */
	#hasProfileSpecificExtensions(): boolean {
		return (
			this.getLength() - this.getPadding() >
			this.getHeaderLength() + this.getReportsCount() * REPORT_LENGTH
		);
	}

	/**
	 * @throws
	 * - `TypeError` if the packet has profile-specific extensions.
	 */
	#assertNoProfileSpecificExtensions(): void {
		if (this.#hasProfileSpecificExtensions()) {
			throw new TypeError(
				'cannot modify reception report blocks of a packet with profile-specific extensions'
			);
		}
	}

	/**
	 * @throws
	 * - `TypeError` if some field of the given reception report block is out of
	 *   range.
	 */
	#assertReport(report: ReceptionReport): void {
		const { ssrc, fractionLost, totalLost, highestSeq, jitter, lsr, dlsr } =
			report;

		if (!isUnsignedInteger8(fractionLost)) {
			throw new TypeError(
				`fractionLost (${fractionLost}) must be an integer between 0 and 255`
			);
		} else if (!Number.isInteger(totalLost)) {
			throw new TypeError(`totalLost (${totalLost}) must be an integer`);
		}

		for (const [name, value] of Object.entries({
			ssrc,
			highestSeq,
			jitter,
			lsr,
			dlsr,
		})) {
			if (!isUnsignedInteger32(value)) {
				throw new TypeError(
					`${name} (${value}) must be an integer between 0 and 4294967295`
				);
			}
		}
	}

	#writeReport(pos: number, report: ReceptionReport): void {
		const view = this.getView();

		view.setUint32(pos, report.ssrc);
		view.setUint8(pos + 4, report.fractionLost);
		// The cumulative number of packets lost is a 24 bits signed integer, so a
		// value out of its range is clamped as stated in the appendix A.3 of RFC
		// 3550.
		writeSigned3BytesInDataView(
			view,
			pos + 5,
			Math.min(Math.max(report.totalLost, MIN_TOTAL_LOST), MAX_TOTAL_LOST)
		);
		view.setUint32(pos + 8, report.highestSeq);
		view.setUint32(pos + 12, report.jitter);
		view.setUint32(pos + 16, report.lsr);
		view.setUint32(pos + 20, report.dlsr);
	}
}
