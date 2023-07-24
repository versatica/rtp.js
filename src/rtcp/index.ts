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
 * Inspect the given DataView and return a boolean indicating whether it could be
 * a valid RTCP packet or not.
 *
 * ```ts
 * if (isRtcp(view)) {
 *   console.log('it seems a valid RTCP packet');
 * }
 * ```
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
		(firstByte >> 6) === RTCP_VERSION &&
		// RTCP packet types defined by IANA:
		// http://www.iana.org/assignments/rtp-parameters/rtp-parameters.xhtml#rtp-parameters-4
		// RFC 5761 (RTCP-mux) states this range for secure RTCP/RTP detection.
		(secondByte >= 192 && secondByte <= 223)
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
	// DataView holding the entire RTCP packet.
	// @ts-ignore. 'packetView' has not initializer and is not assigned in constructor.
	protected packetView: DataView;
	// RTCP packet type.
	readonly #packetType: RtcpPacketType;
	// Number of bytes of padding.
	protected padding: number = 0;
	// Whether serialization is needed due to modifications.
	#serializationNeeded: boolean = false;

	/**
	 * Get the RTCP header count value.
	 *
	 * @exclude
	 */
	static getCount(view: DataView): number
	{
		return view.getUint8(0) & 0x1F;
	}

	/**
	 * Get the RTCP header length value.
	 *
	 * @remarks
	 * As per RFC 3550, this is the length of this RTCP packet in 32-bit words
	 * minus one, including the header and any padding.
	 *
	 * @exclude
	 */
	static getLength(view: DataView): number
	{
		return view.getUint16(2);
	}

	protected constructor(packetType: RtcpPacketType, view?: DataView)
	{
		if (view && !isRtcp(view))
		{
			throw new TypeError('not a RTCP packet');
		}

		this.#packetType = packetType;
	}

	/**
	 * Base RTCP packet dump.
	 *
	 * @exclude
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
	 * Whether {@link serialize} should be called due to modifications in the
	 * packet not being yet applied into the buffer.
	 */
	needsSerialization(): boolean
	{
		return this.#serializationNeeded;
	}

	/**
	 * Get the DataView containing the serialized RTCP binary packet.
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

		return this.packetView;
	}

	/**
	 * Get the RTCP version of the packet (always 2).
	 */
	getVersion(): number
	{
		return this.packetView.getUint8(0) >> 6;
	}

	/**
	 * Get the padding (in bytes).
	 */
	getPadding(): number
	{
		return this.padding;
	}

	/**
	 * Set the padding (in bytes).
	 *
	 * @remarks
	 * Serialization maybe needed after calling this method.
	 */
	setPadding(padding: number): void
	{
		if (padding === this.padding)
		{
			return;
		}

		this.padding = padding;

		// Update padding bit.
		this.setPaddingBit(Boolean(this.padding));

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the RTCP packet type.
	 */
	getPacketType(): RtcpPacketType
	{
		return this.packetView.getUint8(1);
	}

	/**
	 * Get the RTCP header count value.
	 */
	getCount(): number
	{
		return this.packetView.getUint8(0) & 0x1F;
	}

	/**
	 * Get the RTCP header length value.
	 *
	 * @remarks
	 * As per RFC 3550, this is the length of this RTCP packet in 32-bit words
	 * minus one, including the header and any padding.
	 */
	getLength(): number
	{
		return this.packetView.getUint16(2);
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
	abstract clone(): RtcpPacket;

	/**
	 * Apply pending changes into the packet and serialize it into a new internal
	 * buffer (the one that {@link getView} will later return).
	 *
	 * @remarks
	 * In most cases there is no need to use this method since many setter methods
	 * apply the changes within the current buffer. To be sure, check
	 * {@link needsSerialization} before.
	 *
	 * @throws If invalid fields were previously added to the packet.
	 */
	abstract serialize(): void;

	protected setSerializationNeeded(flag: boolean): void
	{
		this.#serializationNeeded = flag;
	}

	protected writeCommonHeader(): void
	{
		this.setVersion();
		this.setPacketType(this.#packetType);
	}

	protected getPaddingBit(): boolean
	{
		return Boolean((this.packetView.getUint8(0) >> 5) & 1);
	}

	/**
	 * Set the RTCP header count value.
	 */
	protected setCount(count: number): void
	{
		this.packetView.setUint8(
			0,
			(this.getVersion() << 6) | (Number(this.getPaddingBit()) << 5) | (count & 0x1F)
		);
	}

	/**
	 * Serialize base RTCP packet into a new buffer.
	 *
	 * @param packetLength - Length of the RTCP packets (in bytes) excluding
	 *   padding.
	 */
	protected serializeBase(packetLength: number): void
	{
		const padding = this.padding ?? 0;

		// Allocate new DataView with new buffer.
		const packetView = new DataView(new ArrayBuffer(packetLength + padding));
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

		// Update DataView.
		this.packetView = packetView;

		this.writeCommonHeader();
		this.setLength(((packetView.byteLength) / 4) - 1);

		// Write padding.
		if (padding > 0)
		{
			if (padding > 255)
			{
				throw new TypeError(
					`padding (${this.padding} bytes) cannot be higher than 255`
				);
			}

			this.packetView.setUint8(packetLength + padding - 1, padding);
		}
	}

	/**
	 * Set the RTCP version of the packet (always 2).
	 */
	private setVersion(): void
	{
		this.packetView.setUint8(
			0,
			this.packetView.getUint8(0) | (RTCP_VERSION << 6)
		);
	}

	/**
	 * Set the RTCP packet type.
	 */
	private setPacketType(packetType: RtcpPacketType): void
	{
		this.packetView.setUint8(1, packetType);
	}

	/**
	 * Set the RTCP packet length.
	 */
	private setLength(length: number): void
	{
		this.packetView.setUint16(2, length);
	}

	/**
	 * Set the padding bit.
	 */
	private setPaddingBit(bit: boolean): void
	{
		this.packetView.setUint8(
			0,
			this.packetView.getUint8(0) | (Number(bit) << 5)
		);
	}
}
