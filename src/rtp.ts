import { clone, padTo4Bytes } from './utils';

const RTP_VERSION = 2;
const FIXED_HEADER_LENGTH = 12;

/**
 * RTP packet dump.
 */
export type RtpPacketDump =
{
	version: number;
	payloadType: number;
	sequenceNumber: number;
	timestamp: number;
	ssrc: number;
	csrc: number[];
	marker: boolean;
	headerExtensionId?: number;
	extensions: { id: number; length: number }[];
	payloadLength: number;
	padding: number;
};

/**
 * ```ts
 * import { isRtp } from 'rtp.js';
 * ```
 *
 * Inspect the given DataView and return a boolean indicating whether it could be
 * a valid RTP packet or not.
 *
 * ```ts
 * if (isRtp(view)) {
 *   console.log('it looks like a valid RTP packet');
 * }
 * ```
 */
export function isRtp(view: DataView): boolean
{
	const firstByte = view.getUint8(0);

	return (
		view.byteLength >= FIXED_HEADER_LENGTH &&
		// DOC: https://tools.ietf.org/html/draft-ietf-avtcore-rfc5764-mux-fixes
		(firstByte > 127 && firstByte < 192) &&
		// RTP Version must be 2.
		(firstByte >> 6) === RTP_VERSION
	);
}

/**
 * ```ts
 * import { RtpPacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTP packet.
 */
export class RtpPacket
{
	// DataView holding the entire RTP packet.
	#view: DataView;
	// CSRC.
	#csrc: number[] = [];
	// Header extension id.
	#headerExtensionId?: number;
	// One-Byte or Two-Bytes extensions indexed by id.
	readonly #extensions: Map<number, ArrayBuffer> = new Map();
	// DataView holding the entire RTP payload.
	#payloadView: DataView;
	// Number of bytes of padding.
	#padding: number = 0;
	// Whether serialization is needed due to modifications.
	#serializationNeeded: boolean = false;

	/**
	 * @param view - If given if will be parsed. Otherwise an empty RTP packet
	 *   (with just the minimal fixed header) will be created.
	 * @throws If `view` is given and it does not contain a valid RTP packet.
	 */
	constructor(view?: DataView)
	{
		// If no view is given, create an empty one with minimum required length.
		if (!view)
		{
			this.#view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Set version.
			this.setVersion();

			// Set empty payload.
			this.#payloadView = new DataView(new ArrayBuffer(0));

			return;
		}

		if (!isRtp(view))
		{
			throw new TypeError('not a RTP packet');
		}

		this.#view = view;

		const viewOffset = this.#view.byteOffset;
		const viewLength = this.#view.byteLength;
		const firstByte = this.#view.getUint8(0);

		// Position relative to the DataView offset.
		let pos = 0;

		pos += FIXED_HEADER_LENGTH;

		// Parse CSRC.
		const csrcCount = firstByte & 0x0F;

		if (csrcCount > 0)
		{
			for (let i = 0; i < csrcCount; ++i)
			{
				// NOTE: This will throw RangeError if there is no space in the buffer.
				this.#csrc.push(this.#view.getUint32(pos));

				pos += 4;
			}
		}

		// Parse header extension.
		const extFlag = Boolean((firstByte >> 4) & 1);
		let extBuffer: ArrayBuffer | undefined;

		if (extFlag)
		{
			// NOTE: This will throw RangeError if there is no space in the buffer.
			this.#headerExtensionId = this.#view.getUint16(pos);

			const length = this.#view.getUint16(pos + 2) * 4;

			// TODO: Do not create ArrayBuffer.
			extBuffer = this.#view.buffer.slice(
				viewOffset + pos + 4, viewOffset + pos + 4 + length
			);

			pos += (4 + length);
		}

		// Parse One-Byte or Two-Bytes extensions.
		if (extBuffer && this.hasOneByteExtensions())
		{
			const extView = new DataView(extBuffer);
			let extPos = 0;

			// One-Byte extensions cannot have length 0.
			while (extPos < extBuffer.byteLength)
			{
				const id = (extView.getUint8(extPos) & 0xF0) >> 4;
				const length = (extView.getUint8(extPos) & 0x0F) + 1;

				// id=15 in One-Byte extensions means "stop parsing here".
				if (id === 15)
				{
					break;
				}

				// Valid extension id.
				if (id !== 0)
				{
					if (extPos + 1 + length > extBuffer.byteLength)
					{
						throw new RangeError(
							'not enough space for the announced One-Byte extension value'
						);
					}

					// Store the One-Byte extension element in the map.
					this.#extensions.set(
						id,
						extBuffer.slice(extPos + 1, extPos + 1 + length)
					);

					extPos += (length + 1);
				}
				// id=0 means alignment.
				else
				{
					++extPos;
				}

				// Counting padding bytes.
				while (extPos < extBuffer.byteLength && extView.getUint8(extPos) === 0)
				{
					++extPos;
				}
			}
		}
		else if (extBuffer && this.hasTwoBytesExtensions())
		{
			const extView = new DataView(extBuffer);
			let extPos = 0;

			// Two-Byte extensions can have length 0.
			while (extPos + 1 < extBuffer.byteLength)
			{
				const id = extView.getUint8(extPos);
				const length = extView.getUint8(extPos + 1);

				// Valid extension id.
				if (id !== 0)
				{
					if (extPos + 2 + length > extBuffer.byteLength)
					{
						throw new RangeError(
							'not enough space for the announced Two-Bytes extension value'
						);
					}

					// Store the Two-Bytes extension element in the map.
					this.#extensions.set(
						id,
						extBuffer.slice(extPos + 2, extPos + 2 + length)
					);

					extPos += (length + 2);
				}
				// id=0 means alignment.
				else
				{
					++extPos;
				}

				// Counting padding bytes.
				while (extPos < extBuffer.byteLength && extView.getUint8(extPos) === 0)
				{
					++extPos;
				}
			}
		}

		// Get padding.
		const paddingFlag = Boolean((firstByte >> 5) & 1);

		if (paddingFlag)
		{
			// NOTE: This will throw RangeError if there is no space in the view.
			this.#padding = this.#view.getUint8(viewLength - 1);
		}

		// Get payload.
		const payloadLength = viewLength - pos - this.#padding;

		if (payloadLength < 0)
		{
			throw new RangeError(
				`announced padding (${this.#padding} bytes) is bigger than available space for payload (${viewLength - pos} bytes)`
			);
		}

		this.#payloadView = new DataView(
			this.#view.buffer,
			viewOffset + pos,
			payloadLength
		);

		// Ensure that view length and parsed length match.
		pos += (payloadLength + this.#padding);

		if (pos !== viewLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${viewLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTP packet info.
	 */
	dump(): RtpPacketDump
	{
		const extensions = Array.from(this.#extensions)
			.map(([ id, value ]) =>
			{
				return {
					id      : id,
					length  : value.byteLength
				};
			});

		return {
			version           : this.getVersion(),
			payloadType       : this.getPayloadType(),
			sequenceNumber    : this.getSequenceNumber(),
			timestamp         : this.getTimestamp(),
			ssrc              : this.getSsrc(),
			csrc              : this.#csrc,
			marker            : this.getMarker(),
			headerExtensionId : this.#headerExtensionId,
			extensions        : extensions,
			payloadLength     : this.#payloadView.byteLength,
			padding           : this.#padding
		};
	}

	/**
	 * Get the DataView containing the serialized RTP binary packet.
	 *
	 * @remarks
	 * The internal ArrayBuffer is serialized if needed (to apply packet pending
	 * modifications).
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 */
	getView(): DataView
	{
		if (this.needsSerialization())
		{
			this.serialize();
		}

		return this.#view;
	}

	/**
	 * Whether {@link serialize} should be called due to modifications in the
	 * packet not being yet applied into the internal ArrayBuffer.
	 */
	needsSerialization(): boolean
	{
		return this.#serializationNeeded;
	}

	/**
	 * Get the RTP version of the packet (always 2).
	 */
	getVersion(): number
	{
		return (this.#view.getUint8(0) >> 6);
	}

	/**
	 * Get the RTP payload type.
	 */
	getPayloadType(): number
	{
		return (this.#view.getUint8(1) & 0x7F);
	}

	/**
	 * Set the RTP payload type.
	 */
	setPayloadType(payloadType: number): void
	{
		this.#view.setUint8(1, (this.#view.getUint8(1) & 0x80) | (payloadType & 0x7F));
	}

	/**
	 * Get the RTP sequence number.
	 */
	getSequenceNumber(): number
	{
		return this.#view.getUint16(2);
	}

	/**
	 * Set the RTP sequence number.
	 */
	setSequenceNumber(sequenceNumber: number): void
	{
		this.#view.setUint16(2, sequenceNumber);
	}

	/**
	 * Get the RTP timestamp.
	 */
	getTimestamp(): number
	{
		return this.#view.getUint32(4);
	}

	/**
	 * Set the RTP timestamp.
	 */
	setTimestamp(timestamp: number): void
	{
		this.#view.setUint32(4, timestamp);
	}

	/**
	 * Get the RTP SSRC.
	 */
	getSsrc(): number
	{
		return this.#view.getUint32(8);
	}

	/**
	 * Set the RTP SSRC.
	 */
	setSsrc(ssrc: number): void
	{
		this.#view.setUint32(8, ssrc);
	}

	/**
	 * Get the RTP CSRC values.
	 */
	getCsrc(): number[]
	{
		return this.#csrc;
	}

	/**
	 * Set the RTP CSRC values. If `csrc` is not given (or if it's an empty
	 * array) CSRC field will be removed from the RTP packet.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 */
	setCsrc(csrc: number[] = []): void
	{
		this.#csrc = csrc;

		// Update CSRC count.
		const count = this.#csrc.length;

		this.#view.setUint8(
			0,
			(this.#view.getUint8(0) & 0xF0) | (count & 0x0F)
		);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the RTP marker flag.
	 */
	getMarker(): boolean
	{
		return Boolean(this.#view.getUint8(1) >> 7);
	}

	/**
	 * Set the RTP marker flag.
	 */
	setMarker(marker: boolean): void
	{
		const bit = marker ? 1 : 0;

		this.#view.setUint8(1, this.#view.getUint8(1) | (bit << 7));
	}

	/**
	 * Whether One-Byte extensions (as per RFC 5285) are enabled.
	 */
	hasOneByteExtensions(): boolean
	{
		return this.#headerExtensionId === 0xBEDE;
	}

	/**
	 * Whether Two-Bytes extensions (as per RFC 5285) are enabled.
	 */
	hasTwoBytesExtensions(): boolean
	{
		return this.#headerExtensionId
			? (this.#headerExtensionId & 0b1111111111110000) === 0b0001000000000000
			: false;
	}

	/**
	 * Enable One-Byte extensions (RFC 5285).
	 *
	 * @remarks
	 * Serialization maybe needed after calling this method.
	 */
	enableOneByteExtensions(): void
	{
		if (this.hasOneByteExtensions())
		{
			return;
		}

		this.#headerExtensionId = 0xBEDE;

		this.setSerializationNeeded(true);
	}

	/**
	 * Enable Two-Bytes extensions (RFC 5285).
	 *
	 * @remarks
	 * Serialization maybe needed after calling this method.
	 */
	enableTwoBytesExtensions(): void
	{
		if (this.hasTwoBytesExtensions())
		{
			return;
		}

		this.#headerExtensionId = 0b0001000000000000;

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the value of the extension (RFC 5285) with given `id` (if any).
	 */
	getExtension(id: number): ArrayBuffer | undefined
	{
		return this.#extensions.get(id);
	}

	/**
	 * Get an iterator with all the extensions (RFC 5285).
	 */
	getExtensions(): IterableIterator<[number, ArrayBuffer]>
	{
		return this.#extensions.entries();
	}

	/**
	 * Set the value of the extension (RFC 5285) with given `id`.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 */
	setExtension(id: number, value: ArrayBuffer): void
	{
		// Update header extension bit if needed.
		if (this.#extensions.size === 0)
		{
			this.setHeaderExtensionBit(1);

			// If neither One-Byte nor Two-Bytes modes are enabled, force One-Byte.
			if (!this.hasOneByteExtensions() && !this.hasTwoBytesExtensions())
			{
				this.enableOneByteExtensions();
			}
		}

		this.#extensions.set(id, value);

		this.setSerializationNeeded(true);
	}

	/**
	 * Delete the extension (RFC 5285) with given `id` (if any).
	 *
	 * @remarks
	 * Serialization maybe needed after calling this method.
	 */
	deleteExtension(id: number): void
	{
		if (!this.#extensions.delete(id))
		{
			return;
		}

		// Update header extension bit if needed.
		if (this.#extensions.size === 0)
		{
			this.setHeaderExtensionBit(0);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Clear all extensions (RFC 5285).
	 *
	 * @remarks
	 * Serialization maybe needed after calling this method.
	 */
	clearExtensions(): void
	{
		if (this.#extensions.size === 0)
		{
			return;
		}

		this.#extensions.clear();

		// Update header extension bit.
		this.setHeaderExtensionBit(0);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the packet payload.
	 */
	getPayloadView(): DataView
	{
		return this.#payloadView;
	}

	/**
	 * Set the packet payload.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 */
	setPayloadView(view: DataView): void
	{
		this.#payloadView = view;

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the padding (in bytes) after the packet payload.
	 */
	getPadding(): number
	{
		return this.#padding;
	}

	/**
	 * Set the padding (in bytes) after the packet payload.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 */
	setPadding(padding: number): void
	{
		this.#padding = padding;

		// Update padding bit.
		const bit = padding ? 1 : 0;

		this.setPaddingBit(bit);

		this.setSerializationNeeded(true);
	}

	/**
	 * Pad the packet total length to 4 bytes. To achieve it, this method may add
	 * or remove bytes of padding.
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 */
	padTo4Bytes(): void
	{
		if (this.needsSerialization())
		{
			this.serialize();
		}

		const viewLength = this.#view.byteLength;
		const padding = this.#padding;
		const newLength = padTo4Bytes(viewLength - padding);

		if (newLength === viewLength)
		{
			return;
		}

		this.setPadding(padding + newLength - viewLength);

		this.setSerializationNeeded(true);
	}

	/**
	 * Encode the packet using RTX procedures (as per RFC 4588).
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 *
	 * @param payloadType - The RTX payload type.
	 * @param ssrc - The RTX SSRC.
	 * @param sequenceNumber - The RTX sequence number.
	 */
	rtxEncode(payloadType: number, ssrc: number, sequenceNumber: number)
	{
		// Rewrite the payload type.
		this.setPayloadType(payloadType);

		// Rewrite the SSRC.
		this.setSsrc(ssrc);

		const payloadView = new DataView(
			new ArrayBuffer(2 + this.#payloadView.byteLength)
		);
		const payloadUint8Array = new Uint8Array(
			payloadView.buffer, payloadView.byteOffset, payloadView.byteLength
		);

		// Write the original sequence number at the begining of the new payload.
		payloadView.setUint16(0, this.getSequenceNumber());

		// Copy the original payload after the sequence number.
		payloadUint8Array.set(
			new Uint8Array(
				this.#payloadView.buffer,
				this.#payloadView.byteOffset,
				this.#payloadView.byteLength
			),
			2
		);

		this.#payloadView = new DataView(
			payloadUint8Array.buffer,
			payloadUint8Array.byteOffset,
			payloadUint8Array.byteLength
		);

		// Rewrite the sequence number.
		this.setSequenceNumber(sequenceNumber);

		// Remove padding.
		this.setPadding(0);

		this.setSerializationNeeded(true);
	}

	/**
	 * Decode the packet using RTX procedures (as per RFC 4588).
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 *
	 * @param payloadType - The original payload type.
	 * @param ssrc - The original SSRC.
	 * @throws If payload length is less than 2 bytes, so RTX decode is not
	 *   possible.
	 */
	rtxDecode(payloadType: number, ssrc: number)
	{
		if (this.#payloadView.byteLength < 2)
		{
			throw new RangeError(
				'payload length must be greater or equal than 2 bytes'
			);
		}

		// Rewrite the payload type.
		this.setPayloadType(payloadType);

		// Rewrite the SSRC.
		this.setSsrc(ssrc);

		// Rewrite the sequence number.
		const sequenceNumber = this.#payloadView.getUint16(0);

		this.setSequenceNumber(sequenceNumber);

		// Reduce the payload.
		this.setPayloadView(
			new DataView(this.#payloadView.buffer, this.#payloadView.byteOffset + 2)
		);

		// Remove padding.
		this.setPadding(0);

		this.setSerializationNeeded(true);
	}

	/**
	 * Clone the packet. The cloned packet does not share any memory with the
	 * original one.
	 *
	 * @remarks
	 * The buffer is serialized if needed (to apply packet pending modifications).
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 */
	clone(): RtpPacket
	{
		if (this.needsSerialization())
		{
			this.serialize();
		}

		return new RtpPacket(clone<DataView>(this.#view));
	}

	/**
	 * Apply pending changes into the packet and serialize it into a new internal
	 * buffer (the one that {@link getBuffer} will later return).
	 *
	 * @remarks
	 * In most cases there is no need to use this method since many setter methods
	 * apply the changes within the current buffer. To be sure, check
	 * {@link needsSerialization} before.
	 *
	 * @throws If invalid fields were previously added to the packet.
	 */
	serialize(): void
	{
		// Compute required buffer length.
		let length = FIXED_HEADER_LENGTH;

		// Add space for CSRC values.
		length += this.#csrc.length * 4;

		// Add space for the header extension (just if there are extensions).
		if (this.#extensions.size > 0)
		{
			// Add space for header extension id/length fields.
			length += 4;

			if (this.hasOneByteExtensions())
			{
				for (const [ id, value ] of this.#extensions)
				{
					if (id % 16 !== 0)
					{
						// Add space for extension id/length fields.
						length += 1 + value.byteLength;
					}
				}
			}
			else if (this.hasTwoBytesExtensions())
			{
				for (const [ id, value ] of this.#extensions)
				{
					if (id % 256 !== 0)
					{
						// Add space for extension id/length fields.
						length += 2 + value.byteLength;
					}
				}
			}

			// May need to add padding.
			length = padTo4Bytes(length);
		}

		// Add space for payload.
		length += this.#payloadView.byteLength;

		// Add space for padding.
		length += this.#padding;

		// Allocate new DataView with new buffer.
		const view = new DataView(new ArrayBuffer(length));

		// This is 0, but anyway let's be strict.
		const viewOffset = view.byteOffset;
		const viewLength = view.byteLength;
		const uint8Array = new Uint8Array(view.buffer, viewOffset, viewLength);

		// Position relative to the DataView offset.
		let pos = 0;

		// Copy the fixed header into the new buffer.
		uint8Array.set(
			new Uint8Array(this.#view.buffer, this.#view.byteOffset, FIXED_HEADER_LENGTH),
			0
		);

		pos += FIXED_HEADER_LENGTH;

		// Write CSRC.
		for (const ssrc of this.#csrc)
		{
			view.setUint32(pos, ssrc);

			pos += 4;
		}

		// Write header extension.
		if (this.#extensions.size > 0 && this.hasOneByteExtensions())
		{
			view.setUint16(pos, this.#headerExtensionId!);

			const extLengthPos = pos + 2;
			let extLength = 0;

			// Move to the header extension value.
			pos += 4;

			for (const [ id, value ] of this.#extensions)
			{
				if (id % 16 === 0)
				{
					this.#extensions.delete(id);

					continue;
				}

				if (value.byteLength === 0)
				{
					throw new TypeError(
						'cannot serialize extensions with length 0 in One-Byte mode'
					);
				}
				else if (value.byteLength > 16)
				{
					throw new RangeError(
						'cannot serialize extensions with length > 16 in One-Byte mode'
					);
				}

				const idLength = (id << 4) & ((value.byteLength - 1) & 0x0F);

				view.setUint8(pos, idLength);

				pos += 1;
				extLength += 1;

				// TODO: This must change since extensions must hold DataViews instead
				// of ArrayBuffers.
				uint8Array.set(new Uint8Array(value), pos);

				pos += value.byteLength;
				extLength += value.byteLength;
			}

			// May need to add padding.
			pos = padTo4Bytes(pos);
			extLength = padTo4Bytes(extLength);

			// Write header extension length.
			view.setUint16(extLengthPos, extLength / 4);
		}
		else if (this.#extensions.size > 0 && this.hasTwoBytesExtensions())
		{
			view.setUint16(pos, this.#headerExtensionId!);

			const extLengthPos = pos + 2;
			let extLength = 0;

			// Move to the header extension value.
			pos += 4;

			for (const [ id, value ] of this.#extensions)
			{
				if (id % 256 === 0)
				{
					this.#extensions.delete(id);

					continue;
				}

				if (value.byteLength > 255)
				{
					throw new RangeError(
						'cannot serialize extensions with length > 255 in Two-Bytes mode'
					);
				}

				view.setUint8(pos, id);

				pos += 1;
				extLength += 1;

				view.setUint8(pos, value.byteLength);

				pos += 1;
				extLength += 1;

				// TODO: This must change since extensions must hold DataViews instead
				// of ArrayBuffers.
				uint8Array.set(new Uint8Array(value), pos);

				pos += value.byteLength;
				extLength += value.byteLength;
			}

			// May need to add padding.
			pos = padTo4Bytes(pos);
			extLength = padTo4Bytes(extLength);

			// Write header extension length.
			view.setUint16(extLengthPos, extLength / 4);
		}
		// Otherwise remove the header extension.
		else
		{
			this.setHeaderExtensionBit(0);
			this.#extensions.clear();
		}

		// Write payload.
		uint8Array.set(
			new Uint8Array(
				this.#payloadView.buffer,
				this.#payloadView.byteOffset,
				this.#payloadView.byteLength
			),
			pos
		);

		// Create new payload DataView.
		const payloadView = new DataView(
			uint8Array.buffer,
			pos,
			this.#payloadView.byteLength
		);

		pos += payloadView.byteLength;

		// Write padding.
		if (this.#padding > 0)
		{
			if (this.#padding > 255)
			{
				throw new TypeError(
					`padding (${this.#padding} bytes) cannot be higher than 255`
				);
			}

			uint8Array.fill(0, pos, pos + this.#padding - 1);

			view.setUint8(pos + this.#padding - 1, this.#padding);

			pos += this.#padding;
		}

		// Assert that current position matches new buffer length.
		if (pos !== viewLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match new DataView byte length (${viewLength} bytes)`
			);
		}

		// Update DataView.
		this.#view = view;

		// Update payload DataView.
		this.#payloadView = payloadView;

		this.setSerializationNeeded(false);
	}

	private setSerializationNeeded(flag: boolean): void
	{
		this.#serializationNeeded = flag;
	}

	private setVersion(): void
	{
		this.#view.setUint8(0, RTP_VERSION << 6);
	}

	private setHeaderExtensionBit(bit: number)
	{
		this.#view.setUint8(0, this.#view.getUint8(0) | (bit << 4));
	}

	private setPaddingBit(bit: number)
	{
		this.#view.setUint8(0, this.#view.getUint8(0) | (bit << 5));
	}
}
