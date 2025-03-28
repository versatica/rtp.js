import {
	RtcpPacket,
	RtcpPacketType,
	type RtcpPacketDump,
	COMMON_HEADER_LENGTH,
} from './RtcpPacket';
import { Serializable, type SerializableDump } from '../Serializable';

// Common RTCP header length + 4 (SSRC of packet sender).
const FIXED_HEADER_LENGTH = COMMON_HEADER_LENGTH + 4;

export const RECEPTION_REPORT_LENGTH = 24;

/**
 * RTCP Receiver Report packet info dump.
 *
 * @category RTCP
 */
export type ReceiverReportPacketDump = RtcpPacketDump & {
	ssrc: number;
	reports: ReceptionReportDump[];
};

/**
 * Reception Report dump.
 *
 * @category RTCP
 */
export type ReceptionReportDump = SerializableDump & {
	ssrc: number;
	fractionLost: number;
	totalLost: number;
	highestSeq: number;
	jitter: number;
	lsr: number;
	dlsr: number;
};

/**
 * RTCP Receiver Report packet.
 *
 * ```text
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    RC   |   PT=RR=201   |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                     SSRC of packet sender                     |
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * report |                 SSRC_1 (SSRC of first source)                 |
 * block  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *   1    | fraction lost |       cumulative number of packets lost       |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |           extended highest sequence number received           |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                      interarrival jitter                      |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                         last SR (LSR)                         |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                   delay since last SR (DLSR)                  |
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * report |                 SSRC_2 (SSRC of second source)                |
 * block  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *   2    :                               ...                             :
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *        |                  profile-specific extensions                  |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 3550 section 6.4.2](https://datatracker.ietf.org/doc/html/rfc3550#section-6.4.2)
 */
export class ReceiverReportPacket extends RtcpPacket {
	// Reception Reports.
	#reports: ReceptionReport[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP Receiver
	 *   Report packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP Receiver Report packet.
	 */
	constructor(view?: DataView) {
		super(RtcpPacketType.RR, view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to Reception Reports.
		pos += FIXED_HEADER_LENGTH;

		let count = this.getCount();

		while (count-- > 0) {
			const reportView = new DataView(
				this.view.buffer,
				this.view.byteOffset +
					FIXED_HEADER_LENGTH +
					this.#reports.length * RECEPTION_REPORT_LENGTH,
				RECEPTION_REPORT_LENGTH
			);

			pos += RECEPTION_REPORT_LENGTH;

			const report = new ReceptionReport(reportView);

			this.#reports.push(report);
		}

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength) {
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump Receiver Report packet info.
	 */
	override dump(): ReceiverReportPacketDump {
		return {
			...super.dump(),
			ssrc: this.getSsrc(),
			reports: this.#reports.map(report => report.dump()),
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		if (!this.needsSerialization()) {
			return this.view.byteLength;
		}

		const packetLength =
			FIXED_HEADER_LENGTH +
			this.#reports.length * RECEPTION_REPORT_LENGTH +
			this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	override needsSerialization(): boolean {
		return (
			super.needsSerialization() ||
			this.#reports.some(report => report.needsSerialization())
		);
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

		// Copy the rest of the fixed header into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset + pos,
				FIXED_HEADER_LENGTH - COMMON_HEADER_LENGTH
			),
			pos
		);

		// Move to Reception Reports.
		pos += FIXED_HEADER_LENGTH - COMMON_HEADER_LENGTH;

		// Write Reception Reports.
		for (const report of this.#reports) {
			report.serialize(view.buffer, view.byteOffset + pos);

			pos += report.getByteLength();
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength) {
			throw new RangeError(
				`filled length (${pos} bytes) is different than the available buffer size (${view.byteLength} bytes)`
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
	): ReceiverReportPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new ReceiverReportPacket(view);
	}

	/**
	 * Get sender SSRC.
	 */
	getSsrc(): number {
		return this.view.getUint32(4);
	}

	/**
	 * Set sender SSRC.
	 */
	setSsrc(ssrc: number): void {
		this.view.setUint32(4, ssrc);
	}

	/**
	 * Get Reception Reports.
	 */
	getReports(): ReceptionReport[] {
		return Array.from(this.#reports);
	}

	/**
	 * Set Reception Reports.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setReports(reports: ReceptionReport[]): void {
		this.#reports = Array.from(reports);

		// Update RTCP count.
		this.setCount(this.#reports.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add Reception Report.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	addReport(report: ReceptionReport): void {
		this.#reports.push(report);

		// Update RTCP count.
		this.setCount(this.#reports.length);

		this.setSerializationNeeded(true);
	}
}

/**
 * RTCP Reception Report.
 *
 * @category RTCP
 */
export class ReceptionReport extends Serializable {
	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP Receiver
	 *   Report will be created.
	 */
	constructor(view?: DataView) {
		super(view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(RECEPTION_REPORT_LENGTH));

			return;
		}

		if (this.view.byteLength !== RECEPTION_REPORT_LENGTH) {
			throw new TypeError('wrong byte length for a RTCP Reception Report');
		}
	}

	/**
	 * Dump Reception Report info.
	 */
	override dump(): ReceptionReportDump {
		return {
			...super.dump(),
			ssrc: this.getSsrc(),
			fractionLost: this.getFractionLost(),
			totalLost: this.getTotalLost(),
			highestSeq: this.getHighestSeqNumber(),
			jitter: this.getJitter(),
			lsr: this.getLastSRTimestamp(),
			dlsr: this.getDelaySinceLastSR(),
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		return RECEPTION_REPORT_LENGTH;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBufferLike, byteOffset?: number): void {
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

		// Copy the entire report into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset,
				RECEPTION_REPORT_LENGTH
			),
			0
		);

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
	): ReceptionReport {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new ReceptionReport(view);
	}

	/**
	 * Get receiver SSRC.
	 */
	getSsrc(): number {
		return this.view.getUint32(0);
	}

	/**
	 * Set receiver SSRC.
	 */
	setSsrc(ssrc: number): void {
		this.view.setUint32(0, ssrc);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get fraction lost.
	 */
	getFractionLost(): number {
		return this.view.getUint8(4);
	}

	/**
	 * Set fraction lost.
	 */
	setFractionLost(fractionLost: number): void {
		this.view.setUint8(4, fractionLost);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get total lost.
	 */
	getTotalLost(): number {
		let value = this.view.getUint32(4) & 0x0fff;

		// Possitive value.
		if (((value >> 23) & 1) == 0) {
			return value;
		}

		// Negative value.
		if (value != 0x0800000) {
			value &= ~(1 << 23);
		}

		return -value;
	}

	/**
	 * Set total lost.
	 */
	setTotalLost(totalLost: number): void {
		// Get the limit value for possitive and negative total lost.
		const clamp =
			totalLost >= 0
				? totalLost > 0x07fffff
					? 0x07fffff
					: totalLost
				: -totalLost > 0x0800000
					? 0x0800000
					: -totalLost;

		const value = totalLost >= 0 ? clamp & 0x07fffff : clamp | 0x0800000;
		const fractionLost = this.view.getUint8(4);

		this.view.setUint32(4, value);
		this.view.setUint8(4, fractionLost);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get highest RTP sequence number.
	 */
	getHighestSeqNumber(): number {
		return this.view.getUint32(8);
	}

	/**
	 * Set highest RTP sequence number.
	 */
	setHighestSeqNumber(seq: number): void {
		this.view.setUint32(8, seq);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get interarrival jitter.
	 */
	getJitter(): number {
		return this.view.getUint32(12);
	}

	/**
	 * Set interarrival jitter.
	 */
	setJitter(jitter: number): void {
		this.view.setUint32(12, jitter);

		this.setSerializationNeeded(true);
	}

	/**
	 * Set last Sender Report timestamp.
	 */
	getLastSRTimestamp(): number {
		return this.view.getUint32(16);
	}

	/**
	 * Set last Sender Report timestamp.
	 */
	setLastSRTimestamp(lsr: number): void {
		this.view.setUint32(16, lsr);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get delay since last Sender Report.
	 */
	getDelaySinceLastSR(): number {
		return this.view.getUint32(20);
	}

	/**
	 * Set delay since last Sender Report.
	 */
	setDelaySinceLastSR(dlsr: number): void {
		this.view.setUint32(20, dlsr);

		this.setSerializationNeeded(true);
	}
}
