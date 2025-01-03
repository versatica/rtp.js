import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	COMMON_HEADER_LENGTH,
} from './RtcpPacket';
import {
	ReceptionReport,
	ReceptionReportDump,
	RECEPTION_REPORT_LENGTH,
} from './ReceiverReportPacket';

// Common RTCP header length + 24.
const FIXED_HEADER_LENGTH = COMMON_HEADER_LENGTH + 24;

/**
 * RTCP Sender Report packet info dump.
 *
 * @category RTCP
 */
export type SenderReportPacketDump = RtcpPacketDump & {
	ssrc: number;
	ntpSeq: number;
	ntpFraction: number;
	rtpTimestamp: number;
	packetCount: number;
	octetCount: number;
	reports: ReceptionReportDump[];
};

/**
 * RTCP Sender Report packet.
 *
 * ```text
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    RC   |   PT=SR=200   |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                         SSRC of sender                        |
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * sender |              NTP timestamp, most significant word             |
 * info   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |             NTP timestamp, least significant word             |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                         RTP timestamp                         |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                     sender's packet count                     |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                      sender's octet count                     |
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
 * - [RFC 3550 section 6.4.1](https://datatracker.ietf.org/doc/html/rfc3550#section-6.4.1)
 */
export class SenderReportPacket extends RtcpPacket {
	// Reception Reports.
	#reports: ReceptionReport[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP Sender
	 *   Report packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP Sender Report packet.
	 */
	constructor(view?: DataView) {
		super(RtcpPacketType.SR, view);

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
	 * Dump Sender Report packet info.
	 */
	dump(): SenderReportPacketDump {
		return {
			...super.dump(),
			ssrc: this.getSsrc(),
			ntpSeq: this.getNtpSeconds(),
			ntpFraction: this.getNtpFraction(),
			rtpTimestamp: this.getRtpTimestamp(),
			packetCount: this.getPacketCount(),
			octetCount: this.getOctetCount(),
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
	needsSerialization(): boolean {
		return (
			super.needsSerialization() ||
			this.#reports.some(report => report.needsSerialization())
		);
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void {
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
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number
	): SenderReportPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new SenderReportPacket(view);
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
	setSsrc(ssrc: number) {
		this.view.setUint32(4, ssrc);
	}

	/**
	 * Get NTP seconds.
	 */
	getNtpSeconds(): number {
		return this.view.getUint32(8);
	}

	/**
	 * Set NTP seconds.
	 */
	setNtpSeconds(seconds: number): void {
		this.view.setUint32(8, seconds);
	}

	/**
	 * Get NTP fraction.
	 */
	getNtpFraction(): number {
		return this.view.getUint32(12);
	}

	/**
	 * Set NTP fraction.
	 */
	setNtpFraction(fraction: number): void {
		this.view.setUint32(12, fraction);
	}

	/**
	 * Get RTP Timestamp.
	 */
	getRtpTimestamp(): number {
		return this.view.getUint32(16);
	}

	/**
	 * Set RTP Timestamp.
	 */
	setRtpTimestamp(timestamp: number): void {
		this.view.setUint32(16, timestamp);
	}

	/**
	 * Get RTP packet count.
	 */
	getPacketCount(): number {
		return this.view.getUint32(20);
	}

	/**
	 * Set RTP packet count.
	 */
	setPacketCount(count: number): void {
		this.view.setUint32(20, count);
	}

	/**
	 * Get RTP octet count.
	 */
	getOctetCount(): number {
		return this.view.getUint32(24);
	}

	/**
	 * Set RTP octet count.
	 */
	setOctetCount(count: number): void {
		this.view.setUint32(24, count);
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
