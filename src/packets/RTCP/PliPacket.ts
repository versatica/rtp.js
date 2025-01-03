import { RtcpPacketType } from './RtcpPacket';
import {
	FeedbackPacket,
	PsFeedbackMessageType,
	FeedbackPacketDump,
	FIXED_HEADER_LENGTH,
} from './FeedbackPacket';

/**
 * RTCP PLI packet info dump.
 *
 * @category RTCP
 */
export type PliPacketDump = FeedbackPacketDump;

/**
 * RTCP PLI packet (RTCP Payload Specific Feedback).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=1  |  PT=PSFB=206  |          length=2             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of packet sender                        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of media source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 4585 section 6.3.1](https://datatracker.ietf.org/doc/html/rfc4585#section-6.3.1)
 */
export class PliPacket extends FeedbackPacket {
	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP PLI
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP PLI packet.
	 */
	constructor(view?: DataView) {
		super(RtcpPacketType.PSFB, PsFeedbackMessageType.PLI, view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version, packet type and feedback message type.
			this.writeFixedHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to padding.
		pos += FIXED_HEADER_LENGTH;

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength) {
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP PLI packet info.
	 */
	dump(): PliPacketDump {
		return super.dump();
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		if (!this.needsSerialization()) {
			return this.view.byteLength;
		}

		const packetLength = FIXED_HEADER_LENGTH + this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void {
		const view = this.serializeBase(buffer, byteOffset);

		// Nothing else to do.

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number
	): PliPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new PliPacket(view);
	}
}
