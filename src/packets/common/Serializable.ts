import { isUnsignedInteger } from '../../utils/numbers';

/**
 * Serializable info dump.
 */
export type SerializableDump = {
	/**
	 * Current exact length (in bytes), including padding bytes (if any).
	 */
	length: number;
	/**
	 * Maximum length (in bytes) the serializable can take.
	 */
	bufferLength: number;
};

/**
 * Class holding serializable content. RTP and RTCP packets and some items
 * within them inherit from this class.
 *
 * The content lives in a `Uint8Array` given by the application, whose
 * `byteLength` is the maximum length the serializable can take. Every change
 * is applied in place within that buffer, so the content is always
 * serialized.
 *
 * @remarks
 * - Typically many packets and items include padding bytes to be multiple of
 *   4 bytes. It's up to each packet or item to deal with padding. From the
 *   point of view of the Serializable class, its length includes its padding
 *   bytes (if any).
 */
export abstract class Serializable {
	// Buffer holding the serializable content. Its byteLength is the maximum
	// length the serializable can take.
	#buffer: Uint8Array;
	// DataView over the same memory as #buffer.
	#view: DataView;
	// Current exact length (includes padding bytes).
	#length: number = 0;
	// Listener set by the parent serializable in which this one is being built
	// in place. It's removed by consolidate() and discard() before being
	// invoked.
	#buildInPlaceListener?: (consolidate: boolean) => void;
	// Whether some item is being built in place within this serializable and
	// consolidate() or discard() wasn't invoked on it yet.
	#needsConsolidation: boolean = false;

	/**
	 * @param buffer - Buffer holding the serializable. Its `byteLength` is the
	 *   maximum length the serializable can take.
	 */
	protected constructor(buffer: Uint8Array) {
		this.#buffer = buffer;
		this.#view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength
		);
	}

	/**
	 * Serializable dump.
	 */
	dump(): SerializableDump {
		return {
			length: this.#length,
			bufferLength: this.#buffer.byteLength,
		};
	}

	/**
	 * Get a view of the exact bytes of the serializable, ready to be sent.
	 *
	 * @remarks
	 * - It doesn't copy any byte. The returned `Uint8Array` shares memory with
	 *   the serializable, so later modifications in the serializable are
	 *   visible through it.
	 */
	getBuffer(): Uint8Array {
		return this.#buffer.subarray(0, this.#length);
	}

	/**
	 * Maximum length (in bytes) the serializable can take. It's guaranteed to
	 * be equal or greater than value returned by {@link getLength}.
	 */
	getBufferLength(): number {
		return this.#buffer.byteLength;
	}

	/**
	 * Current exact length (in bytes) of the serializable, including padding
	 * bytes (if any).
	 */
	getLength(): number {
		return this.#length;
	}

	/**
	 * Current available length (in bytes) of the serializable.
	 */
	getAvailableLength(): number {
		return this.#buffer.byteLength - this.#length;
	}

	/**
	 * Serialize the serializable into a new buffer. This method copies the
	 * bytes of the serializable into the given buffer, which becomes the buffer
	 * of the serializable.
	 *
	 * @param buffer - The new buffer. Its `byteLength` is the new maximum
	 *   length the serializable can take. It may share memory with the current
	 *   buffer.
	 *
	 * @remarks
	 * - It must not be called on an item of another serializable or on an item
	 *   being built in place, since it would move the item out of the buffer of
	 *   its parent.
	 *
	 * @throws
	 * - `Error` if some item is being built in place within this serializable
	 *   (see {@link needsConsolidation}).
	 * - `TypeError` if `buffer.byteLength` is lower than the current length of
	 *   the serializable.
	 */
	serialize(buffer: Uint8Array): void {
		// An item being built in place is beyond the current length, so it would
		// not be serialized.
		this.assertDoesNotNeedConsolidation();

		if (buffer.byteLength < this.#length) {
			throw new TypeError(
				`buffer length (${buffer.byteLength} bytes) is lower than current length (${this.#length} bytes)`
			);
		}

		// NOTE: set() copies properly even if both arrays share memory.
		buffer.set(this.#buffer.subarray(0, this.#length));

		this.setBuffer(buffer);
	}

	/**
	 * Clone the serializable into a new buffer. This method returns a new
	 * instance of the Serializable subclass which doesn't share any memory
	 * with the original one.
	 *
	 * @param buffer - The buffer for the cloned serializable. Its `byteLength`
	 *   is the maximum length the cloned serializable can take.
	 *
	 * @throws
	 * - `Error` if some item is being built in place within this serializable
	 *   (see {@link needsConsolidation}).
	 * - `TypeError` if `buffer.byteLength` is lower than the current length of
	 *   the serializable.
	 * - `TypeError` if `buffer` shares memory with the buffer of the
	 *   serializable.
	 */
	abstract clone(buffer: Uint8Array): Serializable;

	/**
	 * The application must call this method on a serializable that's been
	 * built in place within a parent serializable, once it's completed, so the
	 * parent adds it and updates its length.
	 *
	 * @remarks
	 * - This method or {@link discard} can only be called once.
	 * - Once consolidated, the serializable MUST NOT be modified, since the
	 *   parent does not track later changes (for example, a change in its
	 *   length would leave the parent with a wrong length).
	 *
	 * @throws
	 * - `Error` if this serializable is not being built in place within a
	 *   parent, or if this method or {@link discard} was already called.
	 * - `Error` if some item is being built in place within this serializable
	 *   (see {@link needsConsolidation}), in which case nothing changes and
	 *   this method can be called again.
	 * - If the parent has no space for this serializable.
	 */
	consolidate(): void {
		const listener = this.#takeBuildInPlaceListener();

		listener(/* consolidate */ true);
	}

	/**
	 * The application can call this method, instead of {@link consolidate}, on
	 * a serializable that's been built in place within a parent serializable
	 * in order to remove it from the parent. The parent is left as it was
	 * before the serializable was built in place, except that its padding (if
	 * any) may have been removed.
	 *
	 * @remarks
	 * - The serializable MUST NOT be used after calling this method (unless it
	 *   throws), since its bytes belong to the parent's free space.
	 * - This method or {@link consolidate} can only be called once.
	 *
	 * @throws
	 * - `Error` if this serializable is not being built in place within a
	 *   parent, or if this method or {@link consolidate} was already called.
	 * - `Error` if some item is being built in place within this serializable
	 *   (see {@link needsConsolidation}), in which case nothing changes and
	 *   this method can be called again.
	 */
	discard(): void {
		const listener = this.#takeBuildInPlaceListener();

		listener(/* consolidate */ false);
	}

	/**
	 * Whether some item is being built in place within this serializable and
	 * {@link consolidate} or {@link discard} wasn't invoked on it yet.
	 */
	needsConsolidation(): boolean {
		return this.#needsConsolidation;
	}

	/**
	 * DataView over the whole buffer of the serializable, to read and write
	 * multi-byte fields.
	 */
	protected getView(): DataView {
		return this.#view;
	}

	/**
	 * Change the buffer of the serializable without copying any byte.
	 *
	 * @remarks
	 * - Subclasses holding items within their buffer must override this method,
	 *   call {@link setItemBuffer} for each item and then call the parent
	 *   method.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than the current length of
	 *   the serializable.
	 */
	protected setBuffer(buffer: Uint8Array): void {
		if (
			buffer.buffer === this.#buffer.buffer &&
			buffer.byteOffset === this.#buffer.byteOffset &&
			buffer.byteLength === this.#buffer.byteLength
		) {
			return;
		}

		if (buffer.byteLength < this.#length) {
			throw new TypeError(
				`buffer length (${buffer.byteLength} bytes) is lower than current length (${this.#length} bytes)`
			);
		}

		this.#buffer = buffer;
		this.#view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength
		);
	}

	/**
	 * Make given item, which lives within the buffer of this serializable, live
	 * at the same position within the given new buffer of this serializable.
	 *
	 * @remarks
	 * - It must be called before this serializable changes its buffer, since
	 *   the position of the item is computed relative to the current one.
	 *
	 * @throws
	 * - `Error` if given item doesn't live within the buffer of this
	 *   serializable.
	 */
	protected setItemBuffer(item: Serializable, buffer: Uint8Array): void {
		const offset = item.#buffer.byteOffset - this.#buffer.byteOffset;

		if (
			item.#buffer.buffer !== this.#buffer.buffer ||
			offset < 0 ||
			offset + item.#buffer.byteLength > this.#buffer.byteLength
		) {
			throw new Error('item does not live within the buffer');
		}

		item.setBuffer(buffer.subarray(offset, offset + item.#buffer.byteLength));
	}

	/**
	 * Method to be called by the subclass to update the current exact length
	 * of the serializable.
	 *
	 * @remarks
	 * - The subclass must invoke this method after parsing completes and after
	 *   every change in the serializable content that affects its current
	 *   length.
	 *
	 * @throws
	 * - `TypeError` if given `length` is not an unsigned integer.
	 * - `TypeError` if given `length` is larger than the buffer length of the
	 *   serializable.
	 */
	protected setLength(length: number): void {
		if (!isUnsignedInteger(length)) {
			throw new TypeError(`length (${length}) must be an unsigned integer`);
		} else if (length > this.#buffer.byteLength) {
			throw new TypeError(
				`length (${length} bytes) is larger than buffer length (${this.#buffer.byteLength} bytes)`
			);
		}

		this.#length = length;
	}

	/**
	 * Copy the bytes of this serializable into the given one, which must be a
	 * new instance of the same subclass, and set its length.
	 *
	 * @param serializable - The new instance.
	 * @param copyBytes - If `false`, no byte is copied. Subclasses holding items
	 *   within their buffer pass `false`, copy their own bytes and clone each
	 *   item into the buffer of the given serializable, so each byte is copied
	 *   once.
	 *
	 * @throws
	 * - `Error` if some item is being built in place within this serializable
	 *   (see {@link needsConsolidation}).
	 * - `TypeError` if the buffer length of the given `serializable` is lower
	 *   than the current length of this serializable.
	 * - `TypeError` if the buffer of the given `serializable` shares memory with
	 *   the buffer of this serializable.
	 */
	protected cloneInto(
		serializable: Serializable,
		copyBytes: boolean = true
	): void {
		// An item being built in place is beyond the current length, so it would
		// not be cloned.
		this.assertDoesNotNeedConsolidation();

		if (serializable.#buffer.byteLength < this.#length) {
			throw new TypeError(
				`buffer length (${serializable.#buffer.byteLength} bytes) is lower than current length (${this.#length} bytes)`
			);
		}

		const byteOffset = this.#buffer.byteOffset;
		const clonedByteOffset = serializable.#buffer.byteOffset;

		// The clone would share memory with this serializable, so growing any of
		// them would overwrite the other one.
		if (
			serializable.#buffer.buffer === this.#buffer.buffer &&
			clonedByteOffset < byteOffset + this.#buffer.byteLength &&
			byteOffset < clonedByteOffset + serializable.#buffer.byteLength
		) {
			throw new TypeError(
				'given buffer shares memory with the buffer of the serializable'
			);
		}

		if (copyBytes) {
			serializable.#buffer.set(this.#buffer.subarray(0, this.#length));
		}

		serializable.#length = this.#length;
	}

	/**
	 * Fill the last given `padding` number of bytes of the serializable with
	 * zeros.
	 *
	 * @remarks
	 * - This method does NOT add bytes to the serializable.
	 *
	 * @throws
	 * - `TypeError` if given `padding` is greater than the current length.
	 */
	protected fillPadding(padding: number): void {
		if (padding > this.#length) {
			throw new TypeError(
				`padding (${padding} bytes) cannot be greater than length (${this.#length} bytes)`
			);
		}

		this.#buffer.fill(0, this.#length - padding, this.#length);
	}

	/**
	 * To be called by a parent serializable once it has created, within its
	 * free space, an item that the application is going to build in place.
	 * When the application calls {@link consolidate} on the item, its buffer
	 * length is fixed to its length and `onConsolidate` is invoked so the
	 * parent adds it and updates its own length. When the application calls
	 * {@link discard} on the item, the parent is left as it was, except that
	 * its padding (if any) may have been removed.
	 *
	 * @remarks
	 * - The parent must call {@link assertDoesNotNeedConsolidation} before
	 *   creating the item, since another item being built in place would
	 *   occupy the same free space.
	 * - If `onConsolidate` throws, the item is not added and the error is
	 *   thrown by {@link consolidate}.
	 */
	protected handleInPlaceItem<T extends Serializable>(
		item: T,
		onConsolidate: (item: T) => void
	): void {
		this.assertDoesNotNeedConsolidation();

		this.#needsConsolidation = true;

		item.#buildInPlaceListener = (consolidate: boolean): void => {
			try {
				if (!consolidate) {
					return;
				}

				// Fix buffer length assigned to the item.
				item.setBuffer(item.#buffer.subarray(0, item.#length));

				onConsolidate(item);
			} finally {
				this.#needsConsolidation = false;
			}
		};
	}

	/**
	 * @throws
	 * - `Error` if some item is being built in place within this serializable.
	 *
	 * @see {@link needsConsolidation}
	 */
	protected assertDoesNotNeedConsolidation(): void {
		if (this.#needsConsolidation) {
			throw new Error(
				'Serializable needs consolidation of some item being built in place'
			);
		}
	}

	#takeBuildInPlaceListener(): (consolidate: boolean) => void {
		const listener = this.#buildInPlaceListener;

		if (!listener) {
			throw new Error('build in place listener not set');
		}

		// The listener of an item being built in place within this serializable
		// refers to it.
		this.assertDoesNotNeedConsolidation();

		this.#buildInPlaceListener = undefined;

		return listener;
	}
}
