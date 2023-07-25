import { RtcPacket } from './RtcPacket';
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
	byteLength: number;
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
export class RtpPacket extends RtcPacket
{
	// CSRC.
	#csrc: number[] = [];
	// Header extension id.
	#headerExtensionId?: number;
	// DataView holding the header extension value. Only if One-Byte or Two-Bytes
	// extensions are used.
	#headerExtensionView?: DataView;
	// One-Byte or Two-Bytes extensions indexed by id.
	readonly #extensions: Map<number, DataView> = new Map();
	// DataView holding the entire RTP payload.
	#payloadView: DataView;
	// Number of bytes of padding.
	#padding: number = 0;

	/**
	 * @param view - If given if will be parsed. Otherwise an empty RTP packet
	 *   (with just the minimal fixed header) will be created.
	 *
	 * @throws
	 * If `view` is given and it does not contain a valid RTP packet.
	 */
	constructor(view?: DataView)
	{
		super();

		if (view)
		{
			console.log('---- constructor() | view.byteLength:', view.byteLength);
		}

		// If no view is given, create an empty one with minimum required length.
		if (!view)
		{
			this.packetView = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Set version.
			this.setVersion();

			// Set empty payload.
			this.#payloadView = new DataView(
				this.packetView.buffer,
				this.packetView.byteOffset + FIXED_HEADER_LENGTH,
				0
			);

			return;
		}

		if (!isRtp(view))
		{
			throw new TypeError('not a RTP packet');
		}

		this.packetView = view;

		const firstByte = this.packetView.getUint8(0);

		// Position relative to the DataView byte offset.
		let pos = 0;

		pos += FIXED_HEADER_LENGTH;

		// Parse CSRC.
		const csrcCount = firstByte & 0x0F;

		if (csrcCount > 0)
		{
			for (let i = 0; i < csrcCount; ++i)
			{
				// NOTE: This will throw RangeError if there is no space in the buffer.
				this.#csrc.push(this.packetView.getUint32(pos));

				pos += 4;
			}
		}

		// Parse header extension.
		const hasHeaderExtension = this.getHeaderExtensionBit();

		let headerExtensionView: DataView | undefined;

		if (hasHeaderExtension)
		{
			// NOTE: This will throw RangeError if there is no space in the buffer.
			this.#headerExtensionId = this.packetView.getUint16(pos);

			pos += 2;

			const headerExtensionLength = this.packetView.getUint16(pos) * 4;

			console.log('--- constructor() | headerExtensionLength:', headerExtensionLength);

			pos += 2;

			headerExtensionView = new DataView(
				this.packetView.buffer,
				this.packetView.byteOffset + pos,
				headerExtensionLength
			);

			pos += headerExtensionLength;
		}

		// Parse One-Byte or Two-Bytes extensions.
		if (headerExtensionView && this.hasOneByteExtensions())
		{
			let extPos = 0;

			// One-Byte extensions cannot have length 0.
			while (extPos < headerExtensionView.byteLength)
			{
				const extId = (headerExtensionView.getUint8(extPos) & 0xF0) >> 4;
				const extLength = (headerExtensionView.getUint8(extPos) & 0x0F) + 1;

				// id=15 in One-Byte extensions means "stop parsing here".
				if (extId === 15)
				{
					break;
				}

				// Valid extension extId.
				if (extId !== 0)
				{
					if (extPos + 1 + extLength > headerExtensionView.byteLength)
					{
						throw new RangeError(
							'not enough space for the announced One-Byte extension value'
						);
					}

					// Store the One-Byte extension element in the map.
					this.#extensions.set(
						extId,
						new DataView(
							headerExtensionView.buffer,
							headerExtensionView.byteOffset + extPos + 1,
							extLength
						)
					);

					extPos += (1 + extLength);
				}
				// id=0 means alignment.
				else
				{
					++extPos;
				}

				// Counting padding bytes.
				while (
					extPos < headerExtensionView.byteLength &&
					headerExtensionView.getUint8(extPos) === 0
				)
				{
					++extPos;
				}
			}
		}
		else if (headerExtensionView && this.hasTwoBytesExtensions())
		{
			let extPos = 0;

			// Two-Byte extensions can have length 0.
			while (extPos + 1 < headerExtensionView.byteLength)
			{
				const extId = headerExtensionView.getUint8(extPos);
				const extLength = headerExtensionView.getUint8(extPos + 1);

				console.log(
					'--- constructor() | extension | pos:%o, extPos:%o, extId:%o, extLength',
					pos, extPos, extId, extLength
				);

				// Valid extension id.
				if (extId !== 0)
				{
					if (extPos + 2 + extLength > headerExtensionView.byteLength)
					{
						throw new RangeError(
							'not enough space for the announced Two-Bytes extension value'
						);
					}

					// Store the Two-Bytes extension element in the map.
					this.#extensions.set(
						extId,
						new DataView(
							headerExtensionView.buffer,
							headerExtensionView.byteOffset + extPos + 2,
							extLength
						)
					);

					extPos += (2 + extLength);
				}
				// id=0 means alignment.
				else
				{
					++extPos;
				}

				// Counting padding bytes.
				while (
					extPos < headerExtensionView.byteLength &&
					headerExtensionView.getUint8(extPos) === 0
				)
				{
					++extPos;
				}
			}
		}
		// In case there is an extension header which doesn't contain One-Byte or
		// Two-Bytes extensions, and only in that case, keep the header extension
		// value in a member.
		else if (hasHeaderExtension)
		{
			this.#headerExtensionView = headerExtensionView;
		}

		// Get padding.
		const paddingFlag = Boolean((firstByte >> 5) & 1);

		if (paddingFlag)
		{
			// NOTE: This will throw RangeError if there is no space in the view.
			this.#padding = this.packetView.getUint8(
				this.packetView.byteLength - 1
			);
		}

		console.log('--- constructor() | paddingFlag:%o, this.#padding:%o', paddingFlag, this.#padding);

		// Get payload.
		const payloadLength = this.packetView.byteLength - pos - this.#padding;

		console.log('--- constructor() | payloadLength:%o:', payloadLength);

		if (payloadLength < 0)
		{
			throw new RangeError(
				`announced padding (${this.#padding} bytes) is bigger than available space for payload (${this.packetView.byteLength - pos} bytes)`
			);
		}

		this.#payloadView = new DataView(
			this.packetView.buffer,
			this.packetView.byteOffset + pos,
			payloadLength
		);

		// Ensure that view length and parsed length match.
		pos += (payloadLength + this.#padding);

		if (pos !== this.packetView.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.packetView.byteLength} bytes)`
			);
		}

		console.log('---- constructor() | pos:', pos);
	}

	/**
	 * Dump RTP packet info.
	 */
	dump(): RtpPacketDump
	{
		const extensions = Array.from(this.#extensions)
			.map(([ extId, view ]) =>
			{
				return {
					id     : extId,
					length : view.byteLength
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
			padding           : this.#padding,
			byteLength        : this.getByteLength()
		};
	}

	/**
	 * Computes total length of the packet (in bytes) including padding if any.
	 *
	 * @remarks
	 * Value returned by this method may not match the byte length of the packet's
	 * DataView. This could happen if the original packet contains useless padding
	 * or alignment in the One-Byte or Two-Bytes header extensions. In any case,
	 * the value returned by this method matches the byte length of the DataView
	 * in case the packet is serialized.
	 */
	getByteLength(): number
	{
		// Position relative to the DataView byte offset.
		let pos = 0;

		pos += FIXED_HEADER_LENGTH;

		// Add space for CSRC values.
		pos += this.#csrc.length * 4;

		// Add space for the header extension.
		if (this.getHeaderExtensionBit())
		{
			// Add space for header extension id/length fields.
			pos += 4;

			// If the packet has One-Byte or Two-Bytes extensions, compute the size of
			// the extensions map. Otherwise read the header extension length in the
			// buffer.
			if (this.#extensions.size > 0 && this.hasOneByteExtensions())
			{
				for (const [ extId, extView ] of this.#extensions)
				{
					if (extId % 16 !== 0)
					{
						// Add space for extension id/length fields.
						pos += 1 + extView.byteLength;
					}
				}

				// May need to add padding.
				pos = padTo4Bytes(pos);
			}
			else if (this.#extensions.size > 0 && this.hasTwoBytesExtensions())
			{
				for (const [ extId, extView ] of this.#extensions)
				{
					if (extId % 256 !== 0)
					{
						// Add space for extension id/length fields.
						pos += 2 + extView.byteLength;
					}
				}

				// May need to add padding.
				pos = padTo4Bytes(pos);
			}
			// Otherwise read the length of the header extension value.
			else if (this.#headerExtensionView)
			{
				pos += this.#headerExtensionView.byteLength;
			}
		}

		// Add space for payload.
		pos += this.#payloadView.byteLength;

		// Add space for padding.
		pos += this.#padding;

		return pos;
	}

	/**
	 * Get the RTP version of the packet (always 2).
	 */
	getVersion(): number
	{
		return (this.packetView.getUint8(0) >> 6);
	}

	/**
	 * Get the RTP payload type.
	 */
	getPayloadType(): number
	{
		return (this.packetView.getUint8(1) & 0x7F);
	}

	/**
	 * Set the RTP payload type.
	 */
	setPayloadType(payloadType: number): void
	{
		this.packetView.setUint8(
			1, (this.packetView.getUint8(1) & 0x80) | (payloadType & 0x7F)
		);
	}

	/**
	 * Get the RTP sequence number.
	 */
	getSequenceNumber(): number
	{
		return this.packetView.getUint16(2);
	}

	/**
	 * Set the RTP sequence number.
	 */
	setSequenceNumber(sequenceNumber: number): void
	{
		this.packetView.setUint16(2, sequenceNumber);
	}

	/**
	 * Get the RTP timestamp.
	 */
	getTimestamp(): number
	{
		return this.packetView.getUint32(4);
	}

	/**
	 * Set the RTP timestamp.
	 */
	setTimestamp(timestamp: number): void
	{
		this.packetView.setUint32(4, timestamp);
	}

	/**
	 * Get the RTP SSRC.
	 */
	getSsrc(): number
	{
		return this.packetView.getUint32(8);
	}

	/**
	 * Set the RTP SSRC.
	 */
	setSsrc(ssrc: number): void
	{
		this.packetView.setUint32(8, ssrc);
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

		this.packetView.setUint8(
			0,
			(this.packetView.getUint8(0) & 0xF0) | (count & 0x0F)
		);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the RTP marker flag.
	 */
	getMarker(): boolean
	{
		return Boolean(this.packetView.getUint8(1) >> 7);
	}

	/**
	 * Set the RTP marker flag.
	 */
	setMarker(marker: boolean): void
	{
		const bit = marker ? 1 : 0;

		this.packetView.setUint8(1, this.packetView.getUint8(1) | (bit << 7));
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
		return this.#headerExtensionId !== undefined
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
		this.#headerExtensionView = undefined;

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
		this.#headerExtensionView = undefined;

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the value of the extension (RFC 5285) with given `id` (if any).
	 */
	getExtension(id: number): DataView | undefined
	{
		return this.#extensions.get(id);
	}

	/**
	 * Get an iterator with all the extensions (RFC 5285).
	 */
	getExtensions(): IterableIterator<[number, DataView]>
	{
		return this.#extensions.entries();
	}

	/**
	 * Set the value of the extension (RFC 5285) with given `id`.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 */
	setExtension(id: number, value: DataView): void
	{
		// Update header extension bit if needed.
		if (this.#extensions.size === 0)
		{
			this.setHeaderExtensionBit(true);

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
			this.setHeaderExtensionBit(false);
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
		console.log('---- RtpPacket clearExtensions()');
		if (this.#extensions.size === 0)
		{
			return;
		}

		console.log('---- RtpPacket clearExtensions() 2');

		this.#extensions.clear();

		// Update header extension bit.
		this.setHeaderExtensionBit(false);

		console.log('--- getHeaderExtensionBit():', this.getHeaderExtensionBit());

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
	 * Serialization maybe needed after calling this method.
	 */
	setPadding(padding: number): void
	{
		if (padding === this.#padding)
		{
			return;
		}

		this.#padding = padding;

		// Update padding bit.
		this.setPaddingBit(Boolean(this.#padding));

		this.setSerializationNeeded(true);
	}

	/**
	 * Pad the packet total length to 4 bytes. To achieve it, this method may add
	 * or remove bytes of padding.
	 *
	 * @remarks
	 * Serialization maybe needed after calling this method.
	 */
	padTo4Bytes(): void
	{
		const packetLength = padTo4Bytes(this.getByteLength() - this.#padding);

		if (packetLength === this.packetView.byteLength)
		{
			return;
		}

		this.setPadding(this.#padding + packetLength - this.packetView.byteLength);

		this.setSerializationNeeded(true);
	}

	/**
	 * Encode the packet using RTX procedures (as per RFC 4588).
	 *
	 * @param payloadType - The RTX payload type.
	 * @param ssrc - The RTX SSRC.
	 * @param sequenceNumber - The RTX sequence number.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
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

		this.#payloadView = payloadView;

		// Rewrite the sequence number.
		this.setSequenceNumber(sequenceNumber);

		// Remove padding.
		this.setPadding(0);

		this.setSerializationNeeded(true);
	}

	/**
	 * Decode the packet using RTX procedures (as per RFC 4588).
	 *
	 * @param payloadType - The original payload type.
	 * @param ssrc - The original SSRC.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 *
	 * @throws
	 * If payload length is less than 2 bytes, so RTX decode is not possible.
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
	serialize(): void
	{
		const packetLength = this.getByteLength();
		const { buffer, byteOffset } = this.getSerializationBuffer(packetLength);

		// Create new DataView with new buffer.
		const packetView = new DataView(buffer, byteOffset, packetLength);
		const packetUint8Array = new Uint8Array(
			packetView.buffer,
			packetView.byteOffset,
			packetView.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Copy the fixed header into the new buffer.
		packetUint8Array.set(
			new Uint8Array(
				this.packetView.buffer,
				this.packetView.byteOffset,
				FIXED_HEADER_LENGTH
			),
			0
		);

		// Move to CSRCs.
		pos += FIXED_HEADER_LENGTH;

		// NOTE: Before writing the CSRCs we must store the header extension value
		// (if any) because otherwise we are writing on top of it.
		if (this.#headerExtensionView)
		{
			this.#headerExtensionView = clone<DataView>(this.#headerExtensionView);
		}

		// Write CSRC.
		for (const ssrc of this.#csrc)
		{
			packetView.setUint32(pos, ssrc);

			pos += 4;
		}

		// Write header extension.
		if (this.getHeaderExtensionBit())
		{
			packetView.setUint16(pos, this.#headerExtensionId!);

			// Move to the header extension length field.
			pos += 2;

			const extLengthPos = pos;

			// Move to the header extension value.
			pos += 2;

			let extLength = 0;

			if (this.#extensions.size > 0 && this.hasOneByteExtensions())
			{
				for (const [ extId, extView ] of this.#extensions)
				{
					if (extId % 16 === 0)
					{
						this.#extensions.delete(extId);

						continue;
					}

					if (extView.byteLength === 0)
					{
						throw new TypeError(
							'cannot serialize extensions with length 0 in One-Byte mode'
						);
					}
					else if (extView.byteLength > 16)
					{
						throw new RangeError(
							'cannot serialize extensions with length > 16 in One-Byte mode'
						);
					}

					const idAndLength = (extId << 4) & ((extView.byteLength - 1) & 0x0F);

					packetView.setUint8(pos, idAndLength);

					pos += 1;
					extLength += 1;

					packetUint8Array.set(
						new Uint8Array(
							extView.buffer,
							extView.byteOffset,
							extView.byteLength
						),
						pos
					);

					pos += extView.byteLength;
					extLength += extView.byteLength;
				}

				// May need to add padding.
				pos = padTo4Bytes(pos);
				extLength = padTo4Bytes(extLength);

				// Write header extension length.
				packetView.setUint16(extLengthPos, extLength / 4);
			}
			else if (this.#extensions.size > 0 && this.hasTwoBytesExtensions())
			{
				for (const [ extId, extView ] of this.#extensions)
				{
					if (extId % 256 === 0)
					{
						this.#extensions.delete(extId);

						continue;
					}

					if (extView.byteLength > 255)
					{
						throw new RangeError(
							'cannot serialize extensions with length > 255 in Two-Bytes mode'
						);
					}

					packetView.setUint8(pos, extId);

					pos += 1;
					extLength += 1;

					packetView.setUint8(pos, extView.byteLength);

					pos += 1;
					extLength += 1;

					packetUint8Array.set(
						new Uint8Array(
							extView.buffer,
							extView.byteOffset,
							extView.byteLength
						),
						pos
					);

					pos += extView.byteLength;
					extLength += extView.byteLength;
				}

				// May need to add padding.
				pos = padTo4Bytes(pos);
				extLength = padTo4Bytes(extLength);

				// Write header extension length.
				packetView.setUint16(extLengthPos, extLength / 4);
			}
			// Extension header doesn't contain One-Byte or Two-Bytes extensions so
			// honor the original header extension value (if any).
			else if (this.#headerExtensionView)
			{
				extLength = this.#headerExtensionView.byteLength;

				// Write header extension value.
				packetUint8Array.set(
					new Uint8Array(
						this.#headerExtensionView.buffer,
						this.#headerExtensionView.byteOffset,
						this.#headerExtensionView.byteLength
					),
					pos
				);

				pos += this.#headerExtensionView.byteLength;

				// Write header extension length.
				packetView.setUint16(extLengthPos, extLength / 4);
			}
		}

		// Write payload.
		packetUint8Array.set(
			new Uint8Array(
				this.#payloadView.buffer,
				this.#payloadView.byteOffset,
				this.#payloadView.byteLength
			),
			pos
		);

		// Create new payload DataView.
		const payloadView = new DataView(
			packetView.buffer,
			packetView.byteOffset + pos,
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

			// NOTE: No need to fill padding bytes with zeroes since ArrayBuffer
			// constructor already fills all bytes with zero.

			packetView.setUint8(pos + this.#padding - 1, this.#padding);

			pos += this.#padding;
		}

		// Assert that current position matches new buffer length.
		if (pos > packetView.byteLength)
		{
			throw new RangeError(
				`computed packet length (${pos} bytes) is bigger than the available buffer size (${packetView.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.packetView = packetView;

		// Update payload DataView.
		this.#payloadView = payloadView;

		this.setSerializationNeeded(false);
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
	 * The buffer is serialized if needed (to apply packet pending modifications).
	 *
	 * @throws
	 * If buffer serialization is needed and it fails due to invalid fields or if
	 * `buffer` is given and it doesn't hold enough space serializing the packet.
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): RtpPacket
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

		return new RtpPacket(destPacketView);
	}

	private setVersion(): void
	{
		this.packetView.setUint8(0, RTP_VERSION << 6);
	}

	private getHeaderExtensionBit(): boolean
	{
		return Boolean((this.packetView.getUint8(0) >> 4) & 1);
	}

	private setHeaderExtensionBit(bit: boolean): void
	{
		this.packetView.setUint8(0, this.packetView.getUint8(0) | (Number(bit) << 4));
	}

	private setPaddingBit(bit: boolean): void
	{
		this.packetView.setUint8(0, this.packetView.getUint8(0) | (Number(bit) << 5));
	}
}
