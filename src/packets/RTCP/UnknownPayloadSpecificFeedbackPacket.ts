import { RtcpPacketType, isRtcp, type RtcpPacketDump } from './RtcpPacket';
import { FEEDBACK_HEADER_LENGTH } from './AnyFeedbackPacket';
import {
	AnyPayloadSpecificFeedbackPacket,
	type PayloadSpecificFeedbackMessageType,
} from './AnyPayloadSpecificFeedbackPacket';

/**
 * RTCP Unknown Payload-Specific Feedback packet info dump.
 */
export type UnknownPayloadSpecificFeedbackPacketDump = RtcpPacketDump & {
	messageType: PayloadSpecificFeedbackMessageType;
	senderSsrc: number;
	mediaSsrc: number;
	unknownValueLength: number;
};

/**
 * RTCP Payload-Specific Feedback packet (PSFB 206) with an unknown or not
 * implemented message type.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|   FMT   |  PT=PSFB=206  |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     SSRC of packet sender                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                      SSRC of media source                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * \                                                               \
 * /                         Unknown Value                         /
 * \                                                               \
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @remarks
 * - An Application Layer Feedback (AFB) message whose application is not
 *   implemented is also represented by this class.
 *
 * @see
 * - [RFC 4585 section 6.3](https://datatracker.ietf.org/doc/html/rfc4585#section-6.3)
 */
export class UnknownPayloadSpecificFeedbackPacket extends AnyPayloadSpecificFeedbackPacket {
	/**
	 * Parse a RTCP Payload-Specific Feedback packet with any message type.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP Payload-Specific
	 *   Feedback packet.
	 */
	static parse(buffer: Uint8Array): UnknownPayloadSpecificFeedbackPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new UnknownPayloadSpecificFeedbackPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.PSFB);
		packet.#validate();

		return packet;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP Unknown Payload-Specific Feedback packet info.
	 */
	override dump(): UnknownPayloadSpecificFeedbackPacketDump {
		return {
			...super.dump(),
			messageType: this.getMessageType(),
			senderSsrc: this.getSenderSsrc(),
			mediaSsrc: this.getMediaSsrc(),
			unknownValueLength: this.getUnknownValue().byteLength,
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): UnknownPayloadSpecificFeedbackPacket {
		const clonedPacket = new UnknownPayloadSpecificFeedbackPacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	/**
	 * Get the value that follows the SSRC of media source (excluding padding).
	 * It is empty if the packet has no value.
	 *
	 * @remarks
	 * - The returned value is a view over the buffer of the packet (no bytes
	 *   are copied).
	 */
	getUnknownValue(): Uint8Array {
		return this.getBuffer().subarray(
			FEEDBACK_HEADER_LENGTH,
			this.getLength() - this.getPadding()
		);
	}

	#validate(): void {
		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();

		if (contentLength < FEEDBACK_HEADER_LENGTH) {
			throw new TypeError(
				`packet length (${contentLength} bytes, excluding padding) is lower than ${FEEDBACK_HEADER_LENGTH} bytes`
			);
		}
	}
}
