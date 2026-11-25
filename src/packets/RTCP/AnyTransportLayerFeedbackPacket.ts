import { AnyFeedbackPacket } from './AnyFeedbackPacket.js';

/**
 * RTCP Transport Layer Feedback message type (FMT field).
 */
export enum TransportLayerFeedbackMessageType {
	/**
	 * Generic NACK.
	 */
	NACK = 1,
	/**
	 * Transport-wide Congestion Control.
	 */
	TCC = 15,
}

/**
 * Parent class of RTCP Transport Layer Feedback packets (RTPFB, 205).
 *
 * @see
 * - [RFC 4585 section 6.2](https://datatracker.ietf.org/doc/html/rfc4585#section-6.2)
 */
export abstract class AnyTransportLayerFeedbackPacket extends AnyFeedbackPacket {
	protected constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * @inheritDoc
	 */
	abstract override clone(buffer: Uint8Array): AnyTransportLayerFeedbackPacket;

	/**
	 * Get the feedback message type (value of the FMT field).
	 *
	 * @remarks
	 * - In a packet with unknown message type, the returned value is not a
	 *   member of {@link TransportLayerFeedbackMessageType}.
	 */
	getMessageType(): TransportLayerFeedbackMessageType {
		return this.getCount();
	}
}
