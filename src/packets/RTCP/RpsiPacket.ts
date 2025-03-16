import { RtcpPacketType } from './RtcpPacket';
import {
	FeedbackPacket,
	PsFeedbackMessageType,
	FeedbackPacketDump,
	FIXED_HEADER_LENGTH,
} from './FeedbackPacket';
import { padTo4Bytes } from '../../utils/helpers';
import { readBitsInDataView, writeBitsInDataView } from '../../utils/bitOps';

const MAX_BIT_STRING_LENGTH = 6;

/**
 * RTCP RPSI packet info dump.
 *
 * @category RTCP
 */
export type RpsiPacketDump = FeedbackPacketDump & {
	payloadType: number;
	bitStringLength: number;
	paddingBits: number;
};

/**
 * RTCP RPSI packet (RTCP Payload Specific Feedback).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=3  |  PT=PSFB=206  |          length               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of packet sender                        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of media source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |      PB       |0| Payload Type|    Native RPSI bit string     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |   defined per codec          ...                | Padding (0) |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 4585 section 6.3.3](https://datatracker.ietf.org/doc/html/rfc4585#section-6.3.3)
 */
export class RpsiPacket extends FeedbackPacket {
	// Buffer view holding the bit string.
	#bitStringView: DataView;

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP RPSI
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP RPSI packet.
	 */
	constructor(view?: DataView) {
		super(RtcpPacketType.PSFB, PsFeedbackMessageType.RPSI, view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH + 4));

			// Write version, packet type and feedback message type.
			this.writeFixedHeader();

			// Set string with length 2 bytes.
			this.#bitStringView = new DataView(
				this.view.buffer,
				this.view.byteOffset + FIXED_HEADER_LENGTH + 2,
				2
			);

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to padding bits.
		pos += FIXED_HEADER_LENGTH;

		const fciPaddingBits = this.view.getUint8(pos);

		if (fciPaddingBits % 8 !== 0) {
			throw new TypeError(
				'invalid RPSI packet with fractional number of padding bytes'
			);
		}

		const fciPaddingBytes = fciPaddingBits / 8;

		if (fciPaddingBytes > MAX_BIT_STRING_LENGTH) {
			throw new TypeError('too many padding bytes');
		}

		// Move to bit string.
		pos += 2;

		// Get bit string.
		const bitStringLength =
			this.view.byteLength - pos - fciPaddingBytes - this.padding;

		this.#bitStringView = new DataView(
			this.view.buffer,
			this.view.byteOffset + pos,
			bitStringLength
		);

		pos += bitStringLength + fciPaddingBytes + this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength) {
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP RPSI packet info.
	 */
	dump(): RpsiPacketDump {
		return {
			...super.dump(),
			payloadType: this.getPayloadType(),
			bitStringLength: this.getBitString().byteLength,
			paddingBits: this.getFciPaddingBits(),
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
			FIXED_HEADER_LENGTH +
			2 +
			this.#bitStringView.byteLength +
			this.getFciPaddingBits() / 8 +
			this.padding;

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

		// Move to padding bits.
		pos += FIXED_HEADER_LENGTH;

		// Copy the rest of the fixed fields (padding bits and payload type) into
		// the new buffer.
		uint8Array.set(
			new Uint8Array(this.view.buffer, this.view.byteOffset + pos, 2),
			pos
		);

		// Move to padding bit string.
		pos += 2;

		// Copy the bit string into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.#bitStringView.buffer,
				this.#bitStringView.byteOffset,
				this.#bitStringView.byteLength
			),
			pos
		);

		// Create new bit string DataView.
		const bitStringView = new DataView(
			view.buffer,
			view.byteOffset + pos,
			this.#bitStringView.byteLength
		);

		// Move to FCI padding.
		pos += bitStringView.byteLength;

		const fciPaddingBytes = this.getFciPaddingBits() / 8;

		// Fill padding bytes with zeros.
		for (let i = 0; i < fciPaddingBytes; ++i) {
			view.setUint8(pos + i, 0);
		}

		// Move to packet padding.
		pos += fciPaddingBytes;

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
	): RpsiPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new RpsiPacket(view);
	}

	/**
	 * Get payload type.
	 */
	getPayloadType(): number {
		return readBitsInDataView({ view: this.view, pos: 13, mask: 0b01111111 });
	}

	/**
	 * Set the payload type.
	 */
	setPayloadType(payloadType: number): void {
		writeBitsInDataView({
			view: this.view,
			pos: 13,
			mask: 0b01111111,
			value: payloadType,
		});
	}

	/**
	 * Get the bit string.
	 */
	getBitString(): DataView {
		return this.#bitStringView;
	}

	/**
	 * Set the bit string.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setBitString(view: DataView): void {
		this.#bitStringView = view;

		const fciLength = 2 + this.#bitStringView.byteLength;
		const fciLaddedLength = padTo4Bytes(fciLength);
		const paddingBytes = fciLaddedLength - fciLength;

		this.setFciPaddingBits(paddingBytes * 8);

		this.setSerializationNeeded(true);
	}

	private getFciPaddingBits(): number {
		return this.view.getUint8(12);
	}

	private setFciPaddingBits(paddingBits: number): void {
		return this.view.setUint8(12, paddingBits);
	}
}
