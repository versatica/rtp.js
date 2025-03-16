import { RtcpPacketType } from './RtcpPacket';
import {
	FeedbackPacket,
	RtpFeedbackMessageType,
	FeedbackPacketDump,
	FIXED_HEADER_LENGTH,
} from './FeedbackPacket';

const ECN_PACKET_LENGTH = FIXED_HEADER_LENGTH + 20;

/**
 * RTCP ECN packet info dump.
 *
 * @category RTCP
 */
export type EcnPacketDump = FeedbackPacketDump & {
	extendedHighestSequenceNumber: number;
	ect0Counter: number;
	ect1Counter: number;
	ecnCeCounter: number;
	nonEctCounter: number;
	lostPacketsCounter: number;
	duplicationCounter: number;
};

/**
 * RTCP ECN packet (RTCP Transport Layer Feedback).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=8  |  PT=RTPFB=205 |          length=7             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of packet sender                        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of media source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | Extended Highest Sequence Number                              |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | ECT (0) Counter                                               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | ECT (1) Counter                                               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | ECN-CE Counter                | not-ECT Counter               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | Lost Packets Counter          | Duplication Counter           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 6679 section 5.1](https://datatracker.ietf.org/doc/html/rfc6679#section-5.1)
 */
export class EcnPacket extends FeedbackPacket {
	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP ECN
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP ECN packet.
	 */
	constructor(view?: DataView) {
		super(RtcpPacketType.RTPFB, RtpFeedbackMessageType.ECN, view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(ECN_PACKET_LENGTH));

			// Write version, packet type and feedback message type.
			this.writeFixedHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to the end.
		pos += ECN_PACKET_LENGTH;

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength) {
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP ECN packet info.
	 */
	dump(): EcnPacketDump {
		return {
			...super.dump(),
			extendedHighestSequenceNumber: this.getExtendedHighestSequenceNumber(),
			ect0Counter: this.getEct0Counter(),
			ect1Counter: this.getEct1Counter(),
			ecnCeCounter: this.getEcnCeCounter(),
			nonEctCounter: this.getNonEctCounter(),
			lostPacketsCounter: this.getLostPacketsCounter(),
			duplicationCounter: this.getDuplicationCounter(),
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		return ECN_PACKET_LENGTH + this.padding;
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

		// Move to FCI.
		pos += FIXED_HEADER_LENGTH;

		// Copy the entire FCI into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset + pos,
				ECN_PACKET_LENGTH - FIXED_HEADER_LENGTH
			),
			pos
		);

		pos += ECN_PACKET_LENGTH - FIXED_HEADER_LENGTH;

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
	): EcnPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new EcnPacket(view);
	}

	/**
	 * Get Extended Highest Sequence Number.
	 */
	getExtendedHighestSequenceNumber(): number {
		return this.view.getUint32(12);
	}

	/**
	 * Set Extended Highest Sequence Number.
	 */
	setExtendedHighestSequenceNumber(sequenceNumber: number): void {
		this.view.setUint32(12, sequenceNumber);
	}

	/**
	 * Get ECT (0) Counter.
	 */
	getEct0Counter(): number {
		return this.view.getUint32(16);
	}

	/**
	 * Set ECT (0) Counter.
	 */
	setEct0Counter(counter: number): void {
		this.view.setUint32(16, counter);
	}

	/**
	 * Get ECT (1) Counter.
	 */
	getEct1Counter(): number {
		return this.view.getUint32(20);
	}

	/**
	 * Set ECT (1) Counter.
	 */
	setEct1Counter(counter: number): void {
		this.view.setUint32(20, counter);
	}

	/**
	 * Get ECN-CE Counter.
	 */
	getEcnCeCounter(): number {
		return this.view.getUint16(24);
	}

	/**
	 * Set ECN-CE Counter.
	 */
	setEcnCeCounter(counter: number): void {
		this.view.setUint16(24, counter);
	}

	/**
	 * Get not-ECT Counter.
	 */
	getNonEctCounter(): number {
		return this.view.getUint16(26);
	}

	/**
	 * Set not-ECT Counter.
	 */
	setNonEctCounter(counter: number): void {
		this.view.setUint16(26, counter);
	}

	/**
	 * Get Lost Packets Counter.
	 */
	getLostPacketsCounter(): number {
		return this.view.getUint16(28);
	}

	/**
	 * Set Lost Packets Counter.
	 */
	setLostPacketsCounter(counter: number): void {
		this.view.setUint16(28, counter);
	}

	/**
	 * Get Duplication Counter.
	 */
	getDuplicationCounter(): number {
		return this.view.getUint16(30);
	}

	/**
	 * Set Duplication Counter.
	 */
	setDuplicationCounter(counter: number): void {
		this.view.setUint16(30, counter);
	}
}
