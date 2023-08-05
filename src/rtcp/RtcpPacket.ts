import { RTP_VERSION, Packet, PacketDump } from '../Packet';
import { readBits, writeBits } from '../bitOps';

/**
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    SC   |      PT       |             length            |
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 */

export const COMMON_HEADER_LENGTH = 4;

/**
 * RTCP packet types.
 */
// ESLint absurdly complains about "'RtcpPacketType' is already declared in the
// upper scope".
// eslint-disable-next-line no-shadow
export enum RtcpPacketType
{
	SR = 200,
	RR = 201,
	SDES = 202,
	BYE = 203,
	APP = 204,
	RTPFB = 205,
	PSFB = 206,
	XR = 207
}

/**
 * Base RTCP packet info dump.
 */
export type RtcpPacketDump = PacketDump &
{
	count: number;
};

/**
 * Whether the given buffer view could be a valid RTCP packet or not.
 */
export function isRtcp(view: DataView): boolean
{
	const firstByte = view.getUint8(0);
	const secondByte = view.getUint8(1);

	return (
		view.byteLength >= COMMON_HEADER_LENGTH &&
		// DOC: https://tools.ietf.org/html/draft-ietf-avtcore-rfc5764-mux-fixes
		(firstByte > 127 && firstByte < 192) &&
		// RTCP Version must be 2.
		(firstByte >> 6) === RTP_VERSION &&
		// RTCP packet types defined by IANA:
		// http://www.iana.org/assignments/rtp-parameters/rtp-parameters.xhtml#rtp-parameters-4
		// RFC 5761 (RTCP-mux) states this range for secure RTCP/RTP detection.
		(secondByte >= 192 && secondByte <= 223)
	);
}

/**
 * Get the RTCP packet type.
 *
 * @hidden
 */
export function getRtcpPacketType(view: DataView): RtcpPacketType
{
	return view.getUint8(1);
}

/**
 * Read the RTCP header length value and compute its size in bytes (including
 * first octet).
 *
 * @hidden
 */
export function getRtcpLength(view: DataView): number
{
	// As per RFC 3550, this is the length of this RTCP packet in 32-bit words
	// minus one, including the header and any padding.
	const length = view.getUint16(2);
	const byteLength = (length + 1) * 4;

	return byteLength;
}

/**
 * Writes given length (in bytes) in the RTCP header length field.
 *
 * @hidden
 */
function setRtcpLength(view: DataView, byteLength: number): void
{
	// RTCP packet byte length must be multiple of 4.
	if (byteLength % 4 !== 0)
	{
		throw new RangeError(
			`RTCP packet byte length must be multiple of 4 but given byte length is ${byteLength} bytes`
		);
	}

	const length = (byteLength / 4) - 1;

	view.setUint16(2, length);
}

/**
 * Parent class of all RTCP packets.
 */
export abstract class RtcpPacket extends Packet
{
	// RTCP packet type.
	readonly #packetType: RtcpPacketType;

	protected constructor(packetType: RtcpPacketType, view?: DataView)
	{
		super(view);

		this.#packetType = packetType;

		if (this.packetView)
		{
			if (!isRtcp(this.packetView))
			{
				throw new TypeError('not a RTCP packet');
			}

			// RTCP packet byte length must be multiple of 4.
			if (this.packetView.byteLength % 4 !== 0)
			{
				throw new RangeError(
					`RTCP packet byte length must be multiple of 4 but given buffer view is ${this.packetView.byteLength} bytes`
				);
			}

			// Get padding.
			if (this.hasPaddingBit())
			{
				this.padding = this.packetView.getUint8(this.packetView.byteLength - 1);
			}
		}
	}

	/**
	 * Base RTCP packet dump.
	 *
	 * @remarks
	 * - Read the info dump type of each RTCP packet instead.
	 */
	dump(): RtcpPacketDump
	{
		return {
			count      : this.getCount(),
			padding    : this.getPadding(),
			byteLength : this.getByteLength()
		};
	}

	/**
	 * Get the RTCP header packet type.
	 */
	getPacketType(): RtcpPacketType
	{
		return this.packetView.getUint8(1);
	}

	protected writeCommonHeader(): void
	{
		this.setVersion();

		this.setPacketType(this.#packetType);
	}

	/**
	 * Get the RTCP header count value.
	 */
	getCount(): number
	{
		return readBits({ view: this.packetView, byte: 0, mask: 0b00011111 });
	}

	/**
	 * Set the RTCP header count value.
	 */
	protected setCount(count: number): void
	{
		writeBits(
			{ view: this.packetView, byte: 0, mask: 0b00011111, value: count }
		);
	}

	/**
	 * Serialize base RTCP packet into a new buffer.
	 */
	protected serializeBase(): DataView
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

		// Copy the fixed header into the new buffer.
		packetUint8Array.set(
			new Uint8Array(
				this.packetView.buffer,
				this.packetView.byteOffset,
				COMMON_HEADER_LENGTH
			),
			0
		);

		// Update the length field in the RTCP header.
		setRtcpLength(packetView, packetLength);

		// Write padding.
		if (this.padding > 0)
		{
			if (this.padding > 255)
			{
				throw new TypeError(
					`padding (${this.padding} bytes) cannot be higher than 255`
				);
			}

			packetView.setUint8(packetLength - 1, this.padding);
		}

		return packetView;
	}

	/**
	 * Set the RTCP header packet type.
	 */
	private setPacketType(packetType: RtcpPacketType): void
	{
		this.packetView.setUint8(1, packetType);
	}
}
