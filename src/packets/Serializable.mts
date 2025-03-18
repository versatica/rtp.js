import { clone } from '../utils/helpers.mts';

/**
 * Serializable info dump.
 */
export type SerializableDump = {
	byteLength: number;
};

/**
 * Class holding a serializable buffer view. All RTP and RTCP packets inherit
 * from this class, and also items in some RTCP packets.
 */
export abstract class Serializable {
	// Buffer view holding the packet or item content.
	// @ts-expect-error --- 'view' has not initializer and is not assigned in
	// constructor.
	protected view: DataView;
	// Whether serialization is needed due to recent modifications.
	#serializationNeeded: boolean = false;

	protected constructor(view?: DataView) {
		if (view) {
			this.view = view;
		}
	}

	/**
	 * Serializable dump.
	 */
	dump(): SerializableDump {
		return {
			byteLength: this.getByteLength(),
		};
	}

	/**
	 * Get a buffer view containing the serialized content of the packet or item.
	 *
	 * @param serializationBuffer - Buffer in which the content will be serialized
	 *   in case serialization is needed. If not given, a new one will internally
	 *   allocated.
	 * @param serializationByteOffset - Byte offset of the given `serializationBuffer`
	 *   where serialization (if needed) will start.
	 *
	 * @remarks
	 * - The internal buffer is serialized if needed (to apply pending
	 * 	 modifications) by internally calling {@link serialize}.
	 *
	 * @throws
	 * - If buffer serialization is needed and it fails due to invalid
	 *   content.
	 */
	getView(
		serializationBuffer?: ArrayBufferLike,
		serializationByteOffset?: number
	): DataView {
		if (this.needsSerialization()) {
			this.serialize(serializationBuffer, serializationByteOffset);
		}

		return this.view;
	}

	/**
	 * Computes total length of the content (in bytes) including padding if any.
	 *
	 * @remarks
	 * - This methods computes the effective byte length of the content as if it
	 *   was serialized at this moment, no matter modifications have been done
	 *   before.
	 */
	abstract getByteLength(): number;

	/**
	 * Whether serialization is needed, meaning that the current buffer view
	 * doesn't represent the current content of the packet or item (due to
	 * modifications not applied yet). Calling {@link serialize} or {@link getView}
	 * will serialize the packet or the item.
	 */
	needsSerialization(): boolean {
		return this.#serializationNeeded;
	}

	/**
	 * Apply pending changes and serialize the content of the packet or item into
	 * a new buffer.
	 *
	 * @param buffer - Buffer in which the content will be serialized. If not
	 *   given, a new one will internally allocated.
	 * @param byteOffset - Byte offset of the given `buffer` where serialization
	 *   will start.
	 *
	 * @remarks
	 * - In most cases there is no need to use this method since many setter
	 *   methods apply changes within the current buffer. To be sure, check
	 *   {@link needsSerialization} before.
	 *
	 * @throws
	 * - If serialization fails due to invalid content previously added.
	 * - If given `buffer` doesn't have space enough to serialize the content.
	 * - If the `buffer` member of the given `ArrayBufferLike` is the same than the
	 *   internal buffer in this packet and the given `byteOffset` would make
	 *   the serialization happen in bytes currently used by the packet (this would
	 *   corrupt the packet).
	 */
	abstract serialize(buffer?: ArrayBufferLike, byteOffset?: number): void;

	/**
	 * Clone the packet or item. The cloned instance does not share any memory
	 * with the original one. The cloned instance is a new class instance
	 * referencing a different buffer.
	 *
	 * @param buffer - Buffer in which the content will be cloned. If not given, a
	 *   new one will internally allocated.
	 * @param byteOffset - Byte offset of the given `buffer` where clonation will
	 *   start.
	 * @param serializationBuffer - Buffer in which the content will be serialized
	 *   in case serialization is needed. If not given, a new one will internally
	 *   allocated.
	 * @param serializationByteOffset - Byte offset of the given
	 *   `serializationBuffer` where serialization (if needed) will start.
	 *
	 * @remarks
	 * - The buffer is serialized if needed (to apply pending modifications) by
	 *   internally calling {@link serialize}.
	 *
	 * @throws
	 * - If serialization is needed and it fails.
	 * - If given `buffer` doesn't have space enough to clone the content.
	 * - If given `serializationBuffer` doesn't have space enough to serialize
	 *   the content.
	 */
	abstract clone(
		buffer?: ArrayBufferLike,
		byteOffset?: number,
		serializationBuffer?: ArrayBufferLike,
		serializationByteOffset?: number
	): Serializable;

	protected setSerializationNeeded(flag: boolean): void {
		this.#serializationNeeded = flag;
	}

	/**
	 * This method returns a buffer (plus byte offset) for the child to serialize.
	 * If a buffer (and optionally a byte offset) is given, this method will verify
	 * whether the serialized content can fit into it and will throw otherwise.
	 */
	protected getSerializationBuffer(
		buffer: ArrayBufferLike | undefined,
		byteOffset: number = 0
	): {
		buffer: ArrayBufferLike;
		byteOffset: number;
		byteLength: number;
	} {
		const byteLength = this.getByteLength();

		if (buffer) {
			if (buffer.byteLength - byteOffset < byteLength) {
				throw new RangeError(
					`given buffer available space (${
						buffer.byteLength - byteOffset
					} bytes) is less than length required for serialization (${byteLength} bytes)`
				);
			}

			// If the given buffer is the same as the one internally used by the view
			// of this packet, we must assert that the new serialization would not
			// happen in bytes where the packet currently exists.
			// Here we must take into account the given byte offset and the byte
			// offset of the view, the current packet length and the expected packet
			// length after the serialization.
			if (
				buffer === this.view.buffer &&
				((byteOffset >= this.view.byteOffset &&
					byteOffset <= this.view.byteOffset + this.view.byteLength - 1) ||
					(byteOffset + byteLength - 1 >= this.view.byteOffset &&
						byteOffset + byteLength <=
							this.view.byteOffset + this.view.byteLength - 1))
			) {
				throw new RangeError(
					'given buffer is the same as the internal buffer of the packet and given byteLength would make serialization override existing packet data'
				);
			}

			const uint8Array = new Uint8Array(buffer, byteOffset, byteLength);

			// If a buffer is given, ensure the required length is filled with zeroes.
			uint8Array.fill(0);
		} else {
			// The buffer is guaranteed to be filled with zeros.
			buffer = new ArrayBuffer(byteLength);
		}

		return { buffer, byteOffset, byteLength };
	}

	protected cloneInternal(
		buffer: ArrayBufferLike | undefined,
		byteOffset: number = 0,
		serializationBuffer?: ArrayBufferLike,
		serializationByteOffset?: number
	): DataView {
		if (this.needsSerialization()) {
			this.serialize(serializationBuffer, serializationByteOffset);
		}

		let view: DataView;

		// If buffer is given, let's check whether it holds enough space for the
		// content.
		if (buffer) {
			if (buffer.byteLength - byteOffset < this.view.byteLength) {
				throw new RangeError(
					`given buffer available space (${
						buffer.byteLength - byteOffset
					} bytes) is less than length required for clonation (${
						this.view.byteLength
					} bytes)`
				);
			}

			// Copy the content into the given buffer.
			const uint8Array = new Uint8Array(
				buffer,
				byteOffset,
				this.view.byteLength
			);

			uint8Array.set(
				new Uint8Array(
					this.view.buffer,
					this.view.byteOffset,
					this.view.byteLength
				),
				0
			);

			view = new DataView(
				uint8Array.buffer,
				uint8Array.byteOffset,
				uint8Array.byteLength
			);
		} else {
			view = clone<DataView>(this.view);
		}

		return view;
	}
}
