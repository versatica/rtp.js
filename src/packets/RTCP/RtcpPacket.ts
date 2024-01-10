import { RTP_VERSION, Packet, PacketDump } from '../Packet';
import { assertUnreachable } from '../../utils/helpers';
import { readBitsInDataView, writeBitsInDataView } from '../../utils/bitOps';

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
 *
 * @category RTCP
 */
// ESLint absurdly complains about "'RtcpPacketType' is already declared in the
// upper scope".
// eslint-disable-next-line no-shadow
export enum RtcpPacketType {
	/**
	 * Extended Jitter Reports packet.
	 */
	IJ = 195,
	/**
	 * RTCP Sender Report packet.
	 */
	SR = 200,
	/**
	 * RTCP Receiver Report packet.
	 */
	RR = 201,
	/**
	 * RTCP Sender Report packet.
	 */
	SDES = 202,
	/**
	 * RTCP BYE packet.
	 */
	BYE = 203,
	/**
	 * RTCP APP packet.
	 */
	APP = 204,
	/**
	 * RTCP Transport Layer Feedback packet.
	 */
	RTPFB = 205,
	/**
	 * RTCP Payload Specific Feedback packet.
	 */
	PSFB = 206,
	/**
	 * RTCP Extended Report packet.
	 */
	XR = 207,
}

/**
 * Base RTCP packet info dump.
 *
 * @category RTCP
 */
export type RtcpPacketDump = PacketDump & {
	packetType: RtcpPacketType;
	count: number;
};

/**
 * Whether the given buffer view could be a valid RTCP packet or not.
 *
 * @category RTCP
 */
export function isRtcp(view: DataView): boolean {
	const firstByte = view.getUint8(0);
	const secondByte = view.getUint8(1);

	return (
		view.byteLength >= COMMON_HEADER_LENGTH &&
		// DOC: https://tools.ietf.org/html/draft-ietf-avtcore-rfc5764-mux-fixes
		firstByte > 127 &&
		firstByte < 192 &&
		// RTCP Version must be 2.
		firstByte >> 6 === RTP_VERSION &&
		// RTCP packet types defined by IANA:
		// http://www.iana.org/assignments/rtp-parameters/rtp-parameters.xhtml#rtp-parameters-4
		// RFC 5761 (RTCP-mux) states this range for secure RTCP/RTP detection.
		secondByte >= 192 &&
		secondByte <= 223
	);
}

/**
 * Get the RTCP packet type.
 *
 * @hidden
 */
export function getRtcpPacketType(view: DataView): RtcpPacketType {
	return view.getUint8(1);
}

/**
 * Read the RTCP header length value and compute its size in bytes (including
 * first octet).
 *
 * @hidden
 */
export function getRtcpLength(view: DataView): number {
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
function setRtcpLength(view: DataView, byteLength: number): void {
	// RTCP packet byte length must be multiple of 4.
	if (byteLength % 4 !== 0) {
		throw new RangeError(
			`RTCP packet byte length must be multiple of 4 but given byte length is ${byteLength} bytes`,
		);
	}

	const length = byteLength / 4 - 1;

	view.setUint16(2, length);
}

/**
 * @hidden
 */
export function packetTypeToString(packetType: RtcpPacketType): string {
	switch (packetType) {
		case RtcpPacketType.SR: {
			return 'Sender Report';
		}

		case RtcpPacketType.RR: {
			return 'Receiver Report';
		}

		case RtcpPacketType.SDES: {
			return 'SDES';
		}

		case RtcpPacketType.BYE: {
			return 'BYE';
		}

		case RtcpPacketType.APP: {
			return 'APP';
		}

		case RtcpPacketType.RTPFB: {
			return 'RTP Feedback';
		}

		case RtcpPacketType.PSFB: {
			return 'PS Feedback';
		}

		case RtcpPacketType.XR: {
			return 'Extended Report';
		}

		case RtcpPacketType.IJ: {
			return 'Extended Jitter Reports';
		}

		default: {
			assertUnreachable(packetType);
		}
	}
}

/**
 * RTCP packet. Parent class of all RTCP packets.
 *
 * ```text
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    SC   |      PT       |             length            |
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 3550 section 6.1](https://datatracker.ietf.org/doc/html/rfc3550#section-6.1)
 */
export abstract class RtcpPacket extends Packet {
	// RTCP packet type.
	readonly #packetType: RtcpPacketType;

	protected constructor(packetType: RtcpPacketType, view?: DataView) {
		super(view);

		this.#packetType = packetType;

		if (this.view) {
			if (!isRtcp(this.view)) {
				throw new TypeError('not a RTCP packet');
			} else if (this.getPacketType() !== this.#packetType) {
				throw new TypeError(
					`given buffer view is not a RTCP ${packetTypeToString(
						this.#packetType,
					)} packet`,
				);
			}
			// RTCP packet byte length must be multiple of 4.
			else if (this.view.byteLength % 4 !== 0) {
				throw new RangeError(
					`RTCP packet byte length must be multiple of 4 but given buffer view is ${this.view.byteLength} bytes`,
				);
			} else if (getRtcpLength(this.view) !== this.view.byteLength) {
				throw new RangeError(
					`length in the RTCP header (${getRtcpLength(
						this.view,
					)} bytes) does not match buffer view length (${
						this.view.byteLength
					} bytes)`,
				);
			}

			// Get padding.
			if (this.hasPaddingBit()) {
				this.padding = this.view.getUint8(this.view.byteLength - 1);
			}
		}
	}

	/**
	 * Base RTCP packet dump.
	 *
	 * @remarks
	 * - Read the info dump type of each RTCP packet instead.
	 */
	dump(): RtcpPacketDump {
		return {
			...super.dump(),
			packetType: this.getPacketType(),
			count: this.getCount(),
		};
	}

	/**
	 * Get the RTCP packet type.
	 */
	getPacketType(): RtcpPacketType {
		return this.view.getUint8(1);
	}

	/**
	 * Get the RTCP header count value.
	 *
	 * @remarks
	 * - Some RTCP packets do not use this byte (the second one in the common
	 *   RTCP header) for counting chunks or items.
	 */
	getCount(): number {
		return readBitsInDataView({ view: this.view, pos: 0, mask: 0b00011111 });
	}

	protected writeCommonHeader(): void {
		this.setVersion();
		this.setPacketType();

		// Update the length field in the RTCP header.
		setRtcpLength(this.view, this.view.byteLength);
	}

	/**
	 * Set the RTCP header count value.
	 *
	 * @privateRemarks
	 * - This method is not public since users should not manipulate this field
	 *   directly.
	 * - Also, there is no `count` field in all RTCP packets. For instance, XR
	 *   and APP packets do not have it.
	 */
	protected setCount(count: number): void {
		writeBitsInDataView({
			view: this.view,
			pos: 0,
			mask: 0b00011111,
			value: count,
		});
	}

	/**
	 * Serialize base RTCP packet into a new buffer.
	 */
	protected serializeBase(buffer?: ArrayBuffer, byteOffset?: number): DataView {
		const bufferData = this.getSerializationBuffer(buffer, byteOffset);

		// Create new DataView with new buffer.
		const view = new DataView(
			bufferData.buffer,
			bufferData.byteOffset,
			bufferData.byteLength,
		);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength,
		);

		// Copy the common header into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset,
				COMMON_HEADER_LENGTH,
			),
			0,
		);

		// Update the length field in the RTCP header.
		setRtcpLength(view, view.byteLength);

		// Write padding.
		if (this.padding > 0) {
			if (this.padding > 255) {
				throw new TypeError(
					`padding (${this.padding} bytes) cannot be higher than 255`,
				);
			}

			view.setUint8(view.byteLength - 1, this.padding);
		}

		return view;
	}

	/**
	 * Set the RTCP packet type.
	 *
	 * @privateRemarks
	 * - This method is not public since users should not manipulate this field
	 *   directly.
	 */
	private setPacketType(): void {
		this.view.setUint8(1, this.#packetType);
	}
}
