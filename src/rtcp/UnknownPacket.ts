import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	getRtcpPacketType,
	getRtcpLength,
	COMMON_HEADER_LENGTH
} from './RtcpPacket';

/**
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    SC   |   PT=???      |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * body   |                              ...                              |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        :                              ...                              :
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 */

/**
 * RTCP unknown packet info dump.
 */
export type UnknownPacketDump = RtcpPacketDump &
{
	bodyLength: number;
};

/**
 * RTCP unknown packet.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class UnknownPacket extends RtcpPacket
{
	// Buffer view holding the packet body.
	#bodyView: DataView;

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP unknown
	 *   packet will be created.
	 * @param packetType - If `view` is not given, this parameter must be given.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP unknown packet.
	 */
	constructor(view?: DataView, packetType?: RtcpPacketType | number)
	{
		super(view ? getRtcpPacketType(view) : packetType!, view);

		if (!view && !packetType)
		{
			throw new TypeError('view or packetType must be given');
		}

		if (!this.view)
		{
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

		if (bodyLength < 0)
		{
			throw new RangeError(
				`announced padding (${this.padding} bytes) is bigger than available space for body (${this.view.byteLength - pos} bytes)`
			);
		}

		this.#bodyView = new DataView(
			this.view.buffer,
			this.view.byteOffset + pos,
			bodyLength
		);

		pos += (bodyLength + this.padding);

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP unknown packet info.
	 */
	dump(): UnknownPacketDump
	{
		return {
			...super.dump(),
			bodyLength : this.#bodyView.byteLength
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		if (!this.needsSerialization())
		{
			return this.view.byteLength;
		}

		const packetLength =
			COMMON_HEADER_LENGTH +
			this.#bodyView.byteLength +
			this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const packetView = super.serializeBase();
		const packetUint8Array = new Uint8Array(
			packetView.buffer,
			packetView.byteOffset,
			packetView.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += COMMON_HEADER_LENGTH;

		// Copy the body into the new buffer.
		packetUint8Array.set(
			new Uint8Array(
				this.#bodyView.buffer,
				this.#bodyView.byteOffset,
				this.#bodyView.byteLength
			),
			pos
		);

		pos += this.#bodyView.byteLength;

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== packetView.byteLength)
		{
			throw new RangeError(
				`computed packet length (${pos} bytes) is different than the available buffer size (${packetView.byteLength} bytes)`
			);
		}

		// Assert that RTCP header length field is correct.
		if (getRtcpLength(packetView) !== packetView.byteLength)
		{
			throw new RangeError(
				`length in the RTCP header (${getRtcpLength(packetView)} bytes) does not match the available buffer size (${packetView.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = packetView;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): UnknownPacket
	{
		const packetView = this.cloneInternal(buffer, byteOffset);

		return new UnknownPacket(packetView);
	}

	/**
	 * Set the RTCP header count value.
	 */
	setCount(count: number): void
	{
		super.setCount(count);
	}

	/**
	 * Get the packet body.
	 */
	getBody(): DataView
	{
		return this.#bodyView;
	}

	/**
	 * Set the packet body.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setBody(view: DataView): void
	{
		this.#bodyView = view;

		// We must set the flag first because padTo4Bytes() will call getByteLength()
		// which needs that flag set in order to compute new length.
		this.setSerializationNeeded(true);

		// Ensure body is padded to 4 bytes.
		this.padTo4Bytes();
	}
}
