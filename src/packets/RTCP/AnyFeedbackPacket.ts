import { RtcpPacket } from './RtcpPacket';
import { isUnsignedInteger } from '../../utils/numbers';

/**
 * Length (in bytes) of the common header of every feedback packet, RTCP
 * Common Header included.
 *
 * @internal
 */
export const FEEDBACK_HEADER_LENGTH = 12;

/**
 * Parent class of RTCP Transport Layer Feedback (RTPFB) and Payload-Specific
 * Feedback (PSFB) packets.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|   FMT   |       PT      |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     SSRC of packet sender                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                      SSRC of media source                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :            Feedback Control Information (FCI)                 :
 * :                                                               :
 * ```
 *
 * - Feedback message type (FMT) (5 bits): The type of the feedback message,
 *   interpreted relative to the packet type (PT).
 * - Packet type (PT) (8 bits): 205 (RTPFB) or 206 (PSFB).
 * - SSRC of packet sender (32 bits).
 * - SSRC of media source (32 bits): The source of the media this feedback
 *   refers to.
 * - Feedback Control Information (FCI) (variable length): Its format depends
 *   on the packet type and the feedback message type.
 *
 * @see
 * - [RFC 4585 section 6.1](https://datatracker.ietf.org/doc/html/rfc4585#section-6.1)
 */
export abstract class AnyFeedbackPacket extends RtcpPacket {
	protected constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * @inheritDoc
	 */
	abstract override clone(buffer: Uint8Array): AnyFeedbackPacket;

	/**
	 * Get the SSRC of the packet sender.
	 */
	getSenderSsrc(): number {
		return this.getView().getUint32(4);
	}

	/**
	 * Set the SSRC of the packet sender.
	 *
	 * @throws
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295.
	 */
	setSenderSsrc(ssrc: number): void {
		if (!isUnsignedInteger(ssrc, 0xffffffff)) {
			throw new TypeError(
				`ssrc (${ssrc}) must be an integer between 0 and 4294967295`
			);
		}

		this.getView().setUint32(4, ssrc);
	}

	/**
	 * Get the SSRC of the media source.
	 */
	getMediaSsrc(): number {
		return this.getView().getUint32(8);
	}

	/**
	 * Set the SSRC of the media source.
	 *
	 * @throws
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295.
	 */
	setMediaSsrc(ssrc: number): void {
		if (!isUnsignedInteger(ssrc, 0xffffffff)) {
			throw new TypeError(
				`ssrc (${ssrc}) must be an integer between 0 and 4294967295`
			);
		}

		this.getView().setUint32(8, ssrc);
	}
}
