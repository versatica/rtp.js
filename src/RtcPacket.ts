import { EnhancedEventEmitter } from './EnhancedEventEmitter';

/**
 * Events of RtcPacket.
 */
export type RtcPacketEvents =
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
export abstract class RtcPacket extends EnhancedEventEmitter<RtcPacketEvents>
{
	// DataView holding the entire packet.
	// @ts-ignore ('packetView' has not initializer and is not assigned in constructor).
	protected packetView: DataView;
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
	 *
	 * @remarks
	 * This method computes the total length of the packet even if serialization
	 * is needed (but it doesn't serialize it).
	 */
	abstract getByteLength(): number;

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
	abstract clone(buffer?: ArrayBuffer, byteOffset?: number): RtcPacket;

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
}
