import { EnhancedEventEmitter } from './EnhancedEventEmitter';
import { readBit, setBit, clone } from './utils';

export const RTP_VERSION = 2;

/**
 * Events of Packet.
 */
export type PacketEvents =
{
	'serialization-buffer-needed':
	[
		/**
		 * length - Required available byte length bytes of the buffer.
		 */
		number,
		/**
		 * callback - Function to be (optionally) called by passing a buffer and
		 *   the offset in which the packet will be serialized.
		 */
		(buffer: ArrayBuffer, byteOffset: number) => void
	];
};

/**
 * Base class for RTP and RTCP packets.
 *
 * @noInheritDoc
 */
export abstract class Packet extends EnhancedEventEmitter<PacketEvents>
{
	// DataView holding the entire packet.
	// @ts-ignore ('packetView' has not initializer and is not assigned in constructor).
	protected packetView: DataView;
	// Number of bytes of padding.
	protected padding: number = 0;
	// Whether serialization is needed due to recent modifications.
	#serializationNeeded: boolean = false;

	/**
	 * Get a DataView containing the serialized packet.
	 *
	 * @remarks
	 * The internal ArrayBuffer is serialized if needed (to apply packet pending
	 * modifications).
	 *
	 * @throws
	 * If buffer serialization is needed and it fails due to invalid fields.
	 */
	getView(): DataView
	{
		if (this.needsSerialization())
		{
			this.serialize();
		}

		return this.packetView;
	}

	/**
	 * Computes total length of the packet (in bytes) including padding if any.
	 */
	abstract getByteLength(): number;

	/**
	 * Get the padding (in bytes) at the end of the packet.
	 */
	getPadding(): number
	{
		return this.padding;
	}

	/**
	 * Set the padding (in bytes) after the packet.
	 *
	 * @remarks
	 * Serialization maybe needed after calling this method.
	 */
	setPadding(padding: number): void
	{
		if (padding === this.padding)
		{
			return;
		}

		this.padding = padding;

		// Update padding bit.
		this.setPaddingBit(this.padding ? 1 : 0);

		this.setSerializationNeeded(true);
	}

	/**
	 * Whether {@link serialize} should be called due to modifications in the
	 * packet not being yet applied into the buffer.
	 */
	needsSerialization(): boolean
	{
		return this.#serializationNeeded;
	}

	/**
	 * Apply pending changes into the packet and serialize it into a new buffer.
	 *
	 * @remarks
	 * In most cases there is no need to use this method since many setter methods
	 * apply the changes within the current buffer. To be sure, check
	 * {@link needsSerialization} before.
	 *
	 * @throws
	 * If serialization fails due invalid fields were previously added to the
	 * packet.
	 */
	abstract serialize(): void;

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
	 * The buffer is serialized if needed (to apply packet pending modifications).
	 *
	 * @throws
	 * If buffer serialization is needed and it fails due to invalid fields or if
	 * `buffer` is given and it doesn't hold enough space serializing the packet.
	 */
	abstract clone(buffer?: ArrayBuffer, byteOffset?: number): Packet;

	protected setSerializationNeeded(flag: boolean): void
	{
		this.#serializationNeeded = flag;
	}

	protected getSerializationBuffer(length: number):
	{
		buffer: ArrayBuffer;
		byteOffset: number;
	}
	{
		let buffer: ArrayBuffer | undefined;
		let byteOffset: number | undefined;

		this.safeEmit('serialization-buffer-needed', length, (_buffer, _byteOffset) =>
		{
			buffer = _buffer;
			byteOffset = _byteOffset ?? 0;
		});

		// NOTE: TypeScript is not that smart and it doesn't know that byteOffset
		// here is guaranteed to have a value in case buffer has a value.
		if (buffer && buffer.byteLength - byteOffset! < length)
		{
			throw new RangeError(
				`given buffer available space (${buffer.byteLength - byteOffset!} bytes) is less than packet required length (${length} bytes)`
			);
		}
		else if (!buffer)
		{
			buffer = new ArrayBuffer(length);
			byteOffset = 0;
		}

		// NOTE: TypeScript is not that smart and it doesn't know that byteOffset
		// here is guaranteed to have a value.
		return { buffer, byteOffset: byteOffset! };
	}

	protected setVersion(): void
	{
		this.packetView.setUint8(
			0,
			this.packetView.getUint8(0) | (RTP_VERSION << 6)
		);
	}

	protected getPaddingBit(): number
	{
		return readBit(this.packetView.getUint8(0), 5);
	}

	protected setPaddingBit(bit: number): void
	{
		this.packetView.setUint8(
			0,
			setBit(this.packetView.getUint8(0), 5, bit)
		);
	}

	protected cloneInternal(buffer?: ArrayBuffer, byteOffset?: number): DataView
	{
		if (this.needsSerialization())
		{
			this.serialize();
		}

		let destPacketView: DataView;

		// If buffer is given, let's check whether it holds enough space for the
		// packet.
		if (buffer)
		{
			byteOffset = byteOffset ?? 0;

			if (buffer.byteLength - byteOffset < this.packetView.byteLength)
			{
				throw new RangeError(
					`given buffer available space (${buffer.byteLength - byteOffset} bytes) is less than packet required length (${this.packetView.byteLength} bytes)`
				);
			}

			// Copy the packet into the given buffer.
			const destPacketUint8Array = new Uint8Array(
				buffer,
				byteOffset,
				this.packetView.byteLength
			);

			destPacketUint8Array.set(
				new Uint8Array(
					this.packetView.buffer,
					this.packetView.byteOffset,
					this.packetView.byteLength
				),
				0
			);

			destPacketView = new DataView(
				destPacketUint8Array.buffer,
				destPacketUint8Array.byteOffset,
				destPacketUint8Array.byteLength
			);
		}
		else
		{
			destPacketView = clone<DataView>(this.packetView);
		}

		return destPacketView;
	}
}
