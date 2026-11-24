import {
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacketDump,
} from './RtcpPacket';
import { FEEDBACK_HEADER_LENGTH } from './AnyFeedbackPacket';
import {
	AnyPayloadSpecificFeedbackPacket,
	PayloadSpecificFeedbackMessageType,
} from './AnyPayloadSpecificFeedbackPacket';

/**
 * RTCP PLI packet info dump.
 */
export type PliPacketDump = RtcpPacketDump & {
	/**
	 * Feedback message type.
	 */
	messageType: PayloadSpecificFeedbackMessageType;
	/**
	 * SSRC of the packet sender.
	 */
	senderSsrc: number;
	/**
	 * SSRC of the media source.
	 */
	mediaSsrc: number;
};

/**
 * RTCP Picture Loss Indication (PLI) packet (PSFB 206, FMT 1).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=1  |  PT=PSFB=206  |           Length=2            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     SSRC of packet sender                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                      SSRC of media source                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @remarks
 * - PLI has no FCI, so the length of the packet (excluding padding) is
 *   always 12 bytes.
 *
 * @see
 * - [RFC 4585 section 6.3.1](https://datatracker.ietf.org/doc/html/rfc4585#section-6.3.1)
 */
export class PliPacket extends AnyPayloadSpecificFeedbackPacket {
	/**
	 * Parse a RTCP PLI packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP PLI packet.
	 */
	static parse(buffer: Uint8Array): PliPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new PliPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.PSFB);
		packet.#validate();

		return packet;
	}

	/**
	 * Create a RTCP PLI packet with both SSRCs set to 0.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than 12 bytes.
	 */
	static factory(buffer: Uint8Array): PliPacket {
		const packet = new PliPacket(buffer);

		packet.initializeHeader(
			RtcpPacketType.PSFB,
			PayloadSpecificFeedbackMessageType.PLI,
			FEEDBACK_HEADER_LENGTH
		);

		// Set SSRC of packet sender and SSRC of media source to 0.
		buffer.fill(0, COMMON_HEADER_LENGTH, FEEDBACK_HEADER_LENGTH);

		return packet;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP PLI packet info.
	 */
	override dump(): PliPacketDump {
		return {
			...super.dump(),
			messageType: this.getMessageType(),
			senderSsrc: this.getSenderSsrc(),
			mediaSsrc: this.getMediaSsrc(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): PliPacket {
		const clonedPacket = new PliPacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	#validate(): void {
		if (this.getMessageType() !== PayloadSpecificFeedbackMessageType.PLI) {
			throw new TypeError('not a RTCP PLI packet');
		}

		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();

		// PLI has no FCI.
		if (contentLength !== FEEDBACK_HEADER_LENGTH) {
			throw new TypeError(
				`packet length (${contentLength} bytes, excluding padding) must be ${FEEDBACK_HEADER_LENGTH} bytes`
			);
		}
	}
}
