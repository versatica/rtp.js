import { RtcpPacketType, isRtcp, type RtcpPacketDump } from './RtcpPacket.js';
import { FEEDBACK_HEADER_LENGTH } from './AnyFeedbackPacket.js';
import {
	AnyTransportLayerFeedbackPacket,
	type TransportLayerFeedbackMessageType,
} from './AnyTransportLayerFeedbackPacket.js';

/**
 * RTCP Unknown Transport Layer Feedback packet info dump.
 */
export type UnknownTransportLayerFeedbackPacketDump = RtcpPacketDump & {
	/**
	 * Feedback message type.
	 */
	messageType: TransportLayerFeedbackMessageType;
	/**
	 * SSRC of the packet sender.
	 */
	senderSsrc: number;
	/**
	 * SSRC of the media source.
	 */
	mediaSsrc: number;
	/**
	 * Length (in bytes) of the value that follows the SSRC of the media
	 * source.
	 */
	unknownValueLength: number;
};

/**
 * RTCP Transport Layer Feedback packet (RTPFB 205) with an unknown or not
 * implemented message type.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|   FMT   |  PT=RTPFB=205 |             Length            |
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
 * @see
 * - [RFC 4585 section 6.2](https://datatracker.ietf.org/doc/html/rfc4585#section-6.2)
 */
export class UnknownTransportLayerFeedbackPacket extends AnyTransportLayerFeedbackPacket {
	/**
	 * Parse a RTCP Transport Layer Feedback packet with any message type.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP Transport Layer
	 *   Feedback packet.
	 */
	static parse(buffer: Uint8Array): UnknownTransportLayerFeedbackPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new UnknownTransportLayerFeedbackPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.RTPFB);
		packet.#validate();

		return packet;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP Unknown Transport Layer Feedback packet info.
	 */
	override dump(): UnknownTransportLayerFeedbackPacketDump {
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
	clone(buffer: Uint8Array): UnknownTransportLayerFeedbackPacket {
		const clonedPacket = new UnknownTransportLayerFeedbackPacket(buffer);

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
