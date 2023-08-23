import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	packetTypeToString,
	COMMON_HEADER_LENGTH
} from './RtcpPacket';
import { assertUnreachable } from '../../utils/helpers';
import { readBitsInDataView, writeBitsInDataView } from '../../utils/bitOps';

// Common RTCP header length + 4 (SSRC of packet sender) + 4 (SSRC of media
// source).
export const FIXED_HEADER_LENGTH = COMMON_HEADER_LENGTH + 8;

/**
 * RTCP Feedback transport layer message types.
 *
 * @category RTCP
 */
// ESLint absurdly complains about "'RtpFeedbackMessageType' is already declared
// in the upper scope".
// eslint-disable-next-line no-shadow
export enum RtpFeedbackMessageType
{
	/**
	 * Generic NACK.
	 */
	NACK = 1,
	/**
	 * Rapid Resynchronisation Request.
	 */
	SR_REQ = 5,
	/**
	 * Explicit Congestion Notification (ECN).
	 */
	ECN = 8
}

/**
 * RTCP Feedback payload specific message types.
 *
 * @category RTCP
 */
// ESLint absurdly complains about "'PsFeedbackMessageType' is already declared
// in the upper scope".
// eslint-disable-next-line no-shadow
export enum PsFeedbackMessageType
{
	/**
	 * Picture Loss Indication.
	 */
	PLI = 1,
	/**
	 * Slice Loss Indication.
	 */
	SLI = 2,
	/**
	 * Reference Picture Selection Indication.
	 */
	RPSI = 3,
	/**
	 * Application layer FB message.
	 */
	AFB = 15
}

/**
 * RTCP Feedback packet info dump.
 *
 * @category RTCP
 */
export type FeedbackPacketDump = RtcpPacketDump &
{
	messageType: RtpFeedbackMessageType | PsFeedbackMessageType;
	senderSsrc: number;
	mediaSsrc: number;
};

/**
 * Get the RTCP Feedback message type.
 *
 * @hidden
 */
export function getRtcpFeedbackMessageType(
	view: DataView
): RtpFeedbackMessageType | PsFeedbackMessageType
{
	return readBitsInDataView({ view, pos: 0, mask: 0b00011111 });
}

function messageTypeToString(
	messageType: RtpFeedbackMessageType | PsFeedbackMessageType
): string
{
	switch (messageType)
	{
		case RtpFeedbackMessageType.NACK:
		{
			return 'Generic NACK';
		}

		case RtpFeedbackMessageType.SR_REQ:
		{
			return 'Rapid Resynchronisation Request';
		}

		case RtpFeedbackMessageType.ECN:
		{
			return 'Explicit Congestion Notification (ECN)';
		}

		case PsFeedbackMessageType.PLI:
		{
			return 'Picture Loss Indication';
		}

		case PsFeedbackMessageType.SLI:
		{
			return 'Slice Loss Indication';
		}

		case PsFeedbackMessageType.RPSI:
		{
			return 'Reference Picture Selection Indication';
		}

		case PsFeedbackMessageType.AFB:
		{
			return 'Application layer FB message';
		}

		default:
		{
			assertUnreachable(messageType);
		}
	}
}

/**
 * RTCP Feedback packet.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|   FMT   |       PT      |          length               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of packet sender                        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of media source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :            Feedback Control Information (FCI)                 :
 * :                                                               :
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 4585 section 6.1](https://datatracker.ietf.org/doc/html/rfc4585#section-6.1)
 */
export abstract class FeedbackPacket extends RtcpPacket
{
	// RTCP Feedback message type.
	readonly #messageType: RtpFeedbackMessageType | PsFeedbackMessageType;

	protected constructor(
		packetType: RtcpPacketType.RTPFB | RtcpPacketType.PSFB,
		messageType: RtpFeedbackMessageType | PsFeedbackMessageType,
		view?: DataView
	)
	{
		super(packetType, view);

		this.#messageType = messageType;

		if (this.view)
		{
			if (this.getMessageType() !== this.#messageType)
			{
				throw new TypeError(
					`given buffer view is not a RTCP ${packetTypeToString(this.getPacketType())} packet with ${messageTypeToString(this.#messageType)} message type`
				);
			}
		}
	}

	/**
	 * Base RTCP Feedback packet dump.
	 *
	 * @remarks
	 * - Read the info dump type of each RTCP Feedback packet instead.
	 */
	dump(): FeedbackPacketDump
	{
		return {
			...super.dump(),
			messageType : this.getMessageType(),
			senderSsrc  : this.getSenderSsrc(),
			mediaSsrc   : this.getMediaSsrc()
		};
	}

	/**
	 * Get the RTCP Feedback message type.
	 */
	getMessageType(): RtpFeedbackMessageType | PsFeedbackMessageType
	{
		return readBitsInDataView({ view: this.view, pos: 0, mask: 0b00011111 });
	}

	/**
	 * Get sender SSRC.
	 */
	getSenderSsrc(): number
	{
		return this.view.getUint32(4);
	}

	/**
	 * Set sender SSRC.
	 */
	setSenderSsrc(ssrc: number)
	{
		this.view.setUint32(4, ssrc);
	}

	/**
	 * Get media SSRC.
	 */
	getMediaSsrc(): number
	{
		return this.view.getUint32(8);
	}

	/**
	 * Set media SSRC.
	 */
	setMediaSsrc(ssrc: number)
	{
		this.view.setUint32(8, ssrc);
	}

	protected writeFixedHeader(): void
	{
		super.writeCommonHeader();

		this.setMessageType();
	}

	/**
	 * Serialize base RTCP Feedback packet into a new buffer.
	 */
	protected serializeBase(buffer?: ArrayBuffer, byteOffset?: number): DataView
	{
		const view = super.serializeBase(buffer, byteOffset);
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

		return view;
	}

	/**
	 * Set the RTCP Feedback message type.
	 *
	 * @privateRemarks
	 * - This method is not public since users should not manipulate this field
	 *   directly.
	 */
	private setMessageType(): void
	{
		writeBitsInDataView(
			{ view: this.view, pos: 0, mask: 0b00011111, value: this.#messageType }
		);
	}
}
