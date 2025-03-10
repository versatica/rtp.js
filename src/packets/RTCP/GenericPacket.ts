import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	getRtcpPacketType,
	COMMON_HEADER_LENGTH,
} from './RtcpPacket.ts';

/**
 * RTCP generic packet info dump.
 *
 * @category RTCP
 */
export type GenericPacketDump = RtcpPacketDump & {
	bodyLength: number;
};

/**
 * RTCP generic packet.
 *
 * ```text
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    SC   |   PT=???      |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * body   |                              ...                              |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        :                              ...                              :
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 3550](https://datatracker.ietf.org/doc/html/rfc3550)
 */
export class GenericPacket extends RtcpPacket {
	// Buffer view holding the packet body.
	#bodyView: DataView;

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP generic
	 *   packet will be created.
	 * @param packetType - If `view` is not given, this parameter must be given.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP generic packet.
	 */
	constructor(view?: DataView, packetType?: RtcpPacketType | number) {
		super(view ? getRtcpPacketType(view) : packetType!, view);

		if (!view && !packetType) {
			throw new TypeError('view or packetType must be given');
		}

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(COMMON_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			// Set empty body.
			this.#bodyView = new DataView(
				this.view.buffer,
				this.view.byteOffset + COMMON_HEADER_LENGTH,
				0
			);

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += COMMON_HEADER_LENGTH;

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
	 * Dump RTCP generic packet info.
	 */
	dump(): GenericPacketDump {
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
			COMMON_HEADER_LENGTH + this.#bodyView.byteLength + this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void {
		const view = this.serializeBase(buffer, byteOffset);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += COMMON_HEADER_LENGTH;

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
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number
	): GenericPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new GenericPacket(view);
	}

	/**
	 * Set the RTCP header count value.
	 *
	 * @remarks
	 * - This field (the 5 less significant bits in the first byte of the common
	 *   RTCP header) can be used for other custom purpose in case the packet
	 *   needs it for something else.
	 *
	 * @privateRemarks
	 * - This method is made public for this class since the user is free to add
	 *   whatever body to this packet, and hence the user may want to also
	 *   manipulate this field.
	 */
	setCount(count: number): void {
		super.setCount(count);
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
