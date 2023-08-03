import { RTP_VERSION, Packet, PacketDump } from './Packet';
import { readBit, setBit, clone, padTo4Bytes } from './utils';

const FIXED_HEADER_LENGTH = 12;

/**
 * RTP packet info dump.
 */
export type RtpPacketDump = PacketDump &
{
	payloadType: number;
	sequenceNumber: number;
	timestamp: number;
	ssrc: number;
	csrcs: number[];
	marker: boolean;
	headerExtensionId?: number;
	extensions: { id: number; length: number }[];
	payloadLength: number;
};

/**
 * Whether the given buffer view could be a valid RTP packet or not.
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
 * RTP packet.
 */
export class RtpPacket extends Packet
{
	// CSRCs.
	#csrcs: number[] = [];
	// Header extension id.
	#headerExtensionId?: number;
	// Buffer view holding the header extension value. Only if One-Byte or Two-Bytes
	// extensions are used.
	#headerExtensionView?: DataView;
	// One-Byte or Two-Bytes extensions indexed by id.
	readonly #extensions: Map<number, DataView> = new Map();
	// Buffer view holding the entire RTP payload.
	#payloadView: DataView;

	/**
	 * @param view - If given if will be parsed. Otherwise an empty RTP packet
	 *   (with just the minimal fixed header) will be created.
	 *
	 * @throws
	 * - If `view` is given and it does not contain a valid RTP packet.
	 */
	constructor(view?: DataView)
	{
		super();

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

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to CSRC field.
		pos += FIXED_HEADER_LENGTH;

		let csrcCount = this.getCsrcCount();

		while (csrcCount-- > 0)
		{
			const csrc = this.packetView.getUint32(pos);

			this.#csrcs.push(csrc);

			pos += 4;
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
		if (this.getPaddingBit())
		{
			// NOTE: This will throw RangeError if there is no space in the view.
			this.padding = this.packetView.getUint8(this.packetView.byteLength - 1);
		}

		// Get payload.
		const payloadLength = this.packetView.byteLength - pos - this.padding;

		if (payloadLength < 0)
		{
			throw new RangeError(
				`announced padding (${this.padding} bytes) is bigger than available space for payload (${this.packetView.byteLength - pos} bytes)`
			);
		}

		this.#payloadView = new DataView(
			this.packetView.buffer,
			this.packetView.byteOffset + pos,
			payloadLength
		);

		pos += (payloadLength + this.padding);

		// Ensure that view length and parsed length match.
		if (pos !== this.packetView.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.packetView.byteLength} bytes)`
			);
		}
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
			payloadType       : this.getPayloadType(),
			sequenceNumber    : this.getSequenceNumber(),
			timestamp         : this.getTimestamp(),
			ssrc              : this.getSsrc(),
			csrcs             : this.#csrcs,
			marker            : this.getMarker(),
			headerExtensionId : this.#headerExtensionId,
			extensions        : extensions,
			payloadLength     : this.#payloadView.byteLength,
			padding           : this.padding,
			byteLength        : this.getByteLength()
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		let packetLength = 0;

		packetLength += FIXED_HEADER_LENGTH;

		// Add space for CSRC values.
		packetLength += this.#csrcs.length * 4;

		// Add space for the header extension.
		if (this.getHeaderExtensionBit())
		{
			// Add space for header extension id/length fields.
			packetLength += 4;

			// If the packet has One-Byte or Two-Bytes extensions, compute the size of
			// the extensions map. Otherwise read the header extension length in the
			// buffer.
			if (this.#extensions.size > 0 && this.hasOneByteExtensions())
			{
				for (const [ extId, extView ] of this.#extensions)
				{
					if (extId > 0 && extId < 15)
					{
						// Add space for extension id/length fields.
						packetLength += 1 + extView.byteLength;
					}
				}

				// May need to add padding.
				packetLength = padTo4Bytes(packetLength);
			}
			else if (this.#extensions.size > 0 && this.hasTwoBytesExtensions())
			{
				for (const [ extId, extView ] of this.#extensions)
				{
					if (extId > 0 && extId < 256)
					{
						// Add space for extension id/length fields.
						packetLength += 2 + extView.byteLength;
					}
				}

				// May need to add padding.
				packetLength = padTo4Bytes(packetLength);
			}
			// Otherwise read the length of the header extension value.
			else if (this.#headerExtensionView)
			{
				packetLength += this.#headerExtensionView.byteLength;
			}
		}

		// Add space for payload.
		packetLength += this.#payloadView.byteLength;

		// Add space for padding.
		packetLength += this.padding;

		return packetLength;
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
			1,
			(this.packetView.getUint8(1) & 0x80) | (payloadType & 0x7F)
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
	getCsrcs(): number[]
	{
		return Array.from(this.#csrcs);
	}

	/**
	 * Set the RTP CSRC values. If `csrcs` is not given (or if it's an empty
	 * array) CSRC field will be removed from the RTP packet.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setCsrcs(csrcs: number[] = []): void
	{
		this.#csrcs = csrcs;

		// Update CSRC count.
		this.setCsrcCount(this.#csrcs.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the RTP marker flag.
	 */
	getMarker(): boolean
	{
		return Boolean(readBit(this.packetView.getUint8(1), 7));
	}

	/**
	 * Set the RTP marker flag.
	 */
	setMarker(bit: boolean): void
	{
		this.packetView.setUint8(
			1,
			setBit(this.packetView.getUint8(1), 7, Number(bit))
		);
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
	 * - Serialization maybe needed after calling this method.
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
	 * - Serialization maybe needed after calling this method.
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
	 * Get the value of the given extension (RFC 5285).
	 *
	 * @param id - Extension id.
	 */
	getExtension(id: number): DataView | undefined
	{
		return this.#extensions.get(id);
	}

	/**
	 * Get a map with all the extensions indexed by their extension id (RFC 5285).
	 */
	getExtensions(): Map<number, DataView>
	{
		return new Map(this.#extensions);
	}

	/**
	 * Set the value of the extension (RFC 5285).
	 *
	 * @param id - Extension id.
	 * @param value - Extension value.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setExtension(id: number, value: DataView): void
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
	 * Delete the given extension (RFC 5285).
	 *
	 * @param id - Extension id.
	 *
	 * @remarks
	 * - Serialization maybe needed after calling this method.
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
	 * - Serialization maybe needed after calling this method.
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
	 * - Serialization is needed after calling this method.
	 */
	setPayloadView(view: DataView): void
	{
		this.#payloadView = view;

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
	 * - Serialization is needed after calling this method.
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
	 * - Serialization is needed after calling this method.
	 *
	 * @throws
	 * - If payload length is less than 2 bytes, so RTX decode is not possible.
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
	 * @inheritDoc
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

		// Write CSRCs.
		for (const csrc of this.#csrcs)
		{
			packetView.setUint32(pos, csrc);

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
					if (extId <= 0 || extId >= 15)
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
					if (extId <= 0 || extId >= 256)
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
		if (this.padding > 0)
		{
			if (this.padding > 255)
			{
				throw new TypeError(
					`padding (${this.padding} bytes) cannot be higher than 255`
				);
			}

			// NOTE: No need to fill padding bytes with zeroes since ArrayBuffer
			// constructor already fills all bytes with zero.

			packetView.setUint8(pos + this.padding - 1, this.padding);

			pos += this.padding;
		}

		// Assert that current position is equal or less than new buffer length.
		// NOTE: Don't be strict matching resulting length since we may have
		// discarded/reduced some padding/alignment bytes during the process.
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
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): RtpPacket
	{
		const destPacketView = this.cloneInternal(buffer, byteOffset);

		return new RtpPacket(destPacketView);
	}

	private getHeaderExtensionBit(): number
	{
		return readBit(this.packetView.getUint8(0), 4);
	}

	private setHeaderExtensionBit(bit: number): void
	{
		this.packetView.setUint8(
			0,
			setBit(this.packetView.getUint8(0), 4, bit)
		);
	}

	private getCsrcCount(): number
	{
		return this.packetView.getUint8(0) & 0x0F;
	}

	private setCsrcCount(count: number): void
	{
		this.packetView.setUint8(
			0,
			(this.packetView.getUint8(0) & 0xF0) | (count & 0x0F)
		);
	}
}
