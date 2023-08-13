import { EnhancedEventEmitter } from './EnhancedEventEmitter';
import { clone } from './utils';

/**
 * Serializable info dump.
 */
export type SerializableDump =
{
	byteLength: number;
};

/**
 * Event emitted when the content is being serialized. The user has a chance to
 * pass a buffer, otherwise a new one will be internally allocated.
 *
 * @param `length: number`: Required buffer length (in bytes).
 * @param `callback: (buffer, byteOffset?) => void`: A function that can be
 *   optionally called to pass a buffer and a byte offset where the content will
 *   be serialized.
 *
 * @remarks
 * - If `callback` is called, the buffer byte length minus the given byte offset
 *   must be equal or higher than `length`.
 *
 * @example
 * ```ts
 * packet.on('will-serialize', (length, callback) => {
 *   const buffer = new ArrayBuffer(length);
 *   const byteOffset = 0;
 *
 *   callback(buffer, byteOffset);
 * });
 * ```
 */
export type WillSerializeEvent =
[
	number,
	(buffer: ArrayBuffer, byteOffset?: number) => void
];

/**
 * Events emitted by all classes inheriting from Serializable class.
 */
type SerializableEvents =
{
	'will-serialize': WillSerializeEvent;
};

/**
 * Class holding a serializable buffer view.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 *
 */
export abstract class Serializable extends EnhancedEventEmitter<SerializableEvents>
{
	// Buffer view holding the content.
	// @ts-ignore ('view' has not initializer and is not assigned in constructor).
	protected view: DataView;
	// Whether serialization is needed due to recent modifications.
	#serializationNeeded: boolean = false;

	protected constructor(view?: DataView)
	{
		super();

		if (view)
		{
			this.view = view;
		}
	}

	/**
	 * Serializable dump.
	 */
	dump(): SerializableDump
	{
		return {
			byteLength : this.getByteLength()
		};
	}

	/**
	 * Get a buffer view containing the serialized conrent.
	 *
	 * @remarks
	 * - The internal buffer is serialized if needed (to apply pending
	 * 	 modifications).
	 *
	 * @throws
	 * - If buffer serialization is needed and it fails due to invalid fields.
	 */
	getView(): DataView
	{
		if (this.needsSerialization())
		{
			this.serialize();
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
	 * Whether {@link serialize} should be called due to modifications not being
	 * yet applied into the buffer.
	 */
	needsSerialization(): boolean
	{
		return this.#serializationNeeded;
	}

	/**
	 * Apply pending changes and serialize the content into a new buffer.
	 *
	 * @remarks
	 * - In most cases there is no need to use this method since many setter
	 *   methods apply the changes within the current buffer. To be sure, check
	 *   {@link needsSerialization} before.
	 *
	 * @throws
	 * - If serialization fails due to invalid fields previously added.
	 */
	abstract serialize(): void;

	/**
	 * Clone the content. The cloned instance does not share any memory with the
	 * original one.
	 *
	 * @param buffer - Buffer in which the content will be serialized. If not
	 *   given, a new one will internally allocated.
	 * @param byteOffset - Byte offset of the given `buffer` where serialization
	 *   will start.
	 *
	 * @remarks
	 * - The buffer is serialized if needed (to apply pending modifications).
	 *
	 * @throws
	 * - If serialization is needed and it fails due to invalid fields or if
	 *   `buffer` is given and it doesn't hold enough space to serialize the
	 *   content.
	 */
	abstract clone(buffer?: ArrayBuffer, byteOffset?: number): Serializable;

	protected setSerializationNeeded(flag: boolean): void
	{
		this.#serializationNeeded = flag;
	}

	protected getSerializationBuffer():
	{
		buffer: ArrayBuffer;
		byteOffset: number;
		byteLength: number;
		// NOTE: ESlint absurdly complaining about "Expected indentation of 2 tabs but
		// found 1".
		// eslint-disable-next-line indent
	}
	{
		const byteLength = this.getByteLength();

		let buffer: ArrayBuffer | undefined;
		let byteOffset = 0;

		this.emit('will-serialize', byteLength, (userBuffer, userByteOffset) =>
		{
			buffer = userBuffer;

			if (userByteOffset !== undefined)
			{
				byteOffset = userByteOffset;
			}
		});

		// The user called the callback and passed a buffer and optional byteOffset.
		if (buffer)
		{
			if (buffer.byteLength - byteOffset < byteLength)
			{
				throw new RangeError(
					`given buffer available space (${buffer.byteLength - byteOffset} bytes) is less than content length (${byteLength} bytes)`
				);
			}

			const uint8Array = new Uint8Array(buffer, byteOffset, byteLength);

			// If a buffer is given, ensure the required length is filled with zeroes.
			uint8Array.fill(0);
		}
		else
		{
			buffer = new ArrayBuffer(byteLength);
		}

		return { buffer, byteOffset, byteLength };
	}

	protected cloneInternal(buffer?: ArrayBuffer, byteOffset?: number): DataView
	{
		if (this.needsSerialization())
		{
			this.serialize();
		}

		let view: DataView;

		// If buffer is given, let's check whether it holds enough space for the
		// content.
		if (buffer)
		{
			byteOffset = byteOffset ?? 0;

			if (buffer.byteLength - byteOffset < this.view.byteLength)
			{
				throw new RangeError(
					`given buffer available space (${buffer.byteLength - byteOffset} bytes) is less than required length (${this.view.byteLength} bytes)`
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
		}
		else
		{
			view = clone<DataView>(this.view);
		}

		return view;
	}
}
