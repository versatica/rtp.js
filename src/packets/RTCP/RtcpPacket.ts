import { Serializable, type SerializableDump } from '../common/Serializable';
import { isUnsignedInteger } from '../../utils/numbers';
import { padTo4Bytes } from '../../utils/buffers';
import {
	readBitInDataView,
	writeBitInDataView,
	readBitsInDataView,
	writeBitsInDataView,
} from '../../utils/bits';

/**
 * Length (in bytes) of the RTCP Common Header.
 *
 * @internal
 */
export const COMMON_HEADER_LENGTH = 4;

/**
 * Maximum length (in bytes) representable by the Length field.
 */
const MAX_PACKET_LENGTH = (0xffff + 1) * 4;

/**
 * RTCP packet type.
 */
export enum RtcpPacketType {
	/**
	 * RTCP Sender Report.
	 */
	SR = 200,
	/**
	 * RTCP Receiver Report.
	 */
	RR = 201,
	/**
	 * RTCP SDES.
	 */
	SDES = 202,
	/**
	 * RTCP BYE.
	 */
	BYE = 203,
	/**
	 * RTCP Transport Layer Feedback.
	 */
	RTPFB = 205,
	/**
	 * RTCP Payload Specific Feedback.
	 */
	PSFB = 206,
	/**
	 * RTCP Extended Report.
	 */
	XR = 207,
}

/**
 * RTCP packet info dump.
 */
export type RtcpPacketDump = SerializableDump & {
	packetType: RtcpPacketType;
	count: number;
	padding: number;
};

/**
 * Whether the given buffer could be a valid RTCP packet (or compound packet)
 * or not.
 *
 * @param buffer - Buffer holding the packet.
 * @param packetLength - Exact length of the packet. If not given,
 *   `buffer.byteLength` is used.
 */
export function isRtcp(
	buffer: Uint8Array,
	packetLength: number = buffer.byteLength
): boolean {
	if (
		!isUnsignedInteger(packetLength) ||
		packetLength > buffer.byteLength ||
		packetLength < COMMON_HEADER_LENGTH
	) {
		return false;
	}

	const firstByte = buffer[0]!;
	const secondByte = buffer[1]!;

	return (
		// @see RFC 7983.
		firstByte > 127 &&
		firstByte < 192 &&
		// RTP Version must be 2.
		firstByte >> 6 === 2 &&
		// RTCP packet types defined by IANA:
		// http://www.iana.org/assignments/rtp-parameters/rtp-parameters.xhtml#rtp-parameters-4
		// RFC 5761 (RTCP-mux) states this range for secure RTCP/RTP detection.
		secondByte >= 192 &&
		secondByte <= 223
	);
}

/**
 * RTCP packet. Parent class of all RTCP packets.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  Count  |      PT       |            Length             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * \                                                               \
 * /                             Body                              /
 * \                                                               \
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * - Version (2 bits): RTP/RTCP version. Always 2.
 * - Padding (1 bit): If set, the packet contains padding bytes at the end
 *   that are not part of the body. The last padding byte indicates how many
 *   padding bytes must be ignored, including itself.
 * - Count (5 bits): Field whose meaning depends on the packet type (PT). In
 *   Sender/Receiver Report it is the reception report block count (RC), in
 *   SDES and BYE it is the source count (SC) and in feedback packets it is
 *   the feedback message type (FMT).
 * - Packet type (8 bits): Identifies the RTCP packet type.
 * - Length (16 bits): Length of the RTCP packet in 32-bit words minus one,
 *   including the Common Header and any padding. Therefore the total length
 *   in bytes is (Length + 1) * 4.
 * - Body (variable length): Packet content, whose format depends on the
 *   packet type (PT).
 *
 * @remarks
 * - This class represents a single RTCP packet and not a compound packet.
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized.
 *
 * @see
 * - [RFC 3550 section 6.4](https://datatracker.ietf.org/doc/html/rfc3550#section-6.4)
 */
export abstract class RtcpPacket extends Serializable {
	protected constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP packet info.
	 */
	override dump(): RtcpPacketDump {
		return {
			...super.dump(),
			packetType: this.getPacketType(),
			count: this.getCount(),
			padding: this.getPadding(),
		};
	}

	/**
	 * @inheritDoc
	 */
	abstract override clone(buffer: Uint8Array): RtcpPacket;

	/**
	 * Get the RTCP packet type.
	 *
	 * @remarks
	 * - In a packet with unknown type, the returned value is not a member of
	 *   {@link RtcpPacketType}.
	 */
	getPacketType(): RtcpPacketType {
		return this.getView().getUint8(1);
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
	 * To be called by the `parse()` method of each subclass right after
	 * creating the packet. It sets the length of the packet to the one
	 * announced in its Length field and validates the Common Header.
	 *
	 * @param packetType - Expected packet type. If not given, any packet type
	 *   is accepted.
	 *
	 * @remarks
	 * - The subclass must verify that the buffer is RTCP (see {@link isRtcp})
	 *   before creating the packet.
	 *
	 * @throws
	 * - `TypeError` if the packet type is not the given one.
	 * - `TypeError` if the buffer has no space for the announced length.
	 * - `TypeError` if the announced padding is not valid.
	 */
	protected parseCommonHeader(packetType?: RtcpPacketType): void {
		const view = this.getView();

		if (packetType !== undefined && this.getPacketType() !== packetType) {
			throw new TypeError(`not a RTCP ${RtcpPacketType[packetType]} packet`);
		}

		const length = (view.getUint16(2) + 1) * 4;

		// NOTE: This throws if there is no space in the buffer.
		this.setLength(length);

		if (this.#hasPaddingBit()) {
			const padding = view.getUint8(length - 1);

			if (padding === 0) {
				throw new TypeError('padding byte cannot be 0');
			} else if (padding > length - COMMON_HEADER_LENGTH) {
				throw new TypeError(
					`announced padding (${padding} bytes) is bigger than available space for body and padding (${length - COMMON_HEADER_LENGTH} bytes)`
				);
			}
		}
	}

	/**
	 * To be called by the `factory()` method of each subclass. It writes the
	 * whole Common Header (without padding) and sets the length of the packet.
	 *
	 * @param packetType - Packet type.
	 * @param count - Value of the Count field.
	 * @param length - Length (in bytes) of the packet.
	 *
	 * @throws
	 * - `TypeError` if `count` is not an integer between 0 and 31, in which
	 *   case nothing changes.
	 * - `TypeError` if `length` is lower than the Common Header length, is not
	 *   multiple of 4 bytes or cannot be represented by the Length field, in
	 *   which case nothing changes.
	 * - `TypeError` if the buffer has no space for the given `length`, in
	 *   which case nothing changes.
	 */
	protected initializeHeader(
		packetType: RtcpPacketType,
		count: number,
		length: number
	): void {
		if (!isUnsignedInteger(count, 31)) {
			throw new TypeError(
				`count (${count}) must be an integer between 0 and 31`
			);
		} else if (
			!isUnsignedInteger(length, MAX_PACKET_LENGTH) ||
			length < COMMON_HEADER_LENGTH ||
			padTo4Bytes(length) !== length
		) {
			throw new TypeError(
				`length (${length}) must be a multiple of 4 between ${COMMON_HEADER_LENGTH} and ${MAX_PACKET_LENGTH}`
			);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setLength(length);

		const view = this.getView();

		// Set version 2.
		writeBitsInDataView(view, 0, 0b11000000, 2);
		this.#setPaddingBit(false);
		writeBitsInDataView(view, 0, 0b00011111, count);
		view.setUint8(1, packetType);
		this.#setLengthField(length);
	}

	/**
	 * Get the value of the Count field, whose meaning depends on the packet
	 * type.
	 */
	protected getCount(): number {
		return readBitsInDataView(this.getView(), 0, 0b00011111);
	}

	/**
	 * Set the value of the Count field, whose meaning depends on the packet
	 * type.
	 *
	 * @throws
	 * - `TypeError` if `count` is not an integer between 0 and 31.
	 */
	protected setCount(count: number): void {
		if (!isUnsignedInteger(count, 31)) {
			throw new TypeError(
				`count (${count}) must be an integer between 0 and 31`
			);
		}

		writeBitsInDataView(this.getView(), 0, 0b00011111, count);
	}

	/**
	 * Get the body of the packet (excluding padding).
	 *
	 * @remarks
	 * - The returned value is a view over the buffer of the packet (no bytes
	 *   are copied).
	 */
	protected getBody(): Uint8Array {
		return this.getBuffer().subarray(
			COMMON_HEADER_LENGTH,
			COMMON_HEADER_LENGTH + this.getBodyLength()
		);
	}

	/**
	 * Get the length (in bytes) of the body of the packet (excluding padding).
	 */
	protected getBodyLength(): number {
		return this.getLength() - COMMON_HEADER_LENGTH - this.getPadding();
	}

	/**
	 * Set the length (in bytes) of the body of the packet. It doesn't write any
	 * byte of the body. It updates the length of the packet, its Length field
	 * and its padding.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 * - If given `bodyLength` is not multiple of 4 bytes, this method adds the
	 *   padding bytes needed to make the packet length multiple of 4 bytes.
	 *   Padding bytes are filled with zeros except the last one, which holds
	 *   the padding length.
	 *
	 * @throws
	 * - `TypeError` if `bodyLength` is not an unsigned integer, in which case
	 *   nothing changes.
	 * - `TypeError` if the resulting packet length cannot be represented by the
	 *   Length field or if the buffer has no space for it, in which case
	 *   nothing changes.
	 */
	protected setBodyLength(bodyLength: number): void {
		if (!isUnsignedInteger(bodyLength)) {
			throw new TypeError(
				`bodyLength (${bodyLength}) must be an unsigned integer`
			);
		}

		const notPaddedLength = COMMON_HEADER_LENGTH + bodyLength;
		const length = padTo4Bytes(notPaddedLength);
		const padding = length - notPaddedLength;

		if (length > MAX_PACKET_LENGTH) {
			throw new TypeError(
				`packet length (${length} bytes) cannot be greater than ${MAX_PACKET_LENGTH} bytes`
			);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setLength(length);

		this.#setLengthField(length);

		if (padding === 0) {
			this.#setPaddingBit(false);

			return;
		}

		this.#setPaddingBit(true);
		this.fillPadding(padding);
		this.getView().setUint8(length - 1, padding);
	}

	#hasPaddingBit(): boolean {
		return readBitInDataView(this.getView(), 0, 5);
	}

	#setPaddingBit(flag: boolean): void {
		writeBitInDataView(this.getView(), 0, 5, flag);
	}

	/**
	 * Write the given packet length (in bytes) in the Length field.
	 */
	#setLengthField(length: number): void {
		this.getView().setUint16(2, length / 4 - 1);
	}
}
