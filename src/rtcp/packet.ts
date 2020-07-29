/*
        0                   1                   2                   3
        0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
header |V=2|P|    SC   |      PT       |             length            |
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 */

/** @ignore */
const RTCP_VERSION = 2;
/** @ignore */
const COMMON_HEADER_LENGTH = 4;

export enum PacketType
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
 * Inspect the given buffer and return a boolean indicating whether it could be
 * a valid RTCP packet or not.
 *
 * ```ts
 * if (isRtcp(buffer)) {
 *   console.log('it seems a valid RTCP packet');
 * }
 * ```
 */
export function isRtcp(buffer: Buffer): boolean
{
	const firstByte = buffer.readUInt8(0);

	return (
		Buffer.isBuffer(buffer) &&
		buffer.length >= COMMON_HEADER_LENGTH &&
		// DOC: https://tools.ietf.org/html/draft-ietf-avtcore-rfc5764-mux-fixes
		(firstByte > 127 && firstByte < 192) &&
		// RTCP Version must be 2.
		(firstByte >> 6) === RTCP_VERSION &&
		// RTCP packet types defined by IANA:
		// http://www.iana.org/assignments/rtp-parameters/rtp-parameters.xhtml#rtp-parameters-4
		// RFC 5761 (RTCP-mux) states this range for secure RTCP/RTP detection.
		(buffer.readUInt8(1) >= 192 && buffer.readUInt8(1) <= 223)
	);
}

export abstract class RtcpPacket
{
	// Buffer.
	// @ts-ignore. 'buffer' has not initializer and is not assigned in constructor.
	protected buffer: Buffer;
	// RTCP Packet type.
	private packetType: PacketType;

	/**
	 * @ignore
	 *
	 * @param PacketType.
	 */
	protected constructor(packetType: PacketType)
	{
		this.packetType = packetType;
	}

	/**
	 * @ignore
	 */
	dump(): any
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
	abstract getBuffer(): Buffer;

	/**
	 * Get the RTCP version of the packet (always 2).
	 */
	getVersion(): number
	{
		return RTCP_VERSION;
	}

	/**
	 * Get the padding flag.
	 */
	getPadding(): boolean
	{
		return Boolean(this.buffer.readUInt8(0) & 0x20);
	}

	/**
	 * Set the padding flag.
	 */
	setPadding(padding: boolean): void
	{
		// Update padding bit.
		const bit = padding ? 1 : 0;

		this.buffer.writeUInt8(this.buffer.readUInt8(0) | (bit << 5), 0);
	}

	/**
	 * Get the RTCP header count value.
	 */
	getCount(): number
	{
		return this.buffer.readUInt8(0) & 0x1F;
	}

	/**
	 * Set the RTCP header count value.
	 */
	protected setCount(count: number): void
	{
		this.buffer.writeUInt8(this.buffer.readUInt8() | (count & 0x1F), 0);
	}

	/**
	 * Get the RTCP packet type.
	 */
	getPacketType(): PacketType
	{
		return this.buffer.readUInt8(1);
	}

	/**
	 * Get the RTCP packet length.
	 */
	getLength(): number
	{
		return this.buffer.readUInt16BE(2);
	}

	/**
	 * Serialize RTCP packet into a new buffer.
	 */
	protected serialize(length: number): void
	{
		// Allocate new buffer.
		const newBuffer = Buffer.alloc(length);

		this.buffer.copy(newBuffer, 0, 0, COMMON_HEADER_LENGTH);

		this.buffer = newBuffer;

		this.writeCommonHeader();
		this.setLength((length / 4) - 1);
	}

	protected writeCommonHeader(): void
	{
		this.setVersion();
		this.setPacketType(this.packetType);
	}

	/**
	 * Set the RTCP version of the packet (always 2).
	 */
	private setVersion(): void
	{
		this.buffer.writeUInt8(this.buffer.readUInt8() | (RTCP_VERSION << 6), 0);
	}

	/**
	 * Set the RTCP packet type.
	 */
	private setPacketType(count: PacketType): void
	{
		this.buffer.writeUInt8(count, 1);
	}

	/**
	 * Set the RTCP packet length.
	 */
	private setLength(length: number): void
	{
		this.buffer.writeUInt16BE(length, 2);
	}
}
