import { EnhancedEventEmitter } from './EnhancedEventEmitter';

/**
 * Event emitted when the content is being serialized. The user has a chance to
 * provide with a buffer, otherwise a new one will be internally allocated.
 *
 * @param `length: number`: Required buffer length (in bytes).
 * @param `callback: (buffer, byteOffset?) => void`: A function that can be
 *   optionally called to pass a buffer and a byte offset where the content will
 *   be serialized.
 *
 * @remarks
 * - If given, the buffer byte length minus the given byte offset must be equal
 *   or higher than `length`.
 *
 * @example
 * ```ts
 * packet.on('will-serialize', (length, callback) => {
 *   const buffer = new ArrayBuffer(length);
 *
 *   callback(buffer);
 * });
 * ```
 */
export type WillSerializeEvent =
[
	number,
	(buffer: ArrayBuffer, byteOffset?: number) => void
];

/**
 * Common events of RTP and RTCP packets.
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
	 * Get a buffer view containing the serialized conrent.
	 *
	 * @remarks
	 * - The internal ArrayBuffer is serialized if needed (to apply pending
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

		this.safeEmit('will-serialize', length, (_buffer, _byteOffset) =>
		{
			buffer = _buffer;
			byteOffset = _byteOffset ?? 0;
		});

		// NOTE: TypeScript is not that smart and it doesn't know that byteOffset
		// here is guaranteed to have a value in case buffer has a value.
		if (buffer && buffer.byteLength - byteOffset! < length)
		{
			throw new RangeError(
				`given buffer available space (${buffer.byteLength - byteOffset!} bytes) is less than content length (${length} bytes)`
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
