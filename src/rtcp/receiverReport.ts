import { isRtcp, RtcpPacket, RtcpPacketType, RtcpPacketDump } from './';
import { clone } from '../utils';

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

// Common RTCP header length + 4.
const FIXED_HEADER_LENGTH = 4 + 4;

export const REPORT_LENGTH = 24;

/**
 * Receiver Report packet dump.
 */
export type ReceiverReportPacketDump = RtcpPacketDump &
{
	ssrc: number;
	reports: ReceiverReportDump[];
};

/**
 * Receiver Report dump.
 */
export type ReceiverReportDump =
{
	ssrc: number;
	fractionLost: number;
	totaLlost: number;
	lastSeq: number;
	jitter: number;
	lsr: number;
	dlsr: number;
};

/**
 * ```ts
 * import { ReceiverReportPacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Receiver Report packet. It may contain various
 * {@link ReceiverReport} instances.
 */
export class ReceiverReportPacket extends RtcpPacket
{
	// Packet Type.
	static packetType = RtcpPacketType.RR;

	// Receiver Reports.
	readonly #reports: ReceiverReport[] = [];

	/**
	 * @param buffer - If given it will be parsed. Otherwise an empty RTP packet
	 *   will be created.
	 */
	constructor(buffer?: ArrayBuffer)
	{
		super(ReceiverReportPacket.packetType);

		// If no buffer is given, create an empty one with minimum required length.
		if (!buffer)
		{
			this.buffer = new ArrayBuffer(FIXED_HEADER_LENGTH);
			this.view = new DataView(this.buffer);

			this.writeCommonHeader();

			return;
		}

		if (!isRtcp(buffer))
		{
			throw new TypeError('invalid RTCP packet');
		}

		// Get padding.
		const paddingFlag = Boolean((this.view.getUint8(0) >> 5) & 1);

		if (paddingFlag)
		{
			// NOTE: This will throw RangeError if there is no space in the buffer.
			this.padding =
				this.view.getUint8(((RtcpPacket.getLength(this.buffer) * 4) + 4 - 1));
		}

		let count = RtcpPacket.getCount(this.buffer);

		if (this.buffer.byteLength < FIXED_HEADER_LENGTH + (count * REPORT_LENGTH))
		{
			throw new TypeError('buffer is too small');
		}

		while (count-- > 0)
		{
			const report = new ReceiverReport(
				this.buffer.slice(FIXED_HEADER_LENGTH + (this.#reports.length * REPORT_LENGTH))
			);

			this.addReport(report);
		}

		// Store a buffer within the packet boundaries.
		this.buffer = this.buffer.slice(
			0,
			FIXED_HEADER_LENGTH + (this.#reports.length * REPORT_LENGTH) + this.padding
		);

		this.view = new DataView(this.buffer);
	}

	/**
	 * Dump Receiver Report packet info.
	 */
	dump(): ReceiverReportPacketDump
	{
		return {
			...super.dump(),
			ssrc    : this.getSsrc(),
			reports : this.#reports.map((report) => report.dump())
		};
	}

	/**
	 * Get sender SSRC.
	 */
	getSsrc(): number
	{
		return this.view.getUint32(4);
	}

	/**
	 * Set sender SSRC.
	 */
	setSsrc(ssrc: number)
	{
		this.view.setUint32(4, ssrc);
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
	clone(): ReceiverReportPacket
	{
		if (this.serializationNeeded)
		{
			this.serialize();
		}

		return new ReceiverReportPacket(clone<ArrayBuffer>(this.buffer));
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
	 */
	serialize(): void
	{
		// Compute required buffer length.
		const length = FIXED_HEADER_LENGTH + (REPORT_LENGTH * this.#reports.length);
		const ssrc = this.getSsrc();

		super.serializeBase(length);

		this.setCount(this.#reports.length);
		this.setSsrc(ssrc);

		const newArray = new Uint8Array(this.buffer);

		for (let i = 0; i < this.#reports.length; ++i)
		{
			const report = this.#reports[i];

			newArray.set(
				new Uint8Array(report.getBuffer()),
				FIXED_HEADER_LENGTH + (REPORT_LENGTH * i)
			);
		}

		// Reset flag.
		this.serializationNeeded = false;
	}
}

/**
 * ```ts
 * import { ReceiverReport } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Receiver Report.
 */
export class ReceiverReport
{
	// ArrayBuffer holding report binary data.
	#buffer: ArrayBuffer;
	// DataView holding the ArrayBuffer.
	#view: DataView;

	/**
	 * @param buffer - If given it will be parsed. Otherwise an empty RTCP Receiver
	 *   Report will be created.
	 */
	constructor(buffer?: ArrayBuffer)
	{
		// If no buffer is given, create an empty one.
		if (!buffer)
		{
			this.#buffer = new ArrayBuffer(REPORT_LENGTH);
			this.#view = new DataView(this.#buffer);

			return;
		}

		if (buffer.byteLength < REPORT_LENGTH)
		{
			throw new TypeError('buffer is too small');
		}
		else if (buffer.byteLength > REPORT_LENGTH)
		{
			throw new TypeError('buffer is too big');
		}

		this.#buffer = buffer.slice(0, REPORT_LENGTH);
		this.#view = new DataView(this.#buffer);
	}

	/**
	 * Dump ReceiverReport info.
	 */
	dump(): ReceiverReportDump
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
	getBuffer(): ArrayBuffer
	{
		return this.#buffer;
	}

	/**
	 * Get receiver SSRC.
	 */
	getSsrc(): number
	{
		return this.#view.getUint32(0);
	}

	/**
	 * Set receiver SSRC.
	 */
	setSsrc(ssrc: number): void
	{
		this.#view.setUint32(0, ssrc);
	}

	/**
	 * Get fraction lost.
	 */
	getFractionLost(): number
	{
		return this.#view.getUint8(4);
	}

	/**
	 * Set fraction lost.
	 */
	setFractionLost(fractionLost: number): void
	{
		this.#view.setUint8(4, fractionLost);
	}

	/**
	 * Get total lost.
	 */
	getTotalLost(): number
	{
		// We need to read 3 bytes in Big Endian (network byte order) so must read
		// 4 and ignore the last one.
		let value = this.#view.getUint32(5) >> 8;

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

		// We need to write 3 bytes but we must use setUint32() (there is no
		// setUint24()). So read the 4th byte after these 3 target bytes in the
		// buffer, shift them 1 byte to the left and sum the 4th byte. Then write
		// the 4 bytes in the buffer.

		const byte4 = this.#view.getUint8(8);

		this.#view.setUint32(5, (value << 8) + byte4);
	}

	/**
	 * Get highest RTP sequence number.
	 */
	getHighestSeqNumber(): number
	{
		return this.#view.getUint32(8);
	}

	/**
	 * Set highest RTP sequence number.
	 */
	setHighestSeqNumber(lastSeq: number): void
	{
		this.#view.setUint32(8, lastSeq);
	}

	/**
	 * Get interarrival jitter.
	 */
	getJitter(): number
	{
		return this.#view.getUint32(12);
	}

	/**
	 * Set interarrival jitter.
	 */
	setJitter(jitter: number)
	{
		this.#view.setUint32(12, jitter);
	}

	/**
	 * Set last Sender Report timestamp.
	 */
	getLastSRTimestamp(): number
	{
		return this.#view.getUint32(16);
	}

	/**
	 * Set last Sender Report timestamp.
	 */
	setLastSRTimestamp(lsr: number): void
	{
		this.#view.setUint32(16, lsr);
	}

	/**
	 * Get delay since last Sender Report.
	 */
	getDelaySinceLastSR(): number
	{
		return this.#view.getUint32(20);
	}

	/**
	 * Set delay since last Sender Report.
	 */
	setDelaySinceLastSR(dlsr: number): void
	{
		this.#view.setUint32(20, dlsr);
	}

	/**
	 * Clone the Receiver Report. The cloned report does not share any memory
	 * with the original one.
	 */
	clone(): ReceiverReport
	{
		return new ReceiverReport(clone<ArrayBuffer>(this.#buffer));
	}
}
