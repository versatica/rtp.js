import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	COMMON_HEADER_LENGTH,
} from './RtcpPacket';

/**
 * RTCP Extended Jitter Reports packet info dump.
 *
 * @category RTCP
 */
export type ExtendedJitterReportsPacketDump = RtcpPacketDump & {
	jitters: number[];
};

/**
 * RTCP Extended Jitter Reports packet.
 *
 * ```text
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    RC   |     PT=195    |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                     inter-arrival jitter                      |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        :                              ...                              :
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 5450 section 4](https://datatracker.ietf.org/doc/html/rfc5450#section-4)
 */
export class ExtendedJitterReportsPacket extends RtcpPacket {
	// Inter-arrival jitter values.
	#jitters: number[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP Extended
	 *   Jitter Reports packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP Extended Jitter Reports
	 *   packet.
	 */
	constructor(view?: DataView) {
		super(RtcpPacketType.IJ, view);

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(COMMON_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to jitter field(s).
		pos += COMMON_HEADER_LENGTH;

		let count = this.getCount();

		while (count-- > 0) {
			const jitter = this.view.getUint32(pos);

			this.#jitters.push(jitter);

			pos += 4;
		}

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength) {
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`,
			);
		}
	}

	/**
	 * Dump RTCP Extended Jitter Reports packet info.
	 */
	dump(): ExtendedJitterReportsPacketDump {
		return {
			...super.dump(),
			jitters: this.getJitters(),
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
			COMMON_HEADER_LENGTH + this.#jitters.length * 4 + this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void {
		const view = this.serializeBase(buffer, byteOffset);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to SSRCs/CSRCs.
		pos += COMMON_HEADER_LENGTH;

		// Write jitters.
		for (const jitter of this.#jitters) {
			view.setUint32(pos, jitter);

			pos += 4;
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength) {
			throw new RangeError(
				`filled length (${pos} bytes) is different than the available buffer size (${view.byteLength} bytes)`,
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
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number,
	): ExtendedJitterReportsPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset,
		);

		return new ExtendedJitterReportsPacket(view);
	}

	/**
	 * Get inter-arrival jitter values.
	 */
	getJitters(): number[] {
		return Array.from(this.#jitters);
	}

	/**
	 * Set inter-arrival jitter values.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setJitters(jitters: number[]): void {
		this.#jitters = Array.from(jitters);

		// Update RTCP count.
		this.setCount(this.#jitters.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add inter-arrival jitter value.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	addJitter(jitter: number): void {
		this.#jitters.push(jitter);

		// Update RTCP count.
		this.setCount(this.#jitters.length);

		this.setSerializationNeeded(true);
	}
}
