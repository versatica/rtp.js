import { Serializable, type SerializableDump } from '../Serializable';
import {
	RtpExtensionType,
	type RtpExtensionMapping,
	type SsrcAudioLevelExtension,
	type VideoOrientationExtension,
	type AbsCaptureTimeExtension,
	type PlayoutDelayExtension,
} from './rtpExtensions';
import { padTo4Bytes, isUnsignedInteger } from '../../utils/helpers';
import {
	readBitInDataView,
	writeBitInDataView,
	readBitsInDataView,
	writeBitsInDataView,
} from '../../utils/bitOps';
import {
	read3BytesInDataView,
	write3BytesInDataView,
} from '../../utils/byteOps';

// Minimum length (in bytes) of the RTP fixed header (without CSRC fields).
const FIXED_HEADER_LENGTH = 12;
// Header extension id announcing One-Byte extensions.
const ONE_BYTE_EXTENSIONS_ID = 0xbede;
// Header extension id announcing Two-Bytes extensions (the 4 lowest bits are
// "appbits" and can have any value).
const TWO_BYTES_EXTENSIONS_ID = 0b0001000000000000;
// Length (in bytes) of the original sequence number added by RTX at the
// beginning of the payload.
const RTX_OVERHEAD = 2;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * One-Byte and Two-Bytes extensions (RFC 8285).
 *
 * @category RTP
 */
export type ExtensionsType = 'one-byte' | 'two-bytes';

/**
 * RTP packet info dump.
 *
 * @category RTP
 */
export type PacketDump = SerializableDump & {
	payloadType: number;
	sequenceNumber: number;
	timestamp: number;
	ssrc: number;
	csrcs: number[];
	marker: boolean;
	headerExtensionId?: number;
	extensionsType: ExtensionsType;
	extensions: { id: number; length: number }[];
	midExt?: string;
	ridExt?: string;
	rridExt?: string;
	absSendTimeExt?: number;
	transportWideCc01Ext?: number;
	ssrcAudioLevelExt?: SsrcAudioLevelExtension;
	videoOrientationExt?: VideoOrientationExtension;
	absCaptureTimeExt?: AbsCaptureTimeExtension;
	playoutDelayExt?: PlayoutDelayExtension;
	// @todo Implement it.
	// dependencyDescriptorExt: DependencyDescriptor;
	payloadLength: number;
	padding: number;
};

/**
 * Whether the given buffer could be a valid RTP packet or not.
 *
 * @remarks
 * - RTCP packets also match, so the caller should first verify whether the
 *   given buffer is a RTCP packet.
 *
 * @param buffer - Buffer holding the packet.
 * @param packetLength - Exact length of the packet. If not given,
 *   `buffer.byteLength` is used.
 *
 * @category RTP
 */
export function isRtp(
	buffer: Uint8Array,
	packetLength: number = buffer.byteLength
): boolean {
	if (
		!isUnsignedInteger(packetLength) ||
		packetLength > buffer.byteLength ||
		packetLength < FIXED_HEADER_LENGTH
	) {
		return false;
	}

	const firstByte = buffer[0]!;

	return (
		// @see RFC 7983.
		firstByte > 127 &&
		firstByte < 192 &&
		// RTP Version must be 2.
		firstByte >> 6 === 2
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
 * |      defined by profile       |           length              |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                        header extension                       |
 * |                             ....                              |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTP
 *
 * @remarks
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized. Modifications that need more bytes throw if
 *   the buffer has no space for them, in which case the packet is not
 *   modified.
 *
 * @see
 * - [RFC 3550 section 5.1](https://datatracker.ietf.org/doc/html/rfc3550#section-5.1)
 * - [RFC 8285](https://datatracker.ietf.org/doc/html/rfc8285)
 */
export class Packet extends Serializable {
	// Type of the extensions in the packet, or type that will be used once an
	// extension is added.
	#extensionsType: ExtensionsType = 'one-byte';
	// Mapping of RTP extension types and their corresponding RTP extension ids.
	#extensionMapping: RtpExtensionMapping = {};
	// One-Byte or Two-Bytes extensions. Key is the extension id and value is the
	// offset (in bytes) from the beginning of the header extension value to the
	// beginning of the extension.
	readonly #extensions: Map<number, number> = new Map();

	/**
	 * Parse a RTP packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 * @param packetLength - Exact length of the packet. If not given,
	 *   `buffer.byteLength` is used.
	 *
	 * @throws
	 * - `TypeError` if `packetLength` is greater than `buffer.byteLength` or if
	 *   the buffer does not contain a valid RTP packet.
	 */
	static parse(
		buffer: Uint8Array,
		packetLength: number = buffer.byteLength
	): Packet {
		if (packetLength > buffer.byteLength) {
			throw new TypeError(
				`packetLength (${packetLength} bytes) cannot be greater than buffer length (${buffer.byteLength} bytes)`
			);
		}

		if (!isRtp(buffer, packetLength)) {
			throw new TypeError('not a RTP packet');
		}

		const packet = new Packet(buffer);

		packet.setLength(packetLength);
		packet.#validate();

		return packet;
	}

	/**
	 * Create a RTP packet with just the fixed header.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than the length of the
	 *   fixed header.
	 */
	static factory(buffer: Uint8Array): Packet {
		if (buffer.byteLength < FIXED_HEADER_LENGTH) {
			throw new TypeError('no space for fixed header');
		}

		const packet = new Packet(buffer);

		buffer.fill(0, 0, FIXED_HEADER_LENGTH);
		// Set version 2.
		writeBitsInDataView(packet.getView(), 0, 0b11000000, 2);

		return packet;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);

		this.setLength(FIXED_HEADER_LENGTH);
	}

	/**
	 * Dump RTP packet info.
	 */
	override dump(): PacketDump {
		return {
			...super.dump(),
			payloadType: this.getPayloadType(),
			sequenceNumber: this.getSequenceNumber(),
			timestamp: this.getTimestamp(),
			ssrc: this.getSsrc(),
			csrcs: this.getCsrcs(),
			marker: this.getMarker(),
			headerExtensionId: this.#hasHeaderExtensionBit()
				? this.getView().getUint16(this.#getHeaderExtensionOffset())
				: undefined,
			extensionsType: this.#extensionsType,
			extensions: Array.from(this.getExtensions()).map(([id, value]) => ({
				id,
				length: value.byteLength,
			})),
			midExt: this.getMidExtension(),
			ridExt: this.getRidExtension(),
			rridExt: this.getRridExtension(),
			absSendTimeExt: this.getAbsSendTimeExtension(),
			transportWideCc01Ext: this.getTransportWideCc01Extension(),
			ssrcAudioLevelExt: this.getSsrcAudioLevelExtension(),
			videoOrientationExt: this.getVideoOrientationExtension(),
			absCaptureTimeExt: this.getAbsCaptureTimeExtension(),
			playoutDelayExt: this.getPlayoutDelayExtension(),
			// @todo Implement it.
			// dependencyDescriptorExt: xxx;
			payloadLength: this.#getPayloadLength(),
			padding: this.getPadding(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): Packet {
		const clonedPacket = new Packet(buffer);

		this.cloneInto(clonedPacket);

		clonedPacket.#extensionsType = this.#extensionsType;
		clonedPacket.#extensionMapping = { ...this.#extensionMapping };

		for (const [id, offset] of this.#extensions) {
			clonedPacket.#extensions.set(id, offset);
		}

		return clonedPacket;
	}

	/**
	 * Get the RTP payload type.
	 */
	getPayloadType(): number {
		return readBitsInDataView(this.getView(), 1, 0b01111111);
	}

	/**
	 * Set the RTP payload type.
	 *
	 * @throws
	 * - `TypeError` if `payloadType` is not an integer between 0 and 127.
	 */
	setPayloadType(payloadType: number): void {
		if (!isUnsignedInteger(payloadType, 127)) {
			throw new TypeError(
				`payloadType (${payloadType}) must be an integer between 0 and 127`
			);
		}

		writeBitsInDataView(this.getView(), 1, 0b01111111, payloadType);
	}

	/**
	 * Get the RTP sequence number.
	 */
	getSequenceNumber(): number {
		return this.getView().getUint16(2);
	}

	/**
	 * Set the RTP sequence number.
	 *
	 * @throws
	 * - `TypeError` if `sequenceNumber` is not an integer between 0 and 65535.
	 */
	setSequenceNumber(sequenceNumber: number): void {
		if (!isUnsignedInteger(sequenceNumber, 0xffff)) {
			throw new TypeError(
				`sequenceNumber (${sequenceNumber}) must be an integer between 0 and 65535`
			);
		}

		this.getView().setUint16(2, sequenceNumber);
	}

	/**
	 * Get the RTP timestamp.
	 */
	getTimestamp(): number {
		return this.getView().getUint32(4);
	}

	/**
	 * Set the RTP timestamp.
	 *
	 * @throws
	 * - `TypeError` if `timestamp` is not an integer between 0 and 4294967295.
	 */
	setTimestamp(timestamp: number): void {
		if (!isUnsignedInteger(timestamp, 0xffffffff)) {
			throw new TypeError(
				`timestamp (${timestamp}) must be an integer between 0 and 4294967295`
			);
		}

		this.getView().setUint32(4, timestamp);
	}

	/**
	 * Get the RTP SSRC.
	 */
	getSsrc(): number {
		return this.getView().getUint32(8);
	}

	/**
	 * Set the RTP SSRC.
	 *
	 * @throws
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295.
	 */
	setSsrc(ssrc: number): void {
		if (!isUnsignedInteger(ssrc, 0xffffffff)) {
			throw new TypeError(
				`ssrc (${ssrc}) must be an integer between 0 and 4294967295`
			);
		}

		this.getView().setUint32(8, ssrc);
	}

	/**
	 * Get the RTP marker flag.
	 */
	getMarker(): boolean {
		return readBitInDataView(this.getView(), 1, 7);
	}

	/**
	 * Set the RTP marker flag.
	 */
	setMarker(flag: boolean): void {
		writeBitInDataView(this.getView(), 1, 7, flag);
	}

	/**
	 * Get the RTP CSRC values.
	 */
	getCsrcs(): number[] {
		const view = this.getView();
		const csrcs: number[] = [];

		for (let idx = 0; idx < this.#getCsrcCount(); ++idx) {
			csrcs.push(view.getUint32(FIXED_HEADER_LENGTH + idx * 4));
		}

		return csrcs;
	}

	/**
	 * Set the RTP CSRC values. If `csrcs` is not given (or if it's an empty
	 * array) CSRC field will be removed from the RTP packet.
	 *
	 * @throws
	 * - `TypeError` if more than 15 CSRC values are given.
	 * - `TypeError` if some CSRC value is not an integer between 0 and
	 *   4294967295.
	 * - `TypeError` if the buffer has no space for the given CSRC values.
	 */
	setCsrcs(csrcs: number[] = []): void {
		if (csrcs.length > 15) {
			throw new TypeError(
				`cannot set more than 15 CSRC values (${csrcs.length} given)`
			);
		}

		for (const csrc of csrcs) {
			if (!isUnsignedInteger(csrc, 0xffffffff)) {
				throw new TypeError(
					`CSRC (${csrc}) must be an integer between 0 and 4294967295`
				);
			}
		}

		const previousCsrcCount = this.#getCsrcCount();

		this.#moveTail(
			FIXED_HEADER_LENGTH + previousCsrcCount * 4,
			(csrcs.length - previousCsrcCount) * 4
		);

		const view = this.getView();

		for (const [idx, csrc] of csrcs.entries()) {
			view.setUint32(FIXED_HEADER_LENGTH + idx * 4, csrc);
		}

		writeBitsInDataView(view, 0, 0b00001111, csrcs.length);
	}

	/**
	 * Get the padding (in bytes) at the end of the packet.
	 */
	getPadding(): number {
		if (!this.#hasPaddingBit()) {
			return 0;
		}

		return this.getView().getUint8(this.getLength() - 1);
	}

	/**
	 * Set the padding (in bytes) at the end of the packet. Padding bytes are
	 * filled with zeros except the last one, which holds the padding length.
	 *
	 * @remarks
	 * - If the given padding is equal to the current one, nothing is done.
	 *
	 * @throws
	 * - `TypeError` if `padding` is not an integer between 0 and 255.
	 * - `TypeError` if the buffer has no space for the given padding.
	 */
	setPadding(padding: number): void {
		if (!Number.isInteger(padding) || padding < 0 || padding > 255) {
			throw new TypeError(
				`padding (${padding}) must be an integer between 0 and 255`
			);
		}

		const previousPadding = this.getPadding();

		if (padding === previousPadding) {
			return;
		}

		this.setLength(this.getLength() - previousPadding + padding);

		this.#writePadding(padding);
	}

	/**
	 * Pad the packet total length to 4 bytes by modifying padding bytes. It
	 * removes existing padding and adds up to 3 bytes of padding if needed.
	 *
	 * @throws
	 * - `TypeError` if the buffer has no space for the needed padding.
	 */
	padTo4Bytes(): void {
		const previousLength = this.getLength();
		const notPaddedLength = previousLength - this.getPadding();
		const paddedLength = padTo4Bytes(notPaddedLength);

		if (paddedLength === previousLength) {
			return;
		}

		this.setLength(paddedLength);

		this.#writePadding(paddedLength - notPaddedLength);
	}

	/**
	 * Get the type of the extensions in the packet, or the type that will be
	 * used once an extension is added. Default is `'one-byte'`.
	 */
	getExtensionsType(): ExtensionsType {
		return this.#extensionsType;
	}

	/**
	 * Set the type of the extensions. If the packet has extensions, they are
	 * rewritten with the given type.
	 *
	 * @throws
	 * - `TypeError` if some existing extension cannot be represented with the
	 *   given type (for example, an extension with id greater than 14 or with
	 *   length greater than 16 bytes in One-Byte extensions).
	 * - `TypeError` if the buffer has no space for the rewritten extensions.
	 */
	setExtensionsType(type: ExtensionsType): void {
		if (type === this.#extensionsType) {
			return;
		}

		if (this.#extensions.size > 0) {
			this.#writeExtensions(this.#collectExtensions(), type);
		}
		// A One-Byte or Two-Bytes header extension without extensions must also
		// announce the new type. Its value is filled with zeros (padding) since
		// it may contain bytes that are ignored with the current type (those
		// after an id 15 in One-Byte extensions or a trailing byte in Two-Bytes
		// extensions) but not with the new one.
		else if (this.#hasHeaderExtensionBit()) {
			const view = this.getView();
			const headerExtensionOffset = this.#getHeaderExtensionOffset();
			const headerExtensionId = view.getUint16(headerExtensionOffset);

			if (
				headerExtensionId === ONE_BYTE_EXTENSIONS_ID ||
				(headerExtensionId & 0b1111111111110000) === TWO_BYTES_EXTENSIONS_ID
			) {
				switch (type) {
					case 'one-byte': {
						view.setUint16(headerExtensionOffset, ONE_BYTE_EXTENSIONS_ID);

						break;
					}

					case 'two-bytes': {
						view.setUint16(headerExtensionOffset, TWO_BYTES_EXTENSIONS_ID);

						break;
					}
				}

				this.getBuffer().fill(
					0,
					headerExtensionOffset + 4,
					headerExtensionOffset + this.#getHeaderExtensionLength()
				);
			}
		}

		this.#extensionsType = type;
	}

	/**
	 * Get a map with all the extensions indexed by their extension id.
	 *
	 * @remarks
	 * - Each value is a view over the buffer of the packet (no bytes are
	 *   copied).
	 */
	getExtensions(): Map<number, Uint8Array> {
		return new Map(this.#collectExtensions());
	}

	/**
	 * Get the value of the extension with given id.
	 *
	 * @remarks
	 * - The returned value is a view over the buffer of the packet (no bytes
	 *   are copied).
	 */
	getExtension(id: number): Uint8Array | undefined {
		const extension = this.#findExtension(id);

		if (!extension) {
			return undefined;
		}

		return this.getBuffer().subarray(
			extension.pos,
			extension.pos + extension.length
		);
	}

	/**
	 * Set the value of the extension with given id. The given value is copied
	 * into the packet.
	 *
	 * @remarks
	 * - If the packet has a header extension that doesn't contain One-Byte or
	 *   Two-Bytes extensions, it's replaced.
	 *
	 * @throws
	 * - `TypeError` if the given id or value length cannot be represented with
	 *   the current extensions type.
	 * - `TypeError` if the buffer has no space for the extension.
	 */
	setExtension(id: number, value: Uint8Array): void {
		this.#assertExtension(id, value.byteLength, this.#extensionsType);

		const extension = this.#findExtension(id);

		// Same length, so just overwrite the value.
		if (extension?.length === value.byteLength) {
			this.getBuffer().set(value, extension.pos);

			return;
		}

		const extensions = this.#collectExtensions().filter(
			([extId]) => extId !== id
		);

		extensions.push([id, value]);

		this.#writeExtensions(extensions, this.#extensionsType);
	}

	/**
	 * Delete the extension with given id.
	 */
	deleteExtension(id: number): void {
		if (!this.#extensions.has(id)) {
			return;
		}

		this.#writeExtensions(
			this.#collectExtensions().filter(([extId]) => extId !== id),
			this.#extensionsType
		);
	}

	/**
	 * Delete all extensions.
	 */
	clearExtensions(): void {
		if (this.#extensions.size === 0) {
			return;
		}

		this.#writeExtensions([], this.#extensionsType);
	}

	/**
	 * Get RTP extension mapping (association of RTP extension types and their
	 * numeric ids in this RTP packet).
	 */
	getExtensionMapping(): RtpExtensionMapping {
		return { ...this.#extensionMapping };
	}

	/**
	 * Set RTP extension mapping (association of RTP extension types and their
	 * numeric ids in this RTP packet).
	 *
	 * @remarks
	 * - Calling this method is needed before using methods that read or write
	 *   specific RTP extensions.
	 */
	setExtensionMapping(extensionMapping: RtpExtensionMapping): void {
		this.#extensionMapping = { ...extensionMapping };
	}

	/**
	 * Read the value of the {@link RtpExtensionType.MID} RTP extension.
	 */
	getMidExtension(): string | undefined {
		return this.#readStringExtension(RtpExtensionType.MID);
	}

	/**
	 * Set the value of the {@link RtpExtensionType.MID} RTP extension. If not
	 * given (or if it's an empty string), the extension is deleted.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 * - Same as {@link setExtension}.
	 */
	setMidExtension(mid?: string): void {
		this.#writeMappedExtension(
			RtpExtensionType.MID,
			mid ? textEncoder.encode(mid) : undefined
		);
	}

	/**
	 * Read the value of the {@link RtpExtensionType.RTP_STREAM_ID} RTP
	 * extension.
	 */
	getRidExtension(): string | undefined {
		return this.#readStringExtension(RtpExtensionType.RTP_STREAM_ID);
	}

	/**
	 * Set the value of the {@link RtpExtensionType.RTP_STREAM_ID} RTP
	 * extension. If not given (or if it's an empty string), the extension is
	 * deleted.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 * - Same as {@link setExtension}.
	 */
	setRidExtension(rid?: string): void {
		this.#writeMappedExtension(
			RtpExtensionType.RTP_STREAM_ID,
			rid ? textEncoder.encode(rid) : undefined
		);
	}

	/**
	 * Read the value of the {@link RtpExtensionType.REPAIRED_RTP_STREAM_ID} RTP
	 * extension.
	 */
	getRridExtension(): string | undefined {
		return this.#readStringExtension(RtpExtensionType.REPAIRED_RTP_STREAM_ID);
	}

	/**
	 * Set the value of the {@link RtpExtensionType.REPAIRED_RTP_STREAM_ID} RTP
	 * extension. If not given (or if it's an empty string), the extension is
	 * deleted.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 * - Same as {@link setExtension}.
	 */
	setRridExtension(rrid?: string): void {
		this.#writeMappedExtension(
			RtpExtensionType.REPAIRED_RTP_STREAM_ID,
			rrid ? textEncoder.encode(rrid) : undefined
		);
	}

	/**
	 * Read the value of the {@link RtpExtensionType.ABS_SEND_TIME} RTP
	 * extension, which is the raw 3 bytes unsigned integer stored in it.
	 */
	getAbsSendTimeExtension(): number | undefined {
		const extension = this.#findMappedExtension(RtpExtensionType.ABS_SEND_TIME);

		if (extension?.length !== 3) {
			return undefined;
		}

		return read3BytesInDataView({ view: this.getView(), pos: extension.pos });
	}

	/**
	 * Set the value of the {@link RtpExtensionType.ABS_SEND_TIME} RTP
	 * extension, which is the raw 3 bytes unsigned integer stored in it. If not
	 * given, the extension is deleted.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 * - `TypeError` if `absSendTime` is not an integer between 0 and 16777215.
	 * - Same as {@link setExtension}.
	 */
	setAbsSendTimeExtension(absSendTime?: number): void {
		let value: Uint8Array | undefined;

		if (absSendTime !== undefined) {
			if (!isUnsignedInteger(absSendTime, 0xffffff)) {
				throw new TypeError(
					`absSendTime (${absSendTime}) must be an integer between 0 and 16777215`
				);
			}

			value = new Uint8Array(3);

			write3BytesInDataView({
				view: new DataView(value.buffer),
				pos: 0,
				value: absSendTime,
			});
		}

		this.#writeMappedExtension(RtpExtensionType.ABS_SEND_TIME, value);
	}

	/**
	 * Read the value of the {@link RtpExtensionType.TRANSPORT_WIDE_CC_01} RTP
	 * extension.
	 */
	getTransportWideCc01Extension(): number | undefined {
		const extension = this.#findMappedExtension(
			RtpExtensionType.TRANSPORT_WIDE_CC_01
		);

		if (extension?.length !== 2) {
			return undefined;
		}

		return this.getView().getUint16(extension.pos);
	}

	/**
	 * Set the value of the {@link RtpExtensionType.TRANSPORT_WIDE_CC_01} RTP
	 * extension. If not given, the extension is deleted.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 * - `TypeError` if `sequenceNumber` is not an integer between 0 and 65535.
	 * - Same as {@link setExtension}.
	 */
	setTransportWideCc01Extension(sequenceNumber?: number): void {
		let value: Uint8Array | undefined;

		if (sequenceNumber !== undefined) {
			if (!isUnsignedInteger(sequenceNumber, 0xffff)) {
				throw new TypeError(
					`sequenceNumber (${sequenceNumber}) must be an integer between 0 and 65535`
				);
			}

			value = new Uint8Array(2);

			new DataView(value.buffer).setUint16(0, sequenceNumber);
		}

		this.#writeMappedExtension(RtpExtensionType.TRANSPORT_WIDE_CC_01, value);
	}

	/**
	 * Read the value of the {@link RtpExtensionType.SSRC_AUDIO_LEVEL} RTP
	 * extension.
	 */
	getSsrcAudioLevelExtension(): SsrcAudioLevelExtension | undefined {
		const extension = this.#findMappedExtension(
			RtpExtensionType.SSRC_AUDIO_LEVEL
		);

		if (extension?.length !== 1) {
			return undefined;
		}

		const view = this.getView();

		return {
			volume: readBitsInDataView(view, extension.pos, 0b01111111),
			voice: readBitInDataView(view, extension.pos, 7),
		};
	}

	/**
	 * Set the value of the {@link RtpExtensionType.SSRC_AUDIO_LEVEL} RTP
	 * extension. If not given, the extension is deleted.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 * - `TypeError` if `volume` is not an integer between 0 and 127.
	 * - Same as {@link setExtension}.
	 */
	setSsrcAudioLevelExtension(ssrcAudioLevel?: SsrcAudioLevelExtension): void {
		let value: Uint8Array | undefined;

		if (ssrcAudioLevel) {
			if (!isUnsignedInteger(ssrcAudioLevel.volume, 127)) {
				throw new TypeError(
					`volume (${ssrcAudioLevel.volume}) must be an integer between 0 and 127`
				);
			}

			value = new Uint8Array(1);

			const view = new DataView(value.buffer);

			writeBitInDataView(view, 0, 7, ssrcAudioLevel.voice);
			writeBitsInDataView(view, 0, 0b01111111, ssrcAudioLevel.volume);
		}

		this.#writeMappedExtension(RtpExtensionType.SSRC_AUDIO_LEVEL, value);
	}

	/**
	 * Read the value of the {@link RtpExtensionType.VIDEO_ORIENTATION} RTP
	 * extension.
	 */
	getVideoOrientationExtension(): VideoOrientationExtension | undefined {
		const extension = this.#findMappedExtension(
			RtpExtensionType.VIDEO_ORIENTATION
		);

		if (extension?.length !== 1) {
			return undefined;
		}

		const view = this.getView();

		return {
			camera: readBitInDataView(view, extension.pos, 3),
			flip: readBitInDataView(view, extension.pos, 2),
			rotation: (readBitsInDataView(view, extension.pos, 0b00000011) * 90) as
				0 | 90 | 180 | 270,
		};
	}

	/**
	 * Set the value of the {@link RtpExtensionType.VIDEO_ORIENTATION} RTP
	 * extension. If not given, the extension is deleted.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 * - `TypeError` if `rotation` is not 0, 90, 180 or 270.
	 * - Same as {@link setExtension}.
	 */
	setVideoOrientationExtension(
		videoOrientation?: VideoOrientationExtension
	): void {
		let value: Uint8Array | undefined;

		if (videoOrientation) {
			const { camera, flip, rotation } = videoOrientation;

			if (![0, 90, 180, 270].includes(rotation)) {
				throw new TypeError(`rotation (${rotation}) must be 0, 90, 180 or 270`);
			}

			value = new Uint8Array(1);

			const view = new DataView(value.buffer);

			writeBitInDataView(view, 0, 3, camera);
			writeBitInDataView(view, 0, 2, flip);
			writeBitsInDataView(view, 0, 0b00000011, rotation / 90);
		}

		this.#writeMappedExtension(RtpExtensionType.VIDEO_ORIENTATION, value);
	}

	/**
	 * Read the value of the {@link RtpExtensionType.ABS_CAPTURE_TIME} RTP
	 * extension.
	 */
	getAbsCaptureTimeExtension(): AbsCaptureTimeExtension | undefined {
		const extension = this.#findMappedExtension(
			RtpExtensionType.ABS_CAPTURE_TIME
		);

		// Extension value can be 8 or 16 bytes depending on whether it contains
		// estimated capture clock offset or not.
		if (extension?.length !== 8 && extension?.length !== 16) {
			return undefined;
		}

		const view = this.getView();
		const { pos } = extension;

		return {
			absCaptureTimestamp: {
				seconds: view.getUint32(pos),
				fractions: view.getUint32(pos + 4),
			},
			estimatedCaptureClockOffset:
				extension.length === 16
					? {
							seconds: view.getInt32(pos + 8),
							fractions: view.getUint32(pos + 12),
						}
					: undefined,
		};
	}

	/**
	 * Set the value of the {@link RtpExtensionType.ABS_CAPTURE_TIME} RTP
	 * extension. If not given, the extension is deleted.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 * - `TypeError` if some `seconds` or `fractions` value is out of range
	 *   (`seconds` of `estimatedCaptureClockOffset` is a signed 32 bits integer
	 *   and the others are unsigned 32 bits integers).
	 * - Same as {@link setExtension}.
	 */
	setAbsCaptureTimeExtension(absCaptureTime?: AbsCaptureTimeExtension): void {
		let value: Uint8Array | undefined;

		if (absCaptureTime) {
			const { absCaptureTimestamp, estimatedCaptureClockOffset } =
				absCaptureTime;

			if (
				!isUnsignedInteger(absCaptureTimestamp.seconds, 0xffffffff) ||
				!isUnsignedInteger(absCaptureTimestamp.fractions, 0xffffffff)
			) {
				throw new TypeError(
					'absCaptureTimestamp seconds and fractions must be integers between 0 and 4294967295'
				);
			}

			if (
				estimatedCaptureClockOffset &&
				(!Number.isInteger(estimatedCaptureClockOffset.seconds) ||
					estimatedCaptureClockOffset.seconds < -0x80000000 ||
					estimatedCaptureClockOffset.seconds > 0x7fffffff ||
					!isUnsignedInteger(estimatedCaptureClockOffset.fractions, 0xffffffff))
			) {
				throw new TypeError(
					'estimatedCaptureClockOffset seconds must be an integer between -2147483648 and 2147483647 and fractions an integer between 0 and 4294967295'
				);
			}

			value = new Uint8Array(estimatedCaptureClockOffset ? 16 : 8);

			const view = new DataView(value.buffer);

			view.setUint32(0, absCaptureTimestamp.seconds);
			view.setUint32(4, absCaptureTimestamp.fractions);

			if (estimatedCaptureClockOffset) {
				view.setInt32(8, estimatedCaptureClockOffset.seconds);
				view.setUint32(12, estimatedCaptureClockOffset.fractions);
			}
		}

		this.#writeMappedExtension(RtpExtensionType.ABS_CAPTURE_TIME, value);
	}

	/**
	 * Read the value of the {@link RtpExtensionType.PLAYOUT_DELAY} RTP
	 * extension.
	 */
	getPlayoutDelayExtension(): PlayoutDelayExtension | undefined {
		const extension = this.#findMappedExtension(RtpExtensionType.PLAYOUT_DELAY);

		if (extension?.length !== 3) {
			return undefined;
		}

		const value = read3BytesInDataView({
			view: this.getView(),
			pos: extension.pos,
		});

		return {
			minDelay: value >> 12,
			maxDelay: value & 0xfff,
		};
	}

	/**
	 * Set the value of the {@link RtpExtensionType.PLAYOUT_DELAY} RTP
	 * extension. If not given, the extension is deleted.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 * - `TypeError` if `minDelay` or `maxDelay` is not an integer between 0 and
	 *   4095.
	 * - Same as {@link setExtension}.
	 */
	setPlayoutDelayExtension(playoutDelay?: PlayoutDelayExtension): void {
		let value: Uint8Array | undefined;

		if (playoutDelay) {
			const { minDelay, maxDelay } = playoutDelay;

			for (const delay of [minDelay, maxDelay]) {
				if (!isUnsignedInteger(delay, 0xfff)) {
					throw new TypeError(
						`delay (${delay}) must be an integer between 0 and 4095`
					);
				}
			}

			value = new Uint8Array(3);

			write3BytesInDataView({
				view: new DataView(value.buffer),
				pos: 0,
				value: (minDelay << 12) | maxDelay,
			});
		}

		this.#writeMappedExtension(RtpExtensionType.PLAYOUT_DELAY, value);
	}

	/**
	 * Read the value of the {@link RtpExtensionType.DEPENDENCY_DESCRIPTOR} RTP
	 * extension.
	 *
	 * @todo Implement it.
	 */
	// getDependencyDescriptorExtension() {}

	/**
	 * Set the value of the {@link RtpExtensionType.DEPENDENCY_DESCRIPTOR} RTP
	 * extension.
	 *
	 * @todo Implement it.
	 */
	// setDependencyDescriptorExtension() {}

	/**
	 * Get the packet payload (excluding padding).
	 *
	 * @remarks
	 * - The returned value is a view over the buffer of the packet (no bytes
	 *   are copied).
	 */
	getPayload(): Uint8Array {
		const payloadOffset = this.#getPayloadOffset();

		return this.getBuffer().subarray(
			payloadOffset,
			payloadOffset + this.#getPayloadLength()
		);
	}

	/**
	 * Set the packet payload. The given payload is copied into the packet.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 * - Given `payload` can be a view over the buffer of the packet.
	 *
	 * @throws
	 * - `TypeError` if the buffer has no space for the given payload.
	 */
	setPayload(payload: Uint8Array): void {
		const payloadOffset = this.#getPayloadOffset();

		this.setLength(payloadOffset + payload.byteLength);

		this.#setPaddingBit(false);

		this.getBuffer().set(payload, payloadOffset);
	}

	/**
	 * Remove the packet payload.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 */
	removePayload(): void {
		this.setLength(this.#getPayloadOffset());

		this.#setPaddingBit(false);
	}

	/**
	 * Shift the content of the payload `delta` bytes after `payloadOffset`. A
	 * positive `delta` inserts `delta` bytes at `payloadOffset` (whose content
	 * is not defined) and a negative `delta` removes `-delta` bytes at
	 * `payloadOffset`.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if `payloadOffset` is not an unsigned integer or `delta` is
	 *   not an integer.
	 * - `TypeError` if `payloadOffset` is not lower than the payload length.
	 * - `TypeError` if negative `delta` is greater than the payload length after
	 *   `payloadOffset`.
	 * - `TypeError` if the buffer has no space for the shifted payload.
	 */
	shiftPayload(payloadOffset: number, delta: number): void {
		if (!isUnsignedInteger(payloadOffset)) {
			throw new TypeError(
				`payloadOffset (${payloadOffset}) must be an unsigned integer`
			);
		} else if (!Number.isInteger(delta)) {
			throw new TypeError(`delta (${delta}) must be an integer`);
		}

		if (delta === 0) {
			return;
		}

		const payloadLength = this.#getPayloadLength();

		if (payloadOffset >= payloadLength) {
			throw new TypeError(
				`payloadOffset (${payloadOffset}) is not lower than payload length (${payloadLength})`
			);
		} else if (delta < 0 && -delta > payloadLength - payloadOffset) {
			throw new TypeError(`negative delta (${delta}) too big`);
		}

		this.#assertAvailableLength(this.getLength() - this.getPadding() + delta);

		// Remove padding (if any).
		this.setPadding(0);

		const pos = this.#getPayloadOffset() + payloadOffset;

		if (delta > 0) {
			this.#moveTail(pos, delta);
		} else {
			this.#moveTail(pos - delta, delta);
		}
	}

	/**
	 * Encode the packet using RTX procedures (as per RFC 4588).
	 *
	 * @param payloadType - The RTX payload type.
	 * @param ssrc - The RTX SSRC.
	 * @param sequenceNumber - The RTX sequence number.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if `payloadType`, `ssrc` or `sequenceNumber` are out of
	 *   range (see {@link setPayloadType}, {@link setSsrc} and
	 *   {@link setSequenceNumber}), in which case the packet is not modified.
	 * - `TypeError` if the buffer has no space for the original sequence number
	 *   in the payload.
	 */
	rtxEncode(payloadType: number, ssrc: number, sequenceNumber: number): void {
		if (
			!isUnsignedInteger(payloadType, 127) ||
			!isUnsignedInteger(ssrc, 0xffffffff) ||
			!isUnsignedInteger(sequenceNumber, 0xffff)
		) {
			throw new TypeError(
				`invalid payloadType (${payloadType}), ssrc (${ssrc}) or sequenceNumber (${sequenceNumber})`
			);
		}

		this.#assertAvailableLength(
			this.getLength() - this.getPadding() + RTX_OVERHEAD
		);

		// Remove padding (if any).
		this.setPadding(0);

		const payloadOffset = this.#getPayloadOffset();

		this.#moveTail(payloadOffset, RTX_OVERHEAD);

		// Write the original sequence number at the beginning of the payload.
		this.getView().setUint16(payloadOffset, this.getSequenceNumber());

		this.setPayloadType(payloadType);
		this.setSsrc(ssrc);
		this.setSequenceNumber(sequenceNumber);
	}

	/**
	 * Decode the packet using RTX procedures (as per RFC 4588).
	 *
	 * @param payloadType - The original payload type.
	 * @param ssrc - The original SSRC.
	 *
	 * @returns `false` if the payload is too short to contain the original
	 *   sequence number, in which case the packet is not modified.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if `payloadType` or `ssrc` are out of range (see
	 *   {@link setPayloadType} and {@link setSsrc}), in which case the packet is
	 *   not modified.
	 */
	rtxDecode(payloadType: number, ssrc: number): boolean {
		if (
			!isUnsignedInteger(payloadType, 127) ||
			!isUnsignedInteger(ssrc, 0xffffffff)
		) {
			throw new TypeError(
				`invalid payloadType (${payloadType}) or ssrc (${ssrc})`
			);
		}

		// NOTE: libwebrtc sends some RTX packets with no payload when the stream
		// is started. Just ignore them.
		if (this.#getPayloadLength() < RTX_OVERHEAD) {
			return false;
		}

		const payloadOffset = this.#getPayloadOffset();

		this.setPayloadType(payloadType);
		this.setSequenceNumber(this.getView().getUint16(payloadOffset));
		this.setSsrc(ssrc);

		// Remove padding (if any).
		this.setPadding(0);

		this.#moveTail(payloadOffset + RTX_OVERHEAD, -RTX_OVERHEAD);

		return true;
	}

	#validate(): void {
		const view = this.getView();
		const length = this.getLength();

		let pos = FIXED_HEADER_LENGTH + this.#getCsrcCount() * 4;

		if (length < pos) {
			throw new TypeError('not enough space for the announced CSRC list');
		}

		if (this.#hasHeaderExtensionBit()) {
			if (length < pos + 4) {
				throw new TypeError(
					'not enough space for the announced header extension'
				);
			}

			const headerExtensionId = view.getUint16(pos);
			const headerExtensionValueLength = view.getUint16(pos + 2) * 4;

			pos += 4;

			if (length < pos + headerExtensionValueLength) {
				throw new TypeError(
					'not enough space for the announced header extension value'
				);
			}

			if (headerExtensionId === ONE_BYTE_EXTENSIONS_ID) {
				this.#extensionsType = 'one-byte';
				this.#parseOneByteExtensions(pos, headerExtensionValueLength);
			} else if (
				(headerExtensionId & 0b1111111111110000) ===
				TWO_BYTES_EXTENSIONS_ID
			) {
				this.#extensionsType = 'two-bytes';
				this.#parseTwoBytesExtensions(pos, headerExtensionValueLength);
			}

			pos += headerExtensionValueLength;
		}

		if (this.#hasPaddingBit()) {
			const padding = view.getUint8(length - 1);

			if (padding === 0) {
				throw new TypeError('padding byte cannot be 0');
			} else if (padding > length - pos) {
				throw new TypeError(
					`announced padding (${padding} bytes) is bigger than available space for payload and padding (${length - pos} bytes)`
				);
			}
		}
	}

	#parseOneByteExtensions(valuePos: number, valueLength: number): void {
		const view = this.getView();
		const end = valuePos + valueLength;

		let pos = valuePos;

		// One-Byte extensions cannot have length 0.
		while (pos < end) {
			const id = readBitsInDataView(view, pos, 0xf0);
			// NOTE: In One-Byte extensions, announced value must be incremented
			// by 1.
			const len = readBitsInDataView(view, pos, 0x0f) + 1;

			// id=0 means alignment.
			if (id === 0) {
				++pos;
			}
			// id=15 in One-Byte extensions means "stop parsing here".
			else if (id === 15) {
				break;
			}
			// Valid extension id.
			else {
				if (pos + 1 + len > end) {
					throw new TypeError(
						`not enough space for the announced value of the One-Byte extension with id ${id}`
					);
				}

				this.#extensions.set(id, pos - valuePos);

				pos += 1 + len;
			}

			// Counting padding bytes.
			while (pos < end && view.getUint8(pos) === 0) {
				++pos;
			}
		}
	}

	#parseTwoBytesExtensions(valuePos: number, valueLength: number): void {
		const view = this.getView();
		const end = valuePos + valueLength;

		let pos = valuePos;

		// Two-Bytes extensions can have length 0.
		while (pos + 1 < end) {
			const id = view.getUint8(pos);
			const len = view.getUint8(pos + 1);

			// id=0 means alignment.
			if (id === 0) {
				++pos;
			}
			// Valid extension id.
			else {
				if (pos + 2 + len > end) {
					throw new TypeError(
						`not enough space for the announced value of the Two-Bytes extension with id ${id}`
					);
				}

				this.#extensions.set(id, pos - valuePos);

				pos += 2 + len;
			}

			// Counting padding bytes.
			while (pos < end && view.getUint8(pos) === 0) {
				++pos;
			}
		}
	}

	#getCsrcCount(): number {
		return readBitsInDataView(this.getView(), 0, 0b00001111);
	}

	#hasHeaderExtensionBit(): boolean {
		return readBitInDataView(this.getView(), 0, 4);
	}

	#setHeaderExtensionBit(flag: boolean): void {
		writeBitInDataView(this.getView(), 0, 4, flag);
	}

	#hasPaddingBit(): boolean {
		return readBitInDataView(this.getView(), 0, 5);
	}

	#setPaddingBit(flag: boolean): void {
		writeBitInDataView(this.getView(), 0, 5, flag);
	}

	/**
	 * Position where the header extension (if any) begins.
	 */
	#getHeaderExtensionOffset(): number {
		return FIXED_HEADER_LENGTH + this.#getCsrcCount() * 4;
	}

	/**
	 * Length of the header extension including the id & length four-octet, or
	 * 0 if there is no header extension.
	 */
	#getHeaderExtensionLength(): number {
		if (!this.#hasHeaderExtensionBit()) {
			return 0;
		}

		return (
			4 + this.getView().getUint16(this.#getHeaderExtensionOffset() + 2) * 4
		);
	}

	/**
	 * Position where the payload (if any) begins.
	 */
	#getPayloadOffset(): number {
		return this.#getHeaderExtensionOffset() + this.#getHeaderExtensionLength();
	}

	#getPayloadLength(): number {
		return this.getLength() - this.#getPayloadOffset() - this.getPadding();
	}

	/**
	 * Write padding bit and padding bytes assuming that the length of the packet
	 * already includes the given padding.
	 */
	#writePadding(padding: number): void {
		if (padding === 0) {
			this.#setPaddingBit(false);

			return;
		}

		this.#setPaddingBit(true);
		this.fillPadding(padding);
		this.getView().setUint8(this.getLength() - 1, padding);
	}

	/**
	 * @throws
	 * - `TypeError` if the given length is greater than the buffer length.
	 */
	#assertAvailableLength(length: number): void {
		if (length > this.getBufferLength()) {
			throw new TypeError(
				`length (${length} bytes) is larger than buffer length (${this.getBufferLength()} bytes)`
			);
		}
	}

	/**
	 * Move the bytes from `pos` to the end of the packet `delta` bytes and
	 * update the length of the packet.
	 *
	 * @throws
	 * - `TypeError` if the buffer has no space for it, in which case nothing
	 *   changes.
	 */
	#moveTail(pos: number, delta: number): void {
		if (delta === 0) {
			return;
		}

		const length = this.getLength();

		if (delta > 0) {
			// NOTE: This throws if there is no space in the buffer.
			this.setLength(length + delta);
			this.getBuffer().copyWithin(pos + delta, pos, length);
		} else {
			this.getBuffer().copyWithin(pos + delta, pos, length);
			this.setLength(length + delta);
		}
	}

	/**
	 * Position and length of the value of the extension with given id.
	 */
	#findExtension(id: number): { pos: number; length: number } | undefined {
		const offset = this.#extensions.get(id);

		if (offset === undefined) {
			return undefined;
		}

		const view = this.getView();
		const pos = this.#getHeaderExtensionOffset() + 4 + offset;

		switch (this.#extensionsType) {
			case 'one-byte': {
				return {
					pos: pos + 1,
					length: readBitsInDataView(view, pos, 0x0f) + 1,
				};
			}

			case 'two-bytes': {
				return { pos: pos + 2, length: view.getUint8(pos + 1) };
			}
		}
	}

	/**
	 * Extensions (id and value) in the order they are in the packet.
	 *
	 * @remarks
	 * - Each value is a view over the buffer of the packet.
	 */
	#collectExtensions(): [number, Uint8Array][] {
		const buffer = this.getBuffer();
		const extensions: [number, Uint8Array][] = [];

		for (const id of this.#extensions.keys()) {
			const { pos, length } = this.#findExtension(id)!;

			extensions.push([id, buffer.subarray(pos, pos + length)]);
		}

		return extensions;
	}

	/**
	 * Rewrite the header extension with the given extensions using the given
	 * type, or remove it if no extensions are given.
	 *
	 * @throws
	 * - `TypeError` if some extension cannot be represented with the given
	 *   type or if the buffer has no space for the extensions, in which case
	 *   nothing changes.
	 */
	#writeExtensions(
		extensions: [number, Uint8Array][],
		type: ExtensionsType
	): void {
		const headerExtensionOffset = this.#getHeaderExtensionOffset();
		const previousHeaderExtensionLength = this.#getHeaderExtensionLength();

		if (extensions.length === 0) {
			this.#moveTail(
				headerExtensionOffset + previousHeaderExtensionLength,
				-previousHeaderExtensionLength
			);
			this.#setHeaderExtensionBit(false);
			this.#extensions.clear();

			return;
		}

		const view = this.getView();
		let extensionHeaderLength: number;
		let headerExtensionId: number;

		switch (type) {
			case 'one-byte': {
				extensionHeaderLength = 1;
				headerExtensionId = ONE_BYTE_EXTENSIONS_ID;

				break;
			}

			case 'two-bytes': {
				extensionHeaderLength = 2;
				headerExtensionId = TWO_BYTES_EXTENSIONS_ID;

				// If the packet already has Two-Bytes extensions, keep the header
				// extension id (its appbits).
				if (this.#hasHeaderExtensionBit()) {
					const previousHeaderExtensionId = view.getUint16(
						headerExtensionOffset
					);

					if (
						(previousHeaderExtensionId & 0b1111111111110000) ===
						TWO_BYTES_EXTENSIONS_ID
					) {
						headerExtensionId = previousHeaderExtensionId;
					}
				}

				break;
			}
		}

		let extensionsLength = 0;

		for (const [id, value] of extensions) {
			this.#assertExtension(id, value.byteLength, type);

			extensionsLength += extensionHeaderLength + value.byteLength;
		}

		const headerExtensionValueLength = padTo4Bytes(extensionsLength);

		// NOTE: Values are views over the area that is going to be rewritten, so
		// they must be copied first.
		const values = extensions.map(
			([id, value]) => [id, value.slice()] as const
		);

		// NOTE: This throws if there is no space in the buffer.
		this.#moveTail(
			headerExtensionOffset + previousHeaderExtensionLength,
			4 + headerExtensionValueLength - previousHeaderExtensionLength
		);

		this.#setHeaderExtensionBit(true);

		view.setUint16(headerExtensionOffset, headerExtensionId);
		view.setUint16(headerExtensionOffset + 2, headerExtensionValueLength / 4);

		const buffer = this.getBuffer();
		const valuePos = headerExtensionOffset + 4;
		let pos = valuePos;

		this.#extensions.clear();

		for (const [id, value] of values) {
			this.#extensions.set(id, pos - valuePos);

			switch (type) {
				case 'one-byte': {
					writeBitsInDataView(view, pos, 0xf0, id);
					writeBitsInDataView(view, pos, 0x0f, value.byteLength - 1);

					break;
				}

				case 'two-bytes': {
					view.setUint8(pos, id);
					view.setUint8(pos + 1, value.byteLength);

					break;
				}
			}

			buffer.set(value, pos + extensionHeaderLength);

			pos += extensionHeaderLength + value.byteLength;
		}

		buffer.fill(0, pos, valuePos + headerExtensionValueLength);
	}

	/**
	 * @throws
	 * - `TypeError` if the given extension id or value length cannot be
	 *   represented with the given type.
	 */
	#assertExtension(id: number, length: number, type: ExtensionsType): void {
		switch (type) {
			case 'one-byte': {
				if (!Number.isInteger(id) || id < 1 || id > 14) {
					throw new TypeError(
						`invalid extension id ${id} in One-Byte extensions (must be 1..14)`
					);
				} else if (length < 1 || length > 16) {
					throw new TypeError(
						`invalid length ${length} of extension with id ${id} in One-Byte extensions (must be 1..16)`
					);
				}

				break;
			}

			case 'two-bytes': {
				if (!Number.isInteger(id) || id < 1 || id > 255) {
					throw new TypeError(
						`invalid extension id ${id} in Two-Bytes extensions (must be 1..255)`
					);
				} else if (length > 255) {
					throw new TypeError(
						`invalid length ${length} of extension with id ${id} in Two-Bytes extensions (must be 0..255)`
					);
				}

				break;
			}
		}
	}

	#getMappedExtensionId(type: RtpExtensionType): number | undefined {
		return this.#extensionMapping[type];
	}

	#findMappedExtension(
		type: RtpExtensionType
	): { pos: number; length: number } | undefined {
		const id = this.#getMappedExtensionId(type);

		if (id === undefined) {
			return undefined;
		}

		return this.#findExtension(id);
	}

	#readStringExtension(type: RtpExtensionType): string | undefined {
		const extension = this.#findMappedExtension(type);

		if (!extension || extension.length === 0) {
			return undefined;
		}

		return textDecoder.decode(
			this.getBuffer().subarray(extension.pos, extension.pos + extension.length)
		);
	}

	/**
	 * Set or delete (if `value` is not given) the extension mapped to given
	 * type.
	 *
	 * @throws
	 * - `Error` if the extension type is not in the extension mapping.
	 */
	#writeMappedExtension(
		type: RtpExtensionType,
		value: Uint8Array | undefined
	): void {
		const id = this.#getMappedExtensionId(type);

		if (id === undefined) {
			throw new Error(
				`extension type ${RtpExtensionType[type]} is not in the extension mapping`
			);
		}

		if (value) {
			this.setExtension(id, value);
		} else {
			this.deleteExtension(id);
		}
	}
}
