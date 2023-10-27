import { RtcpPacketType } from './RtcpPacket';
import {
	FeedbackPacket,
	RtpFeedbackMessageType,
	FeedbackPacketDump,
	FIXED_HEADER_LENGTH
} from './FeedbackPacket';

const TCC_MIN_PACKET_LENGTH = FIXED_HEADER_LENGTH + 8;
const MAX_MISSING_PACKETS = (1 << 13) - 1;
const MAX_PACKET_STATUS_COUNT = (1 << 16) - 1;
const MAX_PACKET_DELTA = 0x7FFF;

/**
 * RTCP TCC packet info dump.
 *
 * @category RTCP
 */
export type TccPacketDump = FeedbackPacketDump &
{
	baseSequenceNumber: number;
	packetStatusCount: number;
	referenceTime: number;
	feedbackPacketCount: number;
	packetChunks: number[];
	recvDeltas: number[];
};

/**
 * RTCP TCC packet (RTCP Transport Layer Feedback).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=15 |    PT=205     |           length              |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     SSRC of packet sender                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                      SSRC of media source                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |      base sequence number     |      packet status count      |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                 reference time                | fb pkt. count |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |          packet chunk         |         packet chunk          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * .                                                               .
 * .                                                               .
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |         packet chunk          |  recv delta   |  recv delta   |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * .                                                               .
 * .                                                               .
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |           recv delta          |  recv delta   | zero padding  |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [draft-holmer-rmcat-transport-wide-cc-extensions-01 section 3.1](https://datatracker.ietf.org/doc/html/draft-holmer-rmcat-transport-wide-cc-extensions-01#section-3.1)
 */
export class TccPacket extends FeedbackPacket
{
	#items: { pid: number; bitmask: number }[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP TCC
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP TCC packet.
	 */
	constructor(view?: DataView)
	{
		super(RtcpPacketType.RTPFB, RtpFeedbackMessageType.TCC, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version, packet type and feedback message type.
			this.writeFixedHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to items.
		pos += FIXED_HEADER_LENGTH;

		while (pos < this.view.byteLength - this.padding)
		{
			const pid = this.view.getUint16(pos);

			pos += 2;

			const bitmask = this.view.getUint16(pos);

			pos += 2;

			this.#items.push({ pid, bitmask });
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
	 * Dump RTCP TCC packet info.
	 */
	dump(): TccPacketDump
	{
		return {
			...super.dump(),
			baseSequenceNumber  : this.getBaseSequenceNumber(),
			packetStatusCount   : this.getPacketStatusCount(),
			referenceTime       : this.getReferenceTime(),
			feedbackPacketCount : this.getFeedbackPacketCount()
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
			(this.#items.length * 4) +
			this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void
	{
		const view = this.serializeBase(buffer, byteOffset);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to items.
		pos += FIXED_HEADER_LENGTH;

		// Write items.
		for (const { pid, bitmask } of this.#items)
		{
			view.setUint16(pos, pid);

			pos += 2;

			view.setUint16(pos, bitmask);

			pos += 2;
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength)
		{
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
	): TccPacket
	{
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new TccPacket(view);
	}

	/**
	 * Get base sequence number.
	 */
	getBaseSequenceNumber(): number
	{
		return this.view.getUint16(12);
	}

	/**
	 * Get packet status count.
	 */
	getPacketStatusCount(): number
	{
		return this.view.getUint16(14);
	}
}
