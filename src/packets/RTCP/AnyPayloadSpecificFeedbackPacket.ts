import { AnyFeedbackPacket } from './AnyFeedbackPacket.js';

/**
 * RTCP Payload-Specific Feedback message type (FMT field).
 */
export enum PayloadSpecificFeedbackMessageType {
	/**
	 * Picture Loss Indication.
	 */
	PLI = 1,
	/**
	 * Full Intra Request.
	 */
	FIR = 4,
	/**
	 * Application Layer Feedback.
	 */
	AFB = 15,
}

/**
 * Parent class of RTCP Payload-Specific Feedback packets (PSFB, 206).
 *
 * @see
 * - [RFC 4585 section 6.3](https://datatracker.ietf.org/doc/html/rfc4585#section-6.3)
 */
export abstract class AnyPayloadSpecificFeedbackPacket extends AnyFeedbackPacket {
	protected constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * @inheritDoc
	 */
	abstract override clone(buffer: Uint8Array): AnyPayloadSpecificFeedbackPacket;

	/**
	 * Get the feedback message type (value of the FMT field).
	 *
	 * @remarks
	 * - In a packet with unknown message type, the returned value is not a
	 *   member of {@link PayloadSpecificFeedbackMessageType}.
	 */
	getMessageType(): PayloadSpecificFeedbackMessageType {
		return this.getCount();
	}
}
