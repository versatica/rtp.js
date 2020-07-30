import { isRtcp, RtcpPacket, RtcpPacketType } from './';

/**
        0                   1                   2                   3
        0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
header |V=2|P|    RC   |   PT=RR=201   |             length            |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                     SSRC of packet sender                     |
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

/** @ignore */
const REPORT_LENGTH = 24;
/** @ignore */
const FIXED_HEADER_LENGTH = 4 + 4; // Common RTCP header length + 4.

/**
 * ```ts
 * import { ReceiverReport } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Receiver Report.
 */
export class ReceiverReport
{
	// Buffer.
	private buffer: Buffer;

	/**
	 * @param buffer - If given it will be parsed. Otherwise an empty RTCP Receiver
	 *   Report will be created.
	 */
	constructor(buffer?: Buffer)
	{
		// If no buffer is given, create an empty one.
		if (!buffer)
		{
			this.buffer = Buffer.alloc(REPORT_LENGTH);

			return;
		}

		if (buffer.length < REPORT_LENGTH)
		{
			throw new TypeError('buffer is too small');
		}

		this.buffer = buffer.slice(undefined, REPORT_LENGTH);
	}

	/**
	 * @ignore
	 */
	dump(): any
	{
		return {
			ssrc         : this.getSsrc(),
			fractionLost : this.getFractionLost(),
			totaLlost    : this.getTotalLost(),
			lastSeq      : this.getHighestSeqNumber(),
			jitter       : this.getJitter(),
			lsr          : this.getLastSRTimestamp(),
			dlsr         : this.getDelaySinceLastSR()
		};
	}

	/**
	 * Get the internal buffer containing the RTCP Receiver Report binary.
	 */
	getBuffer(): Buffer
	{
		return this.buffer;
	}

	/**
	 * Get receiver SSRC.
	 */
	getSsrc(): number
	{
		return this.buffer.readUInt32BE(0);
	}

	/**
	 * Set receiver SSRC.
	 */
	setSsrc(ssrc: number): void
	{
		this.buffer.writeUInt32BE(ssrc, 0);
	}

	/**
	 * Get fraction lost.
	 */
	getFractionLost(): number
	{
		return this.buffer.readUInt8(4);
	}

	/**
	 * Set fraction lost.
	 */
	setFractionLost(fractionLost: number): void
	{
		this.buffer.writeUInt8(fractionLost, 4);
	}

	/**
	 * Get total lost.
	 */
	getTotalLost(): number
	{
		let value = this.buffer.readUIntBE(5, 3);

		// Possitive value.
		if (((value >> 23) & 1) == 0)
		{
			return value;
		}

		// Negative value.
		if (value != 0x0800000)
		{
			value &= ~(1 << 23);
		}

		return -value;
	}

	/**
	 * Set total lost.
	 */
	setTotalLost(totalLost: number): void
	{
		// Get the limit value for possitive and negative totalLost.
		const clamp = (totalLost >= 0) ? totalLost > 0x07FFFFF ? 0x07FFFFF : totalLost
			: -totalLost > 0x0800000 ? 0x0800000 : -totalLost;

		const value = (totalLost >= 0) ? (clamp & 0x07FFFFF) : (clamp | 0x0800000);

		this.buffer.writeUIntBE(value, 5, 3);
	}

	/**
	 * Get highest RTP sequence number.
	 */
	getHighestSeqNumber(): number
	{
		return this.buffer.readUIntBE(8, 4);
	}

	/**
	 * Set highest RTP sequence number.
	 */
	setHighestSeqNumber(lastSeq: number): void
	{
		this.buffer.writeUIntBE(lastSeq, 8, 4);
	}

	/**
	 * Get interarrival jitter.
	 */
	getJitter(): number
	{
		return this.buffer.readUIntBE(12, 4);
	}

	/**
	 * Set interarrival jitter.
	 */
	setJitter(jitter: number)
	{
		this.buffer.writeUIntBE(jitter, 12, 4);
	}

	/**
	 * Set last Sender Report timestamp.
	 */
	getLastSRTimestamp(): number
	{
		return this.buffer.readUIntBE(16, 4);
	}

	/**
	 * Set last Sender Report timestamp.
	 */
	setLastSRTimestamp(lsr: number): void
	{
		this.buffer.writeUIntBE(lsr, 16, 4);
	}

	/**
	 * Get delay since last Sender Report.
	 */
	getDelaySinceLastSR(): number
	{
		return this.buffer.readUIntBE(20, 4);
	}

	/**
	 * Set delay since last Sender Report.
	 */
	setDelaySinceLastSR(dlsr: number): void
	{
		this.buffer.writeUIntBE(dlsr, 20, 4);
	}
}

/**
 * ```ts
 * import { ReceiverReportPacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Receiver Report packet. It may contain various
 * [[ReceiverReport]] instances.
 */
export class ReceiverReportPacket extends RtcpPacket
{
	// Packet Type.
	static packetType = RtcpPacketType.RR;

	// Receiver Reports.
	private reports: ReceiverReport[] = [];

	/**
	 * @param buffer - If given it will be parsed. Otherwise an empty RTP packet
	 *   will be created.
	 */
	constructor(buffer?: Buffer)
	{
		super(ReceiverReportPacket.packetType);

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
				buffer.slice(FIXED_HEADER_LENGTH + (this.reports.length * REPORT_LENGTH))
			);

			this.addReport(report);
		}

		// Store a buffer within the packet boundaries.
		this.buffer = buffer.slice(
			undefined, FIXED_HEADER_LENGTH + (this.reports.length * REPORT_LENGTH)
		);
	}

	/**
	 * @ignore
	 */
	dump(): any
	{
		return {
			... super.dump(),
			ssrc    : this.getSsrc(),
			reports : this.reports.map((report) => report.dump())
		};
	}

	/**
	 * Get the internal buffer containing the serialized RTP binary packet.
	 */
	getBuffer(): Buffer
	{
		if (this.serializationNeeded)
		{
			this.serialize();
		}

		return this.buffer;
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
	 * Get Receiver Reports.
	 */
	getReports(): ReceiverReport[]
	{
		return this.reports;
	}

	/**
	 * Add a Receiver Report.
	 */
	addReport(report: ReceiverReport): void
	{
		this.reports.push(report);
		this.serializationNeeded = true;
	}

	/**
	 * Apply pending changes into the packet and serialize it into a new internal
	 * buffer (the one that [[getBuffer]] will later return).
	 *
	 * **NOTE:** In most cases there is no need to use this method. It must be
	 * called only if the application retrieves information from the packet (by
	 * calling [[getBuffer]], [[getReports]], etc) and modifies the obtained
	 * buffers in place. However, it's recommended to use the existing setter
	 * methods instead ([[addReport]], etc).
	 *
	 */
	serialize(): void
	{
		// Compute required buffer length.
		const length = FIXED_HEADER_LENGTH + (REPORT_LENGTH * this.reports.length);
		const ssrc = this.getSsrc();

		super.serialize(length);

		this.setCount(this.reports.length);
		this.setSsrc(ssrc);

		for (let i=0; i < this.reports.length; ++i)
		{
			const report = this.reports[i];

			report.getBuffer().copy(this.buffer, FIXED_HEADER_LENGTH + (REPORT_LENGTH * i));
		}

		this.serializationNeeded = false;
	}
}
