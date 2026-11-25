import {
	ExtendedReport,
	ExtendedReportBlockType,
	EXTENDED_REPORT_HEADER_LENGTH,
	isExtendedReport,
	type ExtendedReportDump,
} from '../ExtendedReport.js';
import { isUnsignedInteger32 } from '../../../utils/numbers.js';

/**
 * Length (in bytes) of a DLRR sub-block.
 */
const DLRR_SUB_BLOCK_LENGTH = 12;

/**
 * DLRR sub-block.
 */
export type DlrrSubBlock = {
	/**
	 * SSRC of the receiver.
	 */
	ssrc: number;
	/**
	 * Last RR timestamp (LRR): The middle 32 bits of the NTP timestamp received
	 * in the last Receiver Reference Time Report Block from the receiver (0 if
	 * none was received).
	 *
	 * @see
	 * - {@link utils!ntpToCompactNtp} to obtain it from the NTP timestamp.
	 * - {@link utils!compactNtpRttToTimeUs} to convert the round trip time
	 *   computed with it into microseconds.
	 */
	lastReceiverReport: number;
	/**
	 * Delay since last RR (DLRR): Delay, in units of 1/65536 seconds, between
	 * receiving the last Receiver Reference Time Report Block from the receiver
	 * and sending this DLRR Report Block (0 if none was received).
	 *
	 * @see
	 * - {@link utils!timeUsToCompactNtpInterval} and
	 *   {@link utils!compactNtpIntervalToTimeUs} to convert it from and into
	 *   microseconds.
	 */
	delaySinceLastReceiverReport: number;
};

/**
 * RTCP XR DLRR Report Block info dump.
 */
export type DlrrExtendedReportDump = ExtendedReportDump & {
	/**
	 * DLRR sub-blocks.
	 */
	subBlocks: DlrrSubBlock[];
};

/**
 * RTCP XR DLRR Report Block (5).
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
 * - Block type (BT) (8 bits): 5.
 * - Reserved (8 bits): Must be set to zero and must be ignored by the
 *   receiver.
 * - Sub-blocks: One per receiver. See {@link DlrrSubBlock}.
 *
 * @see
 * - [RFC 3611 section 4.5](https://datatracker.ietf.org/doc/html/rfc3611#section-4.5)
 */
export class DlrrExtendedReport extends ExtendedReport {
	/**
	 * Parse a RTCP XR DLRR Report Block.
	 *
	 * @param buffer - Buffer holding the block. Its `byteLength` is the maximum
	 *   length the block can take and it can be greater than the length of the
	 *   block, which is given by its block length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP XR DLRR Report
	 *   Block.
	 */
	static parse(buffer: Uint8Array): DlrrExtendedReport {
		if (!isExtendedReport(buffer)) {
			throw new TypeError('not a RTCP XR Extended Report block');
		}

		const extendedReport = new DlrrExtendedReport(buffer);

		extendedReport.parseHeader(ExtendedReportBlockType.DLRR);
		extendedReport.#validate();

		return extendedReport;
	}

	/**
	 * Create a RTCP XR DLRR Report Block without sub-blocks.
	 *
	 * @param buffer - Buffer for the block. Its `byteLength` is the maximum
	 *   length the block can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than 4 bytes.
	 */
	static factory(buffer: Uint8Array): DlrrExtendedReport {
		const extendedReport = new DlrrExtendedReport(buffer);

		extendedReport.initializeHeader(
			ExtendedReportBlockType.DLRR,
			0,
			EXTENDED_REPORT_HEADER_LENGTH
		);

		return extendedReport;
	}

	/**
	 * Length (in bytes) of a RTCP XR DLRR Report Block with the given number of
	 * sub-blocks.
	 *
	 * @internal
	 */
	static computeLengthFor(numSubBlocks: number): number {
		// The sub-blocks go right after the block header, and each one is a
		// multiple of 4 bytes, so the block never needs padding.
		return EXTENDED_REPORT_HEADER_LENGTH + numSubBlocks * DLRR_SUB_BLOCK_LENGTH;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP XR DLRR Report Block info.
	 */
	override dump(): DlrrExtendedReportDump {
		return {
			...super.dump(),
			subBlocks: this.getSubBlocks(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): DlrrExtendedReport {
		const clonedExtendedReport = new DlrrExtendedReport(buffer);

		this.cloneInto(clonedExtendedReport);

		return clonedExtendedReport;
	}

	/**
	 * Get the number of sub-blocks.
	 */
	getNumberOfSubBlocks(): number {
		return this.getBodyLength() / DLRR_SUB_BLOCK_LENGTH;
	}

	/**
	 * Get the sub-blocks.
	 */
	getSubBlocks(): DlrrSubBlock[] {
		const view = this.getView();
		const numberOfSubBlocks = this.getNumberOfSubBlocks();
		const subBlocks: DlrrSubBlock[] = [];

		for (let idx = 0; idx < numberOfSubBlocks; ++idx) {
			const pos = EXTENDED_REPORT_HEADER_LENGTH + idx * DLRR_SUB_BLOCK_LENGTH;

			subBlocks.push({
				ssrc: view.getUint32(pos),
				lastReceiverReport: view.getUint32(pos + 4),
				delaySinceLastReceiverReport: view.getUint32(pos + 8),
			});
		}

		return subBlocks;
	}

	/**
	 * Add a sub-block at the end of the block.
	 *
	 * @throws
	 * - `TypeError` if `ssrc`, `lastReceiverReport` or
	 *   `delaySinceLastReceiverReport` is not an integer between 0 and
	 *   4294967295.
	 * - `TypeError` if the buffer has no space for the sub-block.
	 */
	addSubBlock(subBlock: DlrrSubBlock): void {
		if (
			!isUnsignedInteger32(subBlock.ssrc) ||
			!isUnsignedInteger32(subBlock.lastReceiverReport) ||
			!isUnsignedInteger32(subBlock.delaySinceLastReceiverReport)
		) {
			throw new TypeError(
				'ssrc, lastReceiverReport and delaySinceLastReceiverReport must be integers between 0 and 4294967295'
			);
		}

		const bodyLength = this.getBodyLength();
		// The new sub-block goes right after the last one.
		const pos = EXTENDED_REPORT_HEADER_LENGTH + bodyLength;

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(bodyLength + DLRR_SUB_BLOCK_LENGTH);

		const view = this.getView();

		view.setUint32(pos, subBlock.ssrc);
		view.setUint32(pos + 4, subBlock.lastReceiverReport);
		view.setUint32(pos + 8, subBlock.delaySinceLastReceiverReport);
	}

	#validate(): void {
		// The block must contain whole sub-blocks.
		if (this.getBodyLength() % DLRR_SUB_BLOCK_LENGTH !== 0) {
			throw new TypeError(
				`sub-blocks length (${this.getBodyLength()} bytes) is not multiple of ${DLRR_SUB_BLOCK_LENGTH}`
			);
		}
	}
}
