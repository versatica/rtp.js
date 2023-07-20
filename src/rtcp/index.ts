/**
        0                   1                   2                   3
        0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
header |V=2|P|    SC   |      PT       |             length            |
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 */

const RTCP_VERSION = 2;
const COMMON_HEADER_LENGTH = 4;

/**
 * ```ts
 * import { RtcpPacketType } from 'rtp.js';
 * ```
 */
// ESLint absurdly complains about "already declared".
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
 * Base RTCP packet dump.
 */
export type RtcpPacketDump =
{
	version: number;
	count: number;
	length: number;
	padding: number;
};

/**
 * ```ts
 * import { isRtcp } from 'rtp.js';
 * ```
 *
 * Inspect the given buffer and return a boolean indicating whether it could be
 * a valid RTCP packet or not.
 *
 * ```ts
 * if (isRtcp(buffer)) {
 *   console.log('it seems a valid RTCP packet');
 * }
 * ```
 */
export function isRtcp(buffer: ArrayBuffer): boolean
{
	const view = new DataView(buffer);
	const firstByte = view.getUint8(0);

	return (
		buffer.byteLength >= COMMON_HEADER_LENGTH &&
		// DOC: https://tools.ietf.org/html/draft-ietf-avtcore-rfc5764-mux-fixes
		(firstByte > 127 && firstByte < 192) &&
		// RTCP Version must be 2.
		(firstByte >> 6) === RTCP_VERSION &&
		// RTCP packet types defined by IANA:
		// http://www.iana.org/assignments/rtp-parameters/rtp-parameters.xhtml#rtp-parameters-4
		// RFC 5761 (RTCP-mux) states this range for secure RTCP/RTP detection.
		(view.getUint8(1) >= 192 && view.getUint8(1) <= 223)
	);
}

/**
 * ```ts
 * import { RtcpPacket } from 'rtp.js';
 * ```
 *
 * Representation of a base RTCP packet.
 */
export abstract class RtcpPacket
{
	// ArrayBuffer holding packet binary data.
	// @ts-ignore. 'buffer' has not initializer and is not assigned in constructor.
	protected buffer: ArrayBuffer;
	// DataView holding the ArrayBuffer.
	// @ts-ignore. 'view' has not initializer and is not assigned in constructor.
	protected view: DataView;
	// RTCP packet type.
	#packetType: RtcpPacketType;
	// Number of bytes of padding.
	protected padding: number = 0;
	// Whether serialization is needed due to modifications.
	protected serializationNeeded: boolean = false;

	static getCount(buffer: ArrayBuffer): number
	{
		const view = new DataView(buffer);

		return view.getUint8(0) & 0x1F;
	}

	static getLength(buffer: ArrayBuffer): number
	{
		const view = new DataView(buffer);

		return view.getUint16(2);
	}

	protected constructor(packetType: RtcpPacketType)
	{
		this.#packetType = packetType;
	}

	/**
	 * Base RTCP packet dump.
	 * @private
	 */
	dump(): RtcpPacketDump
	{
		return {
			version : this.getVersion(),
			count   : this.getCount(),
			length  : this.getLength(),
			padding : this.getPadding()
		};
	}

	/**
	 * Get the internal buffer containing the serialized RTCP binary packet.
	 */
	getBuffer(): ArrayBuffer
	{
		if (this.serializationNeeded)
		{
			this.serialize();
		}

		return this.buffer;
	}

	/**
	 * Get the RTCP version of the packet (always 2).
	 */
	getVersion(): number
	{
		return this.view.getUint8(0) >> 6;
	}

	/**
	 * Get the padding (in bytes) after the packet payload.
	 */
	getPadding(): number
	{
		return this.padding;
	}

	/**
	 * Set the padding (in bytes) after the packet payload.
	 */
	setPadding(padding: number): void
	{
		this.padding = padding;

		// Update padding bit.
		this.setPaddingBit(Boolean(this.padding));

		this.serializationNeeded = true;
	}

	/**
	 * Get the RTCP packet type.
	 */
	getPacketType(): RtcpPacketType
	{
		return this.view.getUint8(1);
	}

	/**
	 * Get the RTCP header count value.
	 */
	getCount(): number
	{
		return this.view.getUint8(0) & 0x1F;
	}

	/**
	 * Get the RTCP packet length.
	 */
	getLength(): number
	{
		return this.view.getUint16(2);
	}

	/**
	 * Set the RTCP header count value.
	 */
	protected setCount(count: number): void
	{
		this.view.setUint8(
			0, (this.getVersion() << 6) | (Number(this.getPaddingBit()) << 5) | (count & 0x1F)
		);
	}

	/**
	 * Serialize RTCP packet into a new buffer.
	 */
	abstract serialize(): void;

	/**
	 * Clone the packet. The cloned packet does not share any memory with the
	 * original one.
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 */
	abstract clone(): RtcpPacket;

	/**
	 * Serialize base RTCP packet into a new buffer.
	 */
	protected serializeBase(length: number): void
	{
		const padding = this.padding ?? 0;

		// Allocate new buffer.
		const buffer = new ArrayBuffer(length + padding);
		const view = new DataView(buffer);
		const array = new Uint8Array(buffer);

		// Copy the fixed header into the new buffer.
		array.set(new Uint8Array(this.buffer, 0, COMMON_HEADER_LENGTH), 0);

		this.buffer = buffer;
		this.view = view;

		this.writeCommonHeader();
		this.setLength(((length + padding) / 4) - 1);

		// Write padding.
		if (this.padding > 0)
		{
			if (this.padding > 255)
			{
				throw new TypeError(
					`padding (${this.padding} bytes) cannot be higher than 255`
				);
			}

			array.fill(0, length, length + padding - 1);
			this.view.setUint8(length + this.padding - 1, padding);
		}
	}

	protected writeCommonHeader(): void
	{
		this.setVersion();
		this.setPacketType(this.#packetType);
	}

	/**
	 * Set the RTCP version of the packet (always 2).
	 */
	private setVersion(): void
	{
		this.view.setUint8(0, this.view.getUint8(0) | (RTCP_VERSION << 6));
	}

	/**
	 * Set the RTCP packet type.
	 */
	private setPacketType(packetType: RtcpPacketType): void
	{
		this.view.setUint8(1, packetType);
	}

	/**
	 * Set the RTCP packet length.
	 */
	private setLength(length: number): void
	{
		this.view.setUint16(2, length);
	}

	protected getPaddingBit(): boolean
	{
		return Boolean((this.view.getUint8(0) >> 5) & 1);
	}

	/**
	 * Set the padding bit.
	 */
	private setPaddingBit(flag: boolean): void
	{
		this.view.setUint8(0, this.view.getUint8(0) | (Number(flag) << 5));
	}
}
