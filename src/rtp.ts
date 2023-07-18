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
 * Inspect the given buffer and return a boolean indicating whether it could be
 * a valid RTP packet or not.
 *
 * ```ts
 * if (isRtp(buffer)) {
 *   console.log('it looks like a valid RTP packet');
 * }
 * ```
 */
export function isRtp(buffer: ArrayBuffer): boolean
{
	const view = new DataView(buffer);
	const firstByte = view.getUint8(0);

	return (
		buffer.byteLength >= FIXED_HEADER_LENGTH &&
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
	// ArrayBuffer holding packet binary data.
	#buffer: ArrayBuffer;
	// DataView holding the ArrayBuffer.
	#view: DataView;
	// CSRC.
	#csrc: number[] = [];
	// Header extension id.
	#headerExtensionId?: number;
	// One-Byte or Two-Bytes extensions indexed by id.
	readonly #extensions: Map<number, ArrayBuffer> = new Map();
	// Payload.
	#payload: ArrayBuffer;
	// Number of bytes of padding.
	#padding: number = 0;
	// Whether serialization is needed due to modifications.
	#serializationNeeded: boolean = false;

	/**
	 * @param buffer - If given if will be parsed. Otherwise an empty RTP packet
	 *   (with just the minimal fixed header) will be created.
	 * @throws If `buffer` is given and it does not contain a valid RTP packet.
	 */
	constructor(buffer?: ArrayBuffer)
	{
		// If no buffer is given, create an empty one with minimum required length.
		if (!buffer)
		{
			this.#buffer = new ArrayBuffer(FIXED_HEADER_LENGTH);
			this.#view = new DataView(this.#buffer);

			// Set version.
			this.setVersion();

			// Set empty payload.
			this.#payload = new ArrayBuffer(0);

			return;
		}

		if (!isRtp(buffer))
		{
			throw new TypeError('invalid RTP packet');
		}

		this.#buffer = buffer;
		this.#view = new DataView(this.#buffer);

		const firstByte = this.#view.getUint8(0);
		let pos = FIXED_HEADER_LENGTH;

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

			extBuffer = this.#buffer.slice(pos + 4, pos + 4 + length);

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
					this.#extensions.set(id, extBuffer.slice(extPos + 1, extPos + 1 + length));

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
					this.#extensions.set(id, extBuffer.slice(extPos + 2, extPos + 2 + length));

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
			// NOTE: This will throw RangeError if there is no space in the buffer.
			this.#padding = this.#view.getUint8(this.#buffer.byteLength - 1);
		}

		// Get payload.
		const payloadLength = this.#buffer.byteLength - pos - this.#padding;

		if (payloadLength < 0)
		{
			throw new RangeError(
				`announced padding (${this.#padding} bytes) is bigger than available space for payload (${this.#buffer.byteLength - pos} bytes)`
			);
		}

		this.#payload = this.#buffer.slice(pos, pos + payloadLength);

		// Ensure that buffer length and parsed length match.
		pos += (payloadLength + this.#padding);

		if (pos !== this.#buffer.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match buffer length (${this.#buffer.byteLength} bytes)`
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
			payloadLength     : this.#payload.byteLength,
			padding           : this.#padding
		};
	}

	/**
	 * Get the internal buffer containing the serialized RTP binary packet. The
	 * buffer is serialized only if needed (to apply packet modifications).
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 */
	getBuffer(): ArrayBuffer
	{
		if (this.#serializationNeeded)
		{
			this.serialize();
		}

		return this.#buffer;
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
	 */
	setCsrc(csrc: number[] = []): void
	{
		this.#serializationNeeded = true;
		this.#csrc = csrc;

		// Update CSRC count.
		const count = this.#csrc.length;

		this.#view.setUint8(
			0,
			(this.#view.getUint8(0) & 0xF0) | (count & 0x0F)
		);
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
	 */
	enableOneByteExtensions(): void
	{
		if (this.hasOneByteExtensions())
		{
			return;
		}

		this.#headerExtensionId = 0xBEDE;
		this.#serializationNeeded = true;
	}

	/**
	 * Enable Two-Bytes extensions (RFC 5285).
	 */
	enableTwoBytesExtensions(): void
	{
		if (this.hasTwoBytesExtensions())
		{
			return;
		}

		this.#headerExtensionId = 0b0001000000000000;
		this.#serializationNeeded = true;
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
		this.#serializationNeeded = true;
	}

	/**
	 * Delete the extension (RFC 5285) with given `id` (if any).
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

		this.#serializationNeeded = true;
	}

	/**
	 * Clear all extensions (RFC 5285).
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

		this.#serializationNeeded = true;
	}

	/**
	 * Get the packet payload.
	 */
	getPayload(): ArrayBuffer
	{
		return this.#payload;
	}

	/**
	 * Set the packet payload.
	 *
	 * ```ts
	 * const payload = new ArrayBuffer([ 0x01, 0x02, 0x03, 0x04 ];
	 *
	 * packet.setPayload(payload.buffer);
	 * ```
	 */
	setPayload(payload: ArrayBuffer): void
	{
		this.#payload = payload;
		this.#serializationNeeded = true;
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
	 */
	setPadding(padding: number): void
	{
		this.#padding = padding;

		// Update padding bit.
		const bit = padding ? 1 : 0;

		this.setPaddingBit(bit);

		this.#serializationNeeded = true;
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
		if (this.#serializationNeeded)
		{
			this.serialize();
		}

		const length = this.#buffer.byteLength;
		const padding = this.#padding;
		const newLength = padTo4Bytes(length - padding);

		if (newLength === length)
		{
			return;
		}

		this.setPadding(padding + newLength - length);
	}

	/**
	 * Clone the packet. The cloned packet does not share any memory with the
	 * original one.
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 */
	clone(): RtpPacket
	{
		if (this.#serializationNeeded)
		{
			this.serialize();
		}

		return new RtpPacket(clone<ArrayBuffer>(this.#buffer));
	}

	/**
	 * Encode the packet using RTX procedures (as per RFC 4588).
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

		// Write the original sequence number at the begining of the new payload.
		const seqBuffer = new ArrayBuffer(2);
		const seqView = new DataView(seqBuffer);

		seqView.setUint16(0, this.getSequenceNumber());

		const newPayloadArray =
			new Uint8Array(seqBuffer.byteLength + this.#payload.byteLength);

		newPayloadArray.set(new Uint8Array(seqBuffer), 0);
		newPayloadArray.set(new Uint8Array(this.#payload), seqBuffer.byteLength);

		this.setPayload(newPayloadArray.buffer);

		// Rewrite the sequence number.
		this.setSequenceNumber(sequenceNumber);

		// Remove padding.
		this.setPadding(0);

		this.#serializationNeeded = true;
	}

	/**
	 * Decode the packet using RTX procedures (as per RFC 4588).
	 *
	 * @param payloadType - The original payload type.
	 * @param ssrc - The original SSRC.
	 * @throws If payload length is less than 2 bytes, so RTX decode is not
	 *   possible.
	 */
	rtxDecode(payloadType: number, ssrc: number)
	{
		if (this.#payload.byteLength < 2)
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
		const sequenceNumber = (new DataView(this.#payload)).getUint16(0);

		this.setSequenceNumber(sequenceNumber);

		// Reduce the payload.
		this.setPayload(this.#payload.slice(2));

		// Remove padding.
		this.setPadding(0);

		this.#serializationNeeded = true;
	}

	/**
	 * Apply pending changes into the packet and serialize it into a new internal
	 * buffer (the one that {@link getBuffer} will later return).
	 *
	 * @remarks
	 * In most cases there is no need to use this method. It must be
	 * called only if the application retrieves information from the packet (by
	 * calling {@link getBuffer}, {@link getPayload}, {@link getExtension}, etc)
	 * and modifies the obtained buffers in place. However, it's recommended to
	 * use the existing setter methods instead ({@link setPayload},
	 * {@link setExtension}, etc).
	 *
	 * @throws If invalid fields were previously added to the packet.
	 */
	serialize(): void
	{
		const previousBuffer = this.#buffer;

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
		length += this.#payload.byteLength;

		// Add space for padding.
		length += this.#padding;

		// Allocate new buffer.
		const newBuffer = new ArrayBuffer(length);
		const newView = new DataView(newBuffer);
		const newArray = new Uint8Array(newBuffer);

		// Copy the fixed header into the new buffer.
		newArray.set(new Uint8Array(previousBuffer, 0, FIXED_HEADER_LENGTH), 0);

		let pos = FIXED_HEADER_LENGTH;

		// Write CSRC.
		for (const ssrc of this.#csrc)
		{
			newView.setUint32(pos, ssrc);
			pos += 4;
		}

		// Write header extension.
		if (this.#extensions.size > 0 && this.hasOneByteExtensions())
		{
			newView.setUint16(pos, this.#headerExtensionId!);

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

				newView.setUint8(pos, idLength);
				pos += 1;
				extLength += 1;

				newArray.set(new Uint8Array(value), pos);
				pos += value.byteLength;
				extLength += value.byteLength;
			}

			// May need to add padding.
			pos = padTo4Bytes(pos);
			extLength = padTo4Bytes(extLength);

			// Write header extension length.
			newView.setUint16(extLengthPos, extLength / 4);
		}
		else if (this.#extensions.size > 0 && this.hasTwoBytesExtensions())
		{
			newView.setUint16(pos, this.#headerExtensionId!);

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

				newView.setUint8(pos, id);
				pos += 1;
				extLength += 1;

				newView.setUint8(pos, value.byteLength);
				pos += 1;
				extLength += 1;

				newArray.set(new Uint8Array(value), pos);
				pos += value.byteLength;
				extLength += value.byteLength;
			}

			// May need to add padding.
			pos = padTo4Bytes(pos);
			extLength = padTo4Bytes(extLength);

			// Write header extension length.
			newView.setUint16(extLengthPos, extLength / 4);
		}
		// Otherwise remove the header extension.
		else
		{
			this.setHeaderExtensionBit(0);
			this.#extensions.clear();
		}

		// Write payload.
		newArray.set(new Uint8Array(this.#payload), pos);
		pos += this.#payload.byteLength;

		// Write padding.
		if (this.#padding > 0)
		{
			if (this.#padding > 255)
			{
				throw new TypeError(
					`padding (${this.#padding} bytes) cannot be higher than 255`
				);
			}

			newArray.fill(0, pos, pos + this.#padding - 1);
			newView.setUint8(pos + this.#padding - 1, this.#padding);
			pos += this.#padding;
		}

		// Assert that current position matches new buffer length.
		if (pos !== newBuffer.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match new buffer length (${newBuffer.byteLength} bytes)`
			);
		}

		// Update buffer.
		this.#buffer = newBuffer;

		// Reset flag.
		this.#serializationNeeded = false;
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
