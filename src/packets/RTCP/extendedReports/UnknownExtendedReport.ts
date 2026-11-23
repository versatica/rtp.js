import {
	ExtendedReport,
	isExtendedReport,
	type ExtendedReportDump,
} from '../ExtendedReport';

/**
 * RTCP XR Unknown Extended Report block info dump.
 */
export type UnknownExtendedReportDump = ExtendedReportDump & {
	unknownValueLength: number;
};

/**
 * RTCP XR Extended Report block with an unknown or not implemented block
 * type.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |      BT       | type-specific |         block length          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * \                                                               \
 * /                         Unknown Value                         /
 * \                                                               \
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @see
 * - [RFC 3611 section 3](https://datatracker.ietf.org/doc/html/rfc3611#section-3)
 */
export class UnknownExtendedReport extends ExtendedReport {
	/**
	 * Parse a RTCP XR Extended Report block with any block type.
	 *
	 * @param buffer - Buffer holding the block. Its `byteLength` is the maximum
	 *   length the block can take and it can be greater than the length of the
	 *   block, which is given by its block length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP XR Extended
	 *   Report block.
	 */
	static parse(buffer: Uint8Array): UnknownExtendedReport {
		if (!isExtendedReport(buffer)) {
			throw new TypeError('not a RTCP XR Extended Report block');
		}

		const extendedReport = new UnknownExtendedReport(buffer);

		extendedReport.parseHeader();

		return extendedReport;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP XR Unknown Extended Report block info.
	 */
	override dump(): UnknownExtendedReportDump {
		return {
			...super.dump(),
			unknownValueLength: this.getBodyLength(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): UnknownExtendedReport {
		const clonedExtendedReport = new UnknownExtendedReport(buffer);

		this.cloneInto(clonedExtendedReport);

		return clonedExtendedReport;
	}

	/**
	 * Get the value that follows the block header. It is empty if the block has
	 * no value.
	 *
	 * @remarks
	 * - The returned value is a view over the buffer of the block (no bytes
	 *   are copied).
	 */
	getUnknownValue(): Uint8Array {
		return this.getBody();
	}
}
