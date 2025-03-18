import {
	ExtendedReport,
	ExtendedReportType,
	type ExtendedReportDump,
	COMMON_HEADER_LENGTH,
} from './ExtendedReport.mts';

const ECN_EXTENDED_REPORT_LENGTH = COMMON_HEADER_LENGTH + 20;

/**
 * ECN Summary Extended Report dump.
 *
 * @category RTCP Extended Reports
 */
export type EcnExtendedReportDump = ExtendedReportDump & {
	ssrc: number;
	ect0Counter: number;
	ect1Counter: number;
	ecnCeCounter: number;
	nonEctCounter: number;
	lostPacketsCounter: number;
	duplicationCounter: number;
};

/**
 * ECN Summary Extended Report.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=13     |   reserved    |       block length = 5        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | SSRC of Media Sender                                          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | ECT (0) Counter                                               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | ECT (1) Counter                                               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | ECN-CE Counter                | not-ECT Counter               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | Lost Packets Counter          | Duplication Counter           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP Extended Reports
 *
 * @see
 * - [RFC 6679 section 5.2](https://datatracker.ietf.org/doc/html/rfc6679#section-5.2)
 */
export class EcnExtendedReport extends ExtendedReport {
	/**
	 * @param view - If given it will be parsed. Otherwise an empty ECN Summary
	 *   Extended Report will be created.
	 */
	constructor(view?: DataView) {
		super(ExtendedReportType.ECN, view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(ECN_EXTENDED_REPORT_LENGTH));

			// Write report type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength !== ECN_EXTENDED_REPORT_LENGTH) {
			throw new TypeError(
				'wrong byte length for a ECN Summary Extended Report'
			);
		}
	}

	/**
	 * Dump ECN Summary Extended Report info.
	 */
	override dump(): EcnExtendedReportDump {
		return {
			...super.dump(),
			ssrc: this.getSsrc(),
			ect0Counter: this.getEct0Counter(),
			ect1Counter: this.getEct1Counter(),
			ecnCeCounter: this.getEcnCeCounter(),
			nonEctCounter: this.getNonEctCounter(),
			lostPacketsCounter: this.getLostPacketsCounter(),
			duplicationCounter: this.getDuplicationCounter(),
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		return ECN_EXTENDED_REPORT_LENGTH;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBufferLike, byteOffset?: number): void {
		const view = this.serializeBase(buffer, byteOffset);
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
				ECN_EXTENDED_REPORT_LENGTH - COMMON_HEADER_LENGTH
			),
			pos
		);

		// Move to the end.
		pos += ECN_EXTENDED_REPORT_LENGTH - COMMON_HEADER_LENGTH;

		if (pos !== view.byteLength) {
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
		buffer?: ArrayBufferLike,
		byteOffset?: number,
		serializationBuffer?: ArrayBufferLike,
		serializationByteOffset?: number
	): EcnExtendedReport {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new EcnExtendedReport(view);
	}

	/**
	 * Get SSRC of media sender.
	 */
	getSsrc(): number {
		return this.view.getUint32(4);
	}

	/**
	 * Set SSRC of media sender.
	 */
	setSsrc(ssrc: number): void {
		this.view.setUint32(4, ssrc);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get ECT (0) Counter.
	 */
	getEct0Counter(): number {
		return this.view.getUint32(8);
	}

	/**
	 * Set ECT (0) Counter.
	 */
	setEct0Counter(counter: number): void {
		this.view.setUint32(8, counter);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get ECT (1) Counter.
	 */
	getEct1Counter(): number {
		return this.view.getUint32(12);
	}

	/**
	 * Set ECT (1) Counter.
	 */
	setEct1Counter(counter: number): void {
		this.view.setUint32(12, counter);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get ECN-CE Counter.
	 */
	getEcnCeCounter(): number {
		return this.view.getUint16(16);
	}

	/**
	 * Set ECN-CE Counter.
	 */
	setEcnCeCounter(counter: number): void {
		this.view.setUint16(16, counter);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get not-ECT Counter.
	 */
	getNonEctCounter(): number {
		return this.view.getUint16(18);
	}

	/**
	 * Set not-ECT Counter.
	 */
	setNonEctCounter(counter: number): void {
		this.view.setUint16(18, counter);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get Lost Packets Counter.
	 */
	getLostPacketsCounter(): number {
		return this.view.getUint16(20);
	}

	/**
	 * Set Lost Packets Counter.
	 */
	setLostPacketsCounter(counter: number): void {
		this.view.setUint16(20, counter);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get Duplication Counter.
	 */
	getDuplicationCounter(): number {
		return this.view.getUint16(22);
	}

	/**
	 * Set Duplication Counter.
	 */
	setDuplicationCounter(counter: number): void {
		this.view.setUint16(22, counter);

		this.setSerializationNeeded(true);
	}
}
