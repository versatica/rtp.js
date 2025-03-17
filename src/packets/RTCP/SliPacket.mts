import { RtcpPacketType } from './RtcpPacket.mts';
import {
	FeedbackPacket,
	PsFeedbackMessageType,
	FeedbackPacketDump,
	FIXED_HEADER_LENGTH,
} from './FeedbackPacket.mts';

/**
 * RTCP SLI packet info dump.
 *
 * @category RTCP
 */
export type SliPacketDump = FeedbackPacketDump & {
	items: { first: number; number: number; pictureId: number }[];
};

/**
 * RTCP SLI packet (RTCP Payload Specific Feedback).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=2  |  PT=PSFB=206  |          length               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of packet sender                        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of media source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |            First        |        Number           | PictureID |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 4585 section 6.3.2](https://datatracker.ietf.org/doc/html/rfc4585#section-6.3.2)
 */
export class SliPacket extends FeedbackPacket {
	#items: { first: number; number: number; pictureId: number }[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP SLI
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP SLI packet.
	 */
	constructor(view?: DataView) {
		super(RtcpPacketType.PSFB, PsFeedbackMessageType.SLI, view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version, packet type and feedback message type.
			this.writeFixedHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to items.
		pos += FIXED_HEADER_LENGTH;

		while (pos < this.view.byteLength - this.padding) {
			const first = this.view.getUint16(pos) >> 3;

			const number =
				(this.view.getUint32(pos) & 0b00000000000001111111111111000000) >> 6;

			const pictureId = this.view.getUint8(pos + 3) & 0b00111111;

			pos += 4;

			this.#items.push({ first, number, pictureId });
		}

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength) {
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP SLI packet info.
	 */
	dump(): SliPacketDump {
		return {
			...super.dump(),
			items: this.getItems(),
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
			FIXED_HEADER_LENGTH + this.#items.length * 4 + this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBufferLike, byteOffset?: number): void {
		const view = this.serializeBase(buffer, byteOffset);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to items.
		pos += FIXED_HEADER_LENGTH;

		// Write items.
		for (const { first, number, pictureId } of this.#items) {
			view.setUint32(pos, (first << 19) + (number << 6) + pictureId);

			pos += 4;
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength) {
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
		buffer?: ArrayBufferLike,
		byteOffset?: number,
		serializationBuffer?: ArrayBufferLike,
		serializationByteOffset?: number
	): SliPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new SliPacket(view);
	}

	/**
	 * Get SLI items.
	 */
	getItems(): { first: number; number: number; pictureId: number }[] {
		return Array.from(this.#items);
	}

	/**
	 * Set SLI items.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setItems(
		items: { first: number; number: number; pictureId: number }[]
	): void {
		this.#items = Array.from(items);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add SLI item value.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	addItem(first: number, number: number, pictureId: number): void {
		this.#items.push({ first, number, pictureId });

		this.setSerializationNeeded(true);
	}
}
