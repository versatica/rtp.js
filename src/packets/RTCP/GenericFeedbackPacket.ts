import { RtcpPacketType, getRtcpPacketType } from './RtcpPacket';
import {
	FeedbackPacket,
	RtpFeedbackMessageType,
	PsFeedbackMessageType,
	type FeedbackPacketDump,
	getRtcpFeedbackMessageType,
	FIXED_HEADER_LENGTH,
} from './FeedbackPacket';

/**
 * RTCP generic Feedback packet info.
 *
 * @category RTCP
 */
export type GenericFeedbackPacketDump = FeedbackPacketDump & {
	bodyLength: number;
};

/**
 * RTCP generic Feedback packet.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P| FMT=??? |  PT=205|206   |          length               |
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
export class GenericFeedbackPacket extends FeedbackPacket {
	// Buffer view holding the packet body.
	#bodyView: DataView;

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP generic
	 *   Feedback packet will be created.
	 * @param packetType - If `view` is not given, this parameter must be given.
	 * @param messageType - If `view` is not given, this parameter must be given.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP generic Feedback packet.
	 */
	constructor(
		view?: DataView,
		packetType?: RtcpPacketType.RTPFB | RtcpPacketType.PSFB,
		messageType?: RtpFeedbackMessageType | PsFeedbackMessageType
	) {
		super(
			(view ? getRtcpPacketType(view) : packetType!) as
				| RtcpPacketType.RTPFB
				| RtcpPacketType.PSFB,
			view ? getRtcpFeedbackMessageType(view) : messageType!,
			view
		);

		if (!view && (!packetType || !messageType)) {
			throw new TypeError('view or (packetType and messageType) must be given');
		}

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version, packet type and feedback message type.
			this.writeFixedHeader();

			// Set empty body.
			this.#bodyView = new DataView(
				this.view.buffer,
				this.view.byteOffset + FIXED_HEADER_LENGTH,
				0
			);

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += FIXED_HEADER_LENGTH;

		// Get body.
		const bodyLength = this.view.byteLength - pos - this.padding;

		this.#bodyView = new DataView(
			this.view.buffer,
			this.view.byteOffset + pos,
			bodyLength
		);

		pos += bodyLength + this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength) {
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP generic Feedback packet info.
	 */
	override dump(): GenericFeedbackPacketDump {
		return {
			...super.dump(),
			bodyLength: this.getBody().byteLength,
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		if (!this.needsSerialization()) {
			return this.view.byteLength;
		}

		const packetLength =
			FIXED_HEADER_LENGTH + this.#bodyView.byteLength + this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBufferLike, byteOffset?: number): void {
		const view = this.serializeBase(buffer, byteOffset);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += FIXED_HEADER_LENGTH;

		// Copy the body into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.#bodyView.buffer,
				this.#bodyView.byteOffset,
				this.#bodyView.byteLength
			),
			pos
		);

		// Create new body DataView.
		const bodyView = new DataView(
			view.buffer,
			view.byteOffset + pos,
			this.#bodyView.byteLength
		);

		pos += bodyView.byteLength;

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength) {
			throw new RangeError(
				`filled length (${pos} bytes) is different than the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		// Update body DataView.
		this.#bodyView = bodyView;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(
		buffer?: ArrayBufferLike,
		byteOffset?: number,
		serializationBuffer?: ArrayBufferLike,
		serializationByteOffset?: number
	): GenericFeedbackPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new GenericFeedbackPacket(view);
	}

	/**
	 * Get the packet body.
	 */
	getBody(): DataView {
		return this.#bodyView;
	}

	/**
	 * Set the packet body.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setBody(view: DataView): void {
		this.#bodyView = view;

		// We must set the flag first because padTo4Bytes() will call getByteLength()
		// which needs that flag set in order to compute new length.
		this.setSerializationNeeded(true);

		// Ensure body is padded to 4 bytes.
		this.padTo4Bytes();
	}
}
