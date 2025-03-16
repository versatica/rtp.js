import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	COMMON_HEADER_LENGTH,
} from './RtcpPacket';
import {
	dataViewToString,
	stringToUint8Array,
	getStringByteLength,
} from '../../utils/helpers';

/**
 * RTCP BYE packet info dump.
 *
 * @category RTCP
 */
export type ByePacketDump = RtcpPacketDump & {
	ssrcs: number[];
	reason?: string;
};

/**
 * RTCP BYE packet.
 *
 * ```text
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    SC   |   PT=BYE=203  |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                           SSRC/CSRC                           |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        :                              ...                              :
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * (opt)  |     length    |               reason for leaving            ...
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 3550 section 6.6](https://datatracker.ietf.org/doc/html/rfc3550#section-6.6)
 */
export class ByePacket extends RtcpPacket {
	// SSRC/CSRC array.
	#ssrcs: number[] = [];
	// Termination season.
	#reason?: string;

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP BYE
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP BYE packet.
	 */
	constructor(view?: DataView) {
		super(RtcpPacketType.BYE, view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(COMMON_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to SSRC/CSRC field(s).
		pos += COMMON_HEADER_LENGTH;

		let count = this.getCount();

		while (count-- > 0) {
			const ssrc = this.view.getUint32(pos);

			this.#ssrcs.push(ssrc);

			pos += 4;
		}

		// Check if there is reason.
		if (pos + this.padding < this.view.byteLength) {
			const reasonLength = this.view.getUint8(pos);
			const reasonPadding = -(reasonLength + 1) & 3;

			// Move to the reason field.
			pos += 1;

			const reasonView = new DataView(
				this.view.buffer,
				this.view.byteOffset + pos,
				reasonLength
			);

			this.#reason = dataViewToString(reasonView);

			pos += reasonLength + reasonPadding;
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
	 * Dump RTCP BYE packet info.
	 */
	dump(): ByePacketDump {
		return {
			...super.dump(),
			ssrcs: this.getSsrcs(),
			reason: this.getReason(),
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		if (!this.needsSerialization()) {
			return this.view.byteLength;
		}

		let packetLength = COMMON_HEADER_LENGTH + this.#ssrcs.length * 4;

		if (this.#reason) {
			const reasonLength = getStringByteLength(this.#reason);
			const reasonPadding = -(reasonLength + 1) & 3;

			packetLength += 1 + reasonLength + reasonPadding;
		}

		packetLength += this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBufferLike, byteOffset?: number): void {
		const view = this.serializeBase(buffer, byteOffset);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to SSRCs/CSRCs.
		pos += COMMON_HEADER_LENGTH;

		// Write SSRCs/CSRCs.
		for (const ssrc of this.#ssrcs) {
			view.setUint32(pos, ssrc);

			pos += 4;
		}

		if (this.#reason) {
			const reasonUint8Array = stringToUint8Array(this.#reason);
			const reasonLength = reasonUint8Array.byteLength;
			const reasonPadding = -(reasonLength + 1) & 3;
			const uint8Array = new Uint8Array(
				view.buffer,
				view.byteOffset,
				view.byteLength
			);

			// Write reason length.
			view.setUint8(pos, reasonLength);

			// Move to reason field.
			pos += 1;

			// Copy reason.
			uint8Array.set(reasonUint8Array, pos);

			// Move to padding.
			pos += reasonLength + reasonPadding;
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
	): ByePacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new ByePacket(view);
	}

	/**
	 * Get SSRC values.
	 */
	getSsrcs(): number[] {
		return Array.from(this.#ssrcs);
	}

	/**
	 * Set SSRC values.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setSsrcs(ssrcs: number[]): void {
		this.#ssrcs = Array.from(ssrcs);

		// Update RTCP count.
		this.setCount(this.#ssrcs.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add SSRC value.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	addSsrc(ssrc: number): void {
		this.#ssrcs.push(ssrc);

		// Update RTCP count.
		this.setCount(this.#ssrcs.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get reason.
	 */
	getReason(): string | undefined {
		return this.#reason;
	}

	/**
	 * Set reason.
	 */
	setReason(reason?: string): void {
		this.#reason = reason;

		this.setSerializationNeeded(true);
	}
}
