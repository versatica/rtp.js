import { RTP_VERSION, Packet, PacketDump } from './Packet';
import { clone, padTo4Bytes } from './utils';
import {
	readBitInDataView,
	writeBitInDataView,
	readBitsInDataView,
	writeBitsInDataView
} from './bitOps';

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
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|X|  CC   |M|     PT      |       sequence number         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                           timestamp                           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |           synchronization source (SSRC) identifier            |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |            contributing source (CSRC) identifiers             |
 * |                             ....                              |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @see
 * - [RFC 3550 section 5.1](https://datatracker.ietf.org/doc/html/rfc3550#section-5.1)
 * - [RFC 5285 section 4](https://datatracker.ietf.org/doc/html/rfc5285#section-4)
 *
 * @emits
 * - will-serialize: {@link WillSerializeEvent}
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
	 * @param view - If given it will be parsed. Otherwise an empty RTP packet
	 *   (with just the minimal fixed header) will be created.
	 *
	 * @throws
	 * - If `view` is given and it does not contain a valid RTP packet.
	 */
	constructor(view?: DataView)
	{
		super(view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Set version.
			this.setVersion();

			// Set empty payload.
			this.#payloadView = new DataView(
				this.view.buffer,
				this.view.byteOffset + FIXED_HEADER_LENGTH,
				0
			);

			return;
		}

		if (!isRtp(this.view))
		{
			throw new TypeError('not a RTP packet');
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to CSRC field.
		pos += FIXED_HEADER_LENGTH;

		let csrcCount = this.getCsrcCount();

		while (csrcCount-- > 0)
		{
			const csrc = this.view.getUint32(pos);

			this.#csrcs.push(csrc);

			pos += 4;
		}

		// Parse header extension.
		const hasHeaderExtension = this.hasHeaderExtensionBit();

		let headerExtensionView: DataView | undefined;

		if (hasHeaderExtension)
		{
			// NOTE: This will throw RangeError if there is no space in the buffer.
			this.#headerExtensionId = this.view.getUint16(pos);

			pos += 2;

			const headerExtensionLength = this.view.getUint16(pos) * 4;

			pos += 2;

			headerExtensionView = new DataView(
				this.view.buffer,
				this.view.byteOffset + pos,
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
				const extId = readBitsInDataView(
					{ view: headerExtensionView, byte: extPos, mask: 0xF0 }
				);

				const extLength = readBitsInDataView(
					{ view: headerExtensionView, byte: extPos, mask: 0x0F }
				) + 1;

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
		if (this.hasPaddingBit())
		{
			// NOTE: This will throw RangeError if there is no space in the view.
			this.padding = this.view.getUint8(this.view.byteLength - 1);
		}

		// Get payload.
		const payloadLength = this.view.byteLength - pos - this.padding;

		if (payloadLength < 0)
		{
			throw new RangeError(
				`announced padding (${this.padding} bytes) is bigger than available space for payload (${this.view.byteLength - pos} bytes)`
			);
		}

		this.#payloadView = new DataView(
			this.view.buffer,
			this.view.byteOffset + pos,
			payloadLength
		);

		pos += (payloadLength + this.padding);

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTP packet info.
	 */
	dump(): RtpPacketDump
	{
		const extensions = Array.from(this.#extensions)
			.map(([ extId, extView ]) =>
			{
				return {
					id     : extId,
					length : extView.byteLength
				};
			});

		return {
			...super.dump(),
			payloadType       : this.getPayloadType(),
			sequenceNumber    : this.getSequenceNumber(),
			timestamp         : this.getTimestamp(),
			ssrc              : this.getSsrc(),
			csrcs             : this.getCsrcs(),
			marker            : this.getMarker(),
			headerExtensionId : this.#headerExtensionId,
			extensions        : extensions,
			payloadLength     : this.#payloadView.byteLength
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		// NOTE: Here, even if serialization is not needed, we cannot bypass full
		// length computation since the original and unmodified parsed packet
		// may have useless padding octets in extensions, octets that we ignore
		// when computing packet length and when serializing the packet.

		let packetLength = 0;

		packetLength += FIXED_HEADER_LENGTH;

		// Add space for CSRC values.
		packetLength += this.#csrcs.length * 4;

		// Add space for the header extension.
		if (this.hasHeaderExtensionBit())
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
	 * @inheritDoc
	 */
	serialize(): void
	{
		const { buffer, byteOffset, byteLength } = this.getSerializationBuffer();

		// Create new DataView with new buffer.
		const view = new DataView(buffer, byteOffset, byteLength);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Copy the fixed header into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset,
				FIXED_HEADER_LENGTH
			),
			pos
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
			view.setUint32(pos, csrc);

			pos += 4;
		}

		// Write header extension.
		if (this.hasHeaderExtensionBit())
		{
			view.setUint16(pos, this.#headerExtensionId!);

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

					writeBitsInDataView(
						{ view: view, byte: pos, mask: 0xF0, value: extId }
					);
					writeBitsInDataView(
						{ view: view, byte: pos, mask: 0x0F, value: extView.byteLength - 1 }
					);

					pos += 1;
					extLength += 1;

					uint8Array.set(
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
				view.setUint16(extLengthPos, extLength / 4);
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

					view.setUint8(pos, extId);

					pos += 1;
					extLength += 1;

					view.setUint8(pos, extView.byteLength);

					pos += 1;
					extLength += 1;

					uint8Array.set(
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
				view.setUint16(extLengthPos, extLength / 4);
			}
			// Extension header doesn't contain One-Byte or Two-Bytes extensions so
			// honor the original header extension value (if any).
			else if (this.#headerExtensionView)
			{
				extLength = this.#headerExtensionView.byteLength;

				// Write header extension value.
				uint8Array.set(
					new Uint8Array(
						this.#headerExtensionView.buffer,
						this.#headerExtensionView.byteOffset,
						this.#headerExtensionView.byteLength
					),
					pos
				);

				pos += this.#headerExtensionView.byteLength;

				// Write header extension length.
				view.setUint16(extLengthPos, extLength / 4);
			}
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
			view.buffer,
			view.byteOffset + pos,
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

			view.setUint8(pos + this.padding - 1, this.padding);

			pos += this.padding;
		}

		// Assert that current position is equal or less than new buffer length.
		// NOTE: Don't be strict matching resulting length since we may have
		// discarded/reduced some padding/alignment octets in the extensions
		// during the process.
		if (pos > view.byteLength)
		{
			throw new RangeError(
				`filled length (${pos} bytes) is bigger than the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		// Update payload DataView.
		this.#payloadView = payloadView;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): RtpPacket
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new RtpPacket(view);
	}

	/**
	 * Get the RTP payload type.
	 */
	getPayloadType(): number
	{
		return readBitsInDataView({ view: this.view, byte: 1, mask: 0b01111111 });
	}

	/**
	 * Set the RTP payload type.
	 */
	setPayloadType(payloadType: number): void
	{
		writeBitsInDataView(
			{ view: this.view, byte: 1, mask: 0b01111111, value: payloadType }
		);
	}

	/**
	 * Get the RTP sequence number.
	 */
	getSequenceNumber(): number
	{
		return this.view.getUint16(2);
	}

	/**
	 * Set the RTP sequence number.
	 */
	setSequenceNumber(sequenceNumber: number): void
	{
		this.view.setUint16(2, sequenceNumber);
	}

	/**
	 * Get the RTP timestamp.
	 */
	getTimestamp(): number
	{
		return this.view.getUint32(4);
	}

	/**
	 * Set the RTP timestamp.
	 */
	setTimestamp(timestamp: number): void
	{
		this.view.setUint32(4, timestamp);
	}

	/**
	 * Get the RTP SSRC.
	 */
	getSsrc(): number
	{
		return this.view.getUint32(8);
	}

	/**
	 * Set the RTP SSRC.
	 */
	setSsrc(ssrc: number): void
	{
		this.view.setUint32(8, ssrc);
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
		this.#csrcs = Array.from(csrcs);

		// Update CSRC count.
		this.setCsrcCount(this.#csrcs.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the RTP marker flag.
	 */
	getMarker(): boolean
	{
		return readBitInDataView({ view: this.view, byte: 1, bit: 7 });
	}

	/**
	 * Set the RTP marker flag.
	 */
	setMarker(flag: boolean): void
	{
		writeBitInDataView({ view: this.view, byte: 1, bit: 7, flag });
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
	 * Get the value of the extension with given `id` (RFC 5285).
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
	 * Set the value of the extension with given `id` (RFC 5285).
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
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
	 * Delete the extension with given `id` (RFC 5285).
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
			this.setHeaderExtensionBit(false);
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
		this.setHeaderExtensionBit(false);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the packet payload.
	 */
	getPayload(): DataView
	{
		return this.#payloadView;
	}

	/**
	 * Set the packet payload.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setPayload(view: DataView): void
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
		this.setPayload(
			new DataView(this.#payloadView.buffer, this.#payloadView.byteOffset + 2)
		);

		// Remove padding.
		this.setPadding(0);

		this.setSerializationNeeded(true);
	}

	private hasHeaderExtensionBit(): boolean
	{
		return readBitInDataView({ view: this.view, byte: 0, bit: 4 });
	}

	private setHeaderExtensionBit(flag: boolean): void
	{
		writeBitInDataView({ view: this.view, byte: 0, bit: 4, flag });
	}

	private getCsrcCount(): number
	{
		return this.view.getUint8(0) & 0x0F;
	}

	private setCsrcCount(count: number): void
	{
		writeBitsInDataView(
			{ view: this.view, byte: 0, mask: 0b00001111, value: count }
		);
	}
}
