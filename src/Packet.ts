import { Serializable } from './Serializable';
import { clone, padTo4Bytes } from './utils';
import { readBit, writeBit, writeBits } from './bitOps';

export const RTP_VERSION = 2;

/**
 * Packet info dump.
 *
 * @remarks
 * - Read the info dump type of each RTP and RTCP packet instead.
 */
export type PacketDump =
{
	byteLength: number;
	padding: number;
};

/**
 * Parent class of all RTP and RTCP packets.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export abstract class Packet extends Serializable
{
	// Number of bytes of padding.
	protected padding: number = 0;

	protected constructor(view?: DataView)
	{
		super(view);
	}

	/**
	 * Base RTCP packet dump.
	 *
	 * @remarks
	 * - Read the info dump type of each RTCP packet instead.
	 */
	dump(): PacketDump
	{
		return {
			padding    : this.getPadding(),
			byteLength : this.getByteLength()
		};
	}

	/**
	 * Get the padding (in bytes) at the end of the packet.
	 */
	getPadding(): number
	{
		return this.padding;
	}

	/**
	 * Pad the packet total length to 4 bytes. To achieve it, this method may add
	 * or remove bytes of padding.
	 *
	 * @remarks
	 * - Serialization maybe needed after calling this method.
	 */
	padTo4Bytes(): void
	{
		const previousPacketLength = this.getByteLength();
		const packetLength = padTo4Bytes(previousPacketLength - this.padding);
		const padding = this.padding + packetLength - previousPacketLength;

		if (padding === this.padding)
		{
			return;
		}

		this.setPadding(padding);

		this.setSerializationNeeded(true);
	}

	/**
	 * Clone the packet. The cloned packet does not share any memory with the
	 * original one.
	 *
	 * @param buffer - Buffer in which the packet will be serialized. If not given,
	 *   a new one will internally allocated.
	 * @param byteOffset - Byte offset of the given `buffer` when serialization must
	 *   be done.
	 *
	 * @remarks
	 * - The buffer is serialized if needed (to apply packet pending modifications).
	 * - Read the info dump type of each RTCP packet instead.
	 *
	 * @throws
	 * - If buffer serialization is needed and it fails due to invalid fields or if
	 * 	 `buffer` is given and it doesn't hold enough space serializing the packet.
	 */
	abstract clone(buffer?: ArrayBuffer, byteOffset?: number): Packet;

	protected setVersion(): void
	{
		writeBits(
			{ view: this.view, byte: 0, mask: 0b11000000, value: RTP_VERSION }
		);
	}

	protected hasPaddingBit(): boolean
	{
		return readBit({ view: this.view, byte: 0, bit: 5 });
	}

	protected setPaddingBit(flag: boolean): void
	{
		writeBit({ view: this.view, byte: 0, bit: 5, flag });
	}

	protected setPadding(padding: number): void
	{
		if (padding === this.padding)
		{
			return;
		}

		this.padding = padding;

		// Update padding bit.
		this.setPaddingBit(Boolean(this.padding));

		this.setSerializationNeeded(true);
	}

	protected cloneInternal(buffer?: ArrayBuffer, byteOffset?: number): DataView
	{
		if (this.needsSerialization())
		{
			this.serialize();
		}

		let packetView: DataView;

		// If buffer is given, let's check whether it holds enough space for the
		// packet.
		if (buffer)
		{
			byteOffset = byteOffset ?? 0;

			if (buffer.byteLength - byteOffset < this.view.byteLength)
			{
				throw new RangeError(
					`given buffer available space (${buffer.byteLength - byteOffset} bytes) is less than packet required length (${this.view.byteLength} bytes)`
				);
			}

			// Copy the packet into the given buffer.
			const packetUint8Array = new Uint8Array(
				buffer,
				byteOffset,
				this.view.byteLength
			);

			packetUint8Array.set(
				new Uint8Array(
					this.view.buffer,
					this.view.byteOffset,
					this.view.byteLength
				),
				0
			);

			packetView = new DataView(
				packetUint8Array.buffer,
				packetUint8Array.byteOffset,
				packetUint8Array.byteLength
			);
		}
		else
		{
			packetView = clone<DataView>(this.view);
		}

		return packetView;
	}
}
