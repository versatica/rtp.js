import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	getRtcpLength,
	COMMON_HEADER_LENGTH
} from './RtcpPacket';
import { Serializable, SerializableDump } from '../Serializable';

/**
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
 */

// Common RTCP header length + 4 (SSRC of packet sender).
const FIXED_HEADER_LENGTH = COMMON_HEADER_LENGTH + 4;

export const RECEPTION_REPORT_LENGTH = 24;

/**
 * RTCP Receiver Report packet info dump.
 */
export type ReceiverReportPacketDump = RtcpPacketDump &
{
	ssrc: number;
	reports: ReceptionReportDump[];
};

/**
 * Reception Report dump.
 */
export type ReceptionReportDump = SerializableDump &
{
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
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class ReceiverReportPacket extends RtcpPacket
{
	// Reception Reports.
	#reports: ReceptionReport[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP Receiver
	 *   Report packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP Receiver Report packet.
	 */
	constructor(view?: DataView)
	{
		super(RtcpPacketType.RR, view);

		if (!this.view)
		{
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

		while (count-- > 0)
		{
			const reportView = new DataView(
				this.view.buffer,
				this.view.byteOffset
					+ FIXED_HEADER_LENGTH
					+ (this.#reports.length * RECEPTION_REPORT_LENGTH),
				RECEPTION_REPORT_LENGTH
			);

			pos += RECEPTION_REPORT_LENGTH;

			const report = new ReceptionReport(reportView);

			this.#reports.push(report);
		}

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
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
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		if (!this.needsSerialization())
		{
			return this.view.byteLength;
		}

		const packetLength =
			FIXED_HEADER_LENGTH +
			(this.#reports.length * RECEPTION_REPORT_LENGTH) +
			this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	needsSerialization(): boolean
	{
		return (
			super.needsSerialization() ||
			this.#reports.some((report) => report.needsSerialization())
		);
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const view = super.serializeBase();
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
		for (const report of this.#reports)
		{
			// NOTE: ReceptionReport class has fixed length so we don't need to deal
			// with calls to serialize() on it.

			const reportView = report.getView();

			uint8Array.set(
				new Uint8Array(
					reportView.buffer,
					reportView.byteOffset,
					RECEPTION_REPORT_LENGTH
				),
				pos
			);

			pos += RECEPTION_REPORT_LENGTH;
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength)
		{
			throw new RangeError(
				`computed packet length (${pos} bytes) is different than the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Assert that RTCP header length field is correct.
		if (getRtcpLength(view) !== view.byteLength)
		{
			throw new RangeError(
				`length in the RTCP header (${getRtcpLength(view)} bytes) does not match the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): ReceiverReportPacket
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new ReceiverReportPacket(view);
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
	 * Get Reception Reports.
	 */
	getReports(): ReceptionReport[]
	{
		return Array.from(this.#reports);
	}

	/**
	 * Set Reception Reports.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setReports(reports: ReceptionReport[]): void
	{
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
	addReport(report: ReceptionReport): void
	{
		this.#reports.push(report);

		// Update RTCP count.
		this.setCount(this.#reports.length);

		this.setSerializationNeeded(true);
	}
}

/**
 * RTCP Reception Report.
 */
export class ReceptionReport extends Serializable
{
	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP Receiver
	 *   Report will be created.
	 */
	constructor(view?: DataView)
	{
		super(view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(RECEPTION_REPORT_LENGTH));

			return;
		}

		if (this.view.byteLength !== RECEPTION_REPORT_LENGTH)
		{
			throw new TypeError('wrong byte length for a RTCP Reception Report');
		}
	}

	/**
	 * Dump Reception Report info.
	 */
	dump(): ReceptionReportDump
	{
		return {
			...super.dump(),
			ssrc         : this.getSsrc(),
			fractionLost : this.getFractionLost(),
			totalLost    : this.getTotalLost(),
			highestSeq   : this.getHighestSeqNumber(),
			jitter       : this.getJitter(),
			lsr          : this.getLastSRTimestamp(),
			dlsr         : this.getDelaySinceLastSR()
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		return RECEPTION_REPORT_LENGTH;
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		// Nothing to do.

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): ReceptionReport
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new ReceptionReport(view);
	}

	/**
	 * Get receiver SSRC.
	 */
	getSsrc(): number
	{
		return this.view.getUint32(0);
	}

	/**
	 * Set receiver SSRC.
	 */
	setSsrc(ssrc: number): void
	{
		this.view.setUint32(0, ssrc);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get fraction lost.
	 */
	getFractionLost(): number
	{
		return this.view.getUint8(4);
	}

	/**
	 * Set fraction lost.
	 */
	setFractionLost(fractionLost: number): void
	{
		this.view.setUint8(4, fractionLost);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get total lost.
	 */
	getTotalLost(): number
	{
		let value = this.view.getUint32(4) & 0x0FFF;

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
		// Get the limit value for possitive and negative total lost.
		const clamp = (totalLost >= 0)
			? totalLost > 0x07FFFFF
				? 0x07FFFFF
				: totalLost
			: -totalLost > 0x0800000
				? 0x0800000
				: -totalLost;

		const value = (totalLost >= 0) ? (clamp & 0x07FFFFF) : (clamp | 0x0800000);
		const fractionLost = this.view.getUint8(4);

		this.view.setUint32(4, value);
		this.view.setUint8(4, fractionLost);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get highest RTP sequence number.
	 */
	getHighestSeqNumber(): number
	{
		return this.view.getUint32(8);
	}

	/**
	 * Set highest RTP sequence number.
	 */
	setHighestSeqNumber(seq: number): void
	{
		this.view.setUint32(8, seq);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get interarrival jitter.
	 */
	getJitter(): number
	{
		return this.view.getUint32(12);
	}

	/**
	 * Set interarrival jitter.
	 */
	setJitter(jitter: number)
	{
		this.view.setUint32(12, jitter);

		this.setSerializationNeeded(true);
	}

	/**
	 * Set last Sender Report timestamp.
	 */
	getLastSRTimestamp(): number
	{
		return this.view.getUint32(16);
	}

	/**
	 * Set last Sender Report timestamp.
	 */
	setLastSRTimestamp(lsr: number): void
	{
		this.view.setUint32(16, lsr);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get delay since last Sender Report.
	 */
	getDelaySinceLastSR(): number
	{
		return this.view.getUint32(20);
	}

	/**
	 * Set delay since last Sender Report.
	 */
	setDelaySinceLastSR(dlsr: number): void
	{
		this.view.setUint32(20, dlsr);

		this.setSerializationNeeded(true);
	}
}
