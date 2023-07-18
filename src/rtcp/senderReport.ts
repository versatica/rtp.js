import { isRtcp, RtcpPacket, RtcpPacketType, RtcpPacketDump } from './';
import {
	ReceiverReport,
	ReceiverReportDump,
	REPORT_LENGTH
} from './receiverReport';
import { clone } from '../utils';

/**
        0                   1                   2                   3
        0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
header |V=2|P|    RC   |   PT=SR=200   |             length            |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                         SSRC of sender                        |
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
sender |              NTP timestamp, most significant word             |
info   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |             NTP timestamp, least significant word             |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                         RTP timestamp                         |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                     sender's packet count                     |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                      sender's octet count                     |
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
report |                 SSRC_1 (SSRC of first source)                 |
block  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  1    | fraction lost |       cumulative number of packets lost       |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |           extended highest sequence number received           |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                      interarrival jitter                      |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                         last SR (LSR)                         |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                   delay since last SR (DLSR)                  |
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
report |                 SSRC_2 (SSRC of second source)                |
block  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  2    :                               ...                             :
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
       |                  profile-specific extensions                  |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 */

// Common RTCP header length + 24.
const FIXED_HEADER_LENGTH = 4 + 24;

/**
 * Sender Report packet dump.
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
 * ```ts
 * import { SenderReportPacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Sender Report packet. It may contain various
 * {@link ReceiverReport} instances.
 */
export class SenderReportPacket extends RtcpPacket
{
	// Packet Type.
	static packetType = RtcpPacketType.SR;

	// Receiver Reports.
	readonly #reports: ReceiverReport[] = [];

	/**
	 * @param buffer - If given it will be parsed. Otherwise an empty RTP packet
	 *   will be created.
	 */
	constructor(buffer?: Buffer)
	{
		super(SenderReportPacket.packetType);

		// If no buffer is given, create an empty one with minimum required length.
		if (!buffer)
		{
			this.buffer = Buffer.alloc(FIXED_HEADER_LENGTH);
			this.writeCommonHeader();

			return;
		}

		if (!isRtcp(buffer))
		{
			throw new TypeError('invalid RTCP packet');
		}

		// Get padding.
		const paddingFlag = Boolean((buffer.readUInt8() >> 5) & 1);

		if (paddingFlag)
		{
			// NOTE: This will throw RangeError if there is no space in the buffer.
			this.padding = buffer.readUInt8(((RtcpPacket.getLength(buffer) * 4) + 4 - 1));
		}

		let count = RtcpPacket.getCount(buffer);

		if (buffer.length < FIXED_HEADER_LENGTH + (count * REPORT_LENGTH))
		{
			throw new TypeError('buffer is too small');
		}

		while (count-- > 0)
		{
			const report = new ReceiverReport(
				buffer.slice(FIXED_HEADER_LENGTH + (this.#reports.length * REPORT_LENGTH))
			);

			this.addReport(report);
		}

		// Store a buffer within the packet boundaries.
		this.buffer = buffer.slice(
			undefined,
			FIXED_HEADER_LENGTH + (this.#reports.length * REPORT_LENGTH) + this.padding
		);
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
	 * Get sender SSRC.
	 */
	getSsrc(): number
	{
		return this.buffer.readUInt32BE(4);
	}

	/**
	 * Set sender SSRC.
	 */
	setSsrc(ssrc: number)
	{
		this.buffer.writeUInt32BE(ssrc, 4);
	}

	/**
	 * Get NTP seconds.
	 */
	getNtpSeconds(): number
	{
		return this.buffer.readUInt32BE(8);
	}

	/**
	 * Set NTP seconds.
	 */
	setNtpSeconds(seconds: number): void
	{
		this.buffer.writeUInt32BE(seconds, 8);
	}

	/**
	 * Get NTP fraction.
	 */
	getNtpFraction(): number
	{
		return this.buffer.readUInt32BE(12);
	}

	/**
	 * Set NTP fraction.
	 */
	setNtpFraction(fraction: number): void
	{
		this.buffer.writeUInt32BE(fraction, 12);
	}

	/**
	 * Get RTP Timestamp.
	 */
	getRtpTimestamp(): number
	{
		return this.buffer.readUInt32BE(16);
	}

	/**
	 * Set RTP Timestamp.
	 */
	setRtpTimestamp(timestamp: number): void
	{
		this.buffer.writeUInt32BE(timestamp, 16);
	}

	/**
	 * Get RTP packet count.
	 */
	getPacketCount(): number
	{
		return this.buffer.readUInt32BE(20);
	}

	/**
	 * Set RTP packet count.
	 */
	setPacketCount(timestamp: number): void
	{
		this.buffer.writeUInt32BE(timestamp, 20);
	}

	/**
	 * Get RTP octect count.
	 */
	getOctetCount(): number
	{
		return this.buffer.readUInt32BE(24);
	}

	/**
	 * Set RTP octect count.
	 */
	setOctetCount(timestamp: number): void
	{
		this.buffer.writeUInt32BE(timestamp, 24);
	}
	/**
	 * Get Receiver Reports.
	 */
	getReports(): ReceiverReport[]
	{
		return this.#reports;
	}

	/**
	 * Add a Receiver Report.
	 */
	addReport(report: ReceiverReport): void
	{
		this.#reports.push(report);
		this.serializationNeeded = true;
	}

	/**
	 * Clone the packet. The cloned packet does not share any memory with the
	 * original one.
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 */
	clone(): SenderReportPacket
	{
		if (this.serializationNeeded)
		{
			this.serialize();
		}

		return new SenderReportPacket(clone<Buffer>(this.buffer));
	}

	/**
	 * Apply pending changes into the packet and serialize it into a new internal
	 * buffer (the one that {@link getBuffer} will later return).
	 *
	 * @remarks
	 * In most cases there is no need to use this method. It must be
	 * called only if the application retrieves information from the packet (by
	 * calling {@link getBuffer}, {@link getReports}, etc) and modifies the
	 * obtained buffers in place. However, it's recommended to use the existing
	 * setter methods instead ({@link addReport}, etc).
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 *
	 */
	serialize(): void
	{
		// Compute required buffer length.
		const length = FIXED_HEADER_LENGTH + (REPORT_LENGTH * this.#reports.length);
		const ssrc = this.getSsrc();
		const ntpSeconds = this.getNtpSeconds();
		const ntpFraction = this.getNtpFraction();
		const rtpTimestamp = this.getRtpTimestamp();
		const packetCount = this.getPacketCount();
		const octetCount = this.getOctetCount();

		super.serializeBase(length);

		this.setCount(this.#reports.length);
		this.setSsrc(ssrc);
		this.setNtpSeconds(ntpSeconds);
		this.setNtpFraction(ntpFraction);
		this.setRtpTimestamp(rtpTimestamp);
		this.setPacketCount(packetCount);
		this.setOctetCount(octetCount);

		for (let i=0; i < this.#reports.length; ++i)
		{
			const report = this.#reports[i];

			report.getBuffer().copy(this.buffer, FIXED_HEADER_LENGTH + (REPORT_LENGTH * i));
		}

		// Reset flag.
		this.serializationNeeded = false;
	}
}
