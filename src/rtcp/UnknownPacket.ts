import { RTP_VERSION } from '../Packet';
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
 * RTCP Unknown packet info dump.
 */
export type UnknownPacketDump = RtcpPacketDump &
{
	bodyLength: number;
};

/**
 * RTCP Unknown packet.
 */
export class UnknownPacket extends RtcpPacket
{
	// Buffer view holding the packet body.
	#bodyView: DataView;

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP Unknown
	 *   packet (with just the minimal common header) will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP Unknown packet.
	 */
	constructor(view?: DataView, packetType?: RtcpPacketType | number)
	{
		super(view ? getRtcpPacketType(view) : packetType!);

		if (!view && !packetType)
		{
			throw new TypeError('view or packetType must be given');
		}

		if (!view)
		{
			this.packetView = new DataView(new ArrayBuffer(COMMON_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			// Set empty body.
			this.#bodyView = new DataView(
				this.packetView.buffer,
				this.packetView.byteOffset + COMMON_HEADER_LENGTH,
				0
			);

			return;
		}

		if (getRtcpLength(view) !== view.byteLength)
		{
			throw new RangeError(
				`length in the RTCP header (${getRtcpLength(view)} bytes) does not match view length (${view.byteLength} bytes)`
			);
		}

		this.packetView = view;

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += COMMON_HEADER_LENGTH;

		// Get padding.
		if (this.getPaddingBit())
		{
			this.padding = this.packetView.getUint8(this.packetView.byteLength - 1);
		}

		// Get body.
		const bodyLength = this.packetView.byteLength - pos - this.padding;

		if (bodyLength < 0)
		{
			throw new RangeError(
				`announced padding (${this.padding} bytes) is bigger than available space for body (${this.packetView.byteLength - pos} bytes)`
			);
		}

		this.#bodyView = new DataView(
			this.packetView.buffer,
			this.packetView.byteOffset + pos,
			bodyLength
		);

		pos += (bodyLength + this.padding);

		// Ensure that view length and parsed length match.
		if (pos !== this.packetView.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.packetView.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP Unknown packet info.
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
		this.packetView = packetView;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): UnknownPacket
	{
		const destPacketView = this.cloneInternal(buffer, byteOffset);

		return new UnknownPacket(destPacketView);
	}

	/**
	 * Set the RTCP header count value.
	 */
	setCount(count: number): void
	{
		this.packetView.setUint8(
			0,
			(RTP_VERSION << 6) | (Number(this.getPaddingBit()) << 5) | (count & 0x1F)
		);
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

		// Ensure body is padded to 4 bytes.
		this.padTo4Bytes();

		this.setSerializationNeeded(true);
	}
}
