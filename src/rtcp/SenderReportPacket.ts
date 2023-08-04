import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	getRtcpPacketType,
	getRtcpLength,
	COMMON_HEADER_LENGTH
} from './RtcpPacket';
import {
	ReceiverReport,
	ReceiverReportDump,
	RECEIVER_REPORT_LENGTH
} from './ReceiverReportPacket';

/**
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
 */

// Common RTCP header length + 24.
const FIXED_HEADER_LENGTH = COMMON_HEADER_LENGTH + 24;

/**
 * RTCP Sender Report packet info dump.
 */
export type SenderReportPacketDump = RtcpPacketDump &
{
	ssrc: number;
	ntpSeq: number;
	ntpFraction: number;
	rtpTimestamp: number;
	packetCount: number;
	octectCount: number;
	reports: ReceiverReportDump[];
};

/**
 * RTCP Sender Report packet.
 */
export class SenderReportPacket extends RtcpPacket
{
	// Receiver Reports.
	#reports: ReceiverReport[] = [];

	/**
	 * @param view - If given if will be parsed. Otherwise an empty RTCP Sender
	 *   Report packet (with just the minimal fixed header) will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP Sender Report packet.
	 */
	constructor(view?: DataView)
	{
		super(RtcpPacketType.SR, view);

		if (!view)
		{
			this.packetView = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			return;
		}

		if (getRtcpPacketType(view) !== RtcpPacketType.SR)
		{
			throw new TypeError('not a RTCP Sender Report packet');
		}
		else if (getRtcpLength(view) !== view.byteLength)
		{
			throw new RangeError(
				`length in the RTCP header (${getRtcpLength(view)} bytes) does not match view length (${view.byteLength} bytes)`
			);
		}

		this.packetView = view;

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to Receiver Reports.
		pos += FIXED_HEADER_LENGTH;

		let count = this.getCount();

		while (count-- > 0)
		{
			const reportView = new DataView(
				this.packetView.buffer,
				this.packetView.byteOffset
					+ FIXED_HEADER_LENGTH
					+ (this.#reports.length * RECEIVER_REPORT_LENGTH),
				RECEIVER_REPORT_LENGTH
			);

			const report = new ReceiverReport(reportView);

			this.#reports.push(report);

			pos += RECEIVER_REPORT_LENGTH;
		}

		// Get padding.
		if (this.getPaddingBit())
		{
			this.padding = this.packetView.getUint8(this.packetView.byteLength - 1);
		}

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.packetView.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.packetView.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump Sender Report packet info.
	 */
	dump(): SenderReportPacketDump
	{
		return {
			...super.dump(),
			ssrc         : this.getSsrc(),
			ntpSeq       : this.getNtpSeconds(),
			ntpFraction  : this.getNtpFraction(),
			rtpTimestamp : this.getRtpTimestamp(),
			packetCount  : this.getPacketCount(),
			octectCount  : this.getOctetCount(),
			reports      : this.#reports.map((report) => report.dump())
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		const packetLength =
			FIXED_HEADER_LENGTH +
			(this.#reports.length * RECEIVER_REPORT_LENGTH) +
			this.padding;

		return packetLength;
	}

	/**
	 * Get sender SSRC.
	 */
	getSsrc(): number
	{
		return this.packetView.getUint32(4);
	}

	/**
	 * Set sender SSRC.
	 */
	setSsrc(ssrc: number)
	{
		this.packetView.setUint32(4, ssrc);
	}

	/**
	 * Get NTP seconds.
	 */
	getNtpSeconds(): number
	{
		return this.packetView.getUint32(8);
	}

	/**
	 * Set NTP seconds.
	 */
	setNtpSeconds(seconds: number): void
	{
		this.packetView.setUint32(8, seconds);
	}

	/**
	 * Get NTP fraction.
	 */
	getNtpFraction(): number
	{
		return this.packetView.getUint32(12);
	}

	/**
	 * Set NTP fraction.
	 */
	setNtpFraction(fraction: number): void
	{
		this.packetView.setUint32(12, fraction);
	}

	/**
	 * Get RTP Timestamp.
	 */
	getRtpTimestamp(): number
	{
		return this.packetView.getUint32(16);
	}

	/**
	 * Set RTP Timestamp.
	 */
	setRtpTimestamp(timestamp: number): void
	{
		this.packetView.setUint32(16, timestamp);
	}

	/**
	 * Get RTP packet count.
	 */
	getPacketCount(): number
	{
		return this.packetView.getUint32(20);
	}

	/**
	 * Set RTP packet count.
	 */
	setPacketCount(count: number): void
	{
		this.packetView.setUint32(20, count);
	}

	/**
	 * Get RTP octect count.
	 */
	getOctetCount(): number
	{
		return this.packetView.getUint32(24);
	}

	/**
	 * Set RTP octect count.
	 */
	setOctetCount(count: number): void
	{
		this.packetView.setUint32(24, count);
	}

	/**
	 * Get Receiver Reports.
	 */
	getReports(): ReceiverReport[]
	{
		return Array.from(this.#reports);
	}

	/**
	 * Set Receiver Reports.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setReports(reports: ReceiverReport[]): void
	{
		this.#reports = reports;

		// Update RTCP count.
		this.setCount(this.#reports.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const packetView = super.serializeBase();
		const packetUint8Array = new Uint8Array(
			packetView.buffer,
			packetView.byteOffset,
			packetView.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to the fixed header fields after the common header.
		pos += COMMON_HEADER_LENGTH;

		// Copy the rest of the fixed header into the new buffer.
		packetUint8Array.set(
			new Uint8Array(
				this.packetView.buffer,
				this.packetView.byteOffset + pos,
				FIXED_HEADER_LENGTH - COMMON_HEADER_LENGTH
			),
			pos
		);

		// Move to Receiver Reports.
		pos += FIXED_HEADER_LENGTH - COMMON_HEADER_LENGTH;

		// Write Receiver Reports.
		for (const report of this.#reports)
		{
			const reportView = report.getView();

			packetUint8Array.set(
				new Uint8Array(
					reportView.buffer,
					reportView.byteOffset,
					RECEIVER_REPORT_LENGTH
				),
				pos
			);

			pos += RECEIVER_REPORT_LENGTH;
		}

		// Assert that current position is equal than new buffer length.
		if (pos !== packetView.byteLength)
		{
			throw new RangeError(
				`computed packet length (${pos} bytes) is different than the available buffer size (${packetView.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.packetView = packetView;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): SenderReportPacket
	{
		const destPacketView = this.cloneInternal(buffer, byteOffset);

		return new SenderReportPacket(destPacketView);
	}
}
