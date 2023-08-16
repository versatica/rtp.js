import { RtcpPacketType } from './RtcpPacket';
import {
	FeedbackPacket,
	RtpFeedbackMessageType,
	FeedbackPacketDump,
	FIXED_HEADER_LENGTH
} from './FeedbackPacket';

/**
 * RTCP NACK packet info dump.
 */
export type NackPacketDump = FeedbackPacketDump &
{
	items: { pid: number; bitmask: number }[];
};

/**
 * RTCP NACK packet (RTCP Transport Layer Feedback).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=1  |  PT=RTPFB=205 |          length               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of packet sender                        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                  SSRC of media source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |            PID                |             BLP               |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * ```
 *
 * @see
 * - [RFC 4585 section 6.2.1](https://datatracker.ietf.org/doc/html/rfc4585#section-6.2.1)
 */
export class NackPacket extends FeedbackPacket
{
	#items: { pid: number; bitmask: number }[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP NACK
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP NACK packet.
	 */
	constructor(view?: DataView)
	{
		super(RtcpPacketType.RTPFB, RtpFeedbackMessageType.NACK, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version, packet type and feedback message type.
			this.writeFixedHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to items.
		pos += FIXED_HEADER_LENGTH;

		while (pos < this.view.byteLength - this.padding)
		{
			const pid = this.view.getUint16(pos);

			pos += 2;

			const bitmask = this.view.getUint16(pos);

			pos += 2;

			this.#items.push({ pid, bitmask });
		}

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP NACK packet info.
	 */
	dump(): NackPacketDump
	{
		return {
			...super.dump(),
			items : this.getItems()
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
			FIXED_HEADER_LENGTH +
			(this.#items.length * 4) +
			this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void
	{
		const view = this.serializeBase(buffer, byteOffset);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to items.
		pos += FIXED_HEADER_LENGTH;

		// Write items.
		for (const { pid, bitmask } of this.#items)
		{
			view.setUint16(pos, pid);

			pos += 2;

			view.setUint16(pos, bitmask);

			pos += 2;
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength)
		{
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
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number
	): NackPacket
	{
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new NackPacket(view);
	}

	/**
	 * Get NACK items values.
	 */
	getItems(): { pid: number; bitmask: number }[]
	{
		return Array.from(this.#items);
	}

	/**
	 * Set NACK item values.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setItems(items: { pid: number; bitmask: number }[]): void
	{
		this.#items = Array.from(items);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add NACK item value.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	addItem(pid: number, bitmask: number): void
	{
		this.#items.push({ pid, bitmask });

		this.setSerializationNeeded(true);
	}
}
