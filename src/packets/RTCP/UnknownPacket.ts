import { RtcpPacket, isRtcp, type RtcpPacketDump } from './RtcpPacket.js';

/**
 * RTCP Unknown packet info dump.
 */
export type UnknownPacketDump = RtcpPacketDump & {
	/**
	 * Length (in bytes) of the value that follows the RTCP Common Header
	 * (excluding padding).
	 */
	unknownValueLength: number;
};

/**
 * RTCP packet with an unknown or not implemented packet type.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  Count  |       PT      |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * \                                                               \
 * /                         Unknown Value                         /
 * \                                                               \
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @see
 * - [RFC 3550 section 6.4](https://datatracker.ietf.org/doc/html/rfc3550#section-6.4)
 */
export class UnknownPacket extends RtcpPacket {
	/**
	 * Parse a RTCP packet with any packet type.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP packet.
	 */
	static parse(buffer: Uint8Array): UnknownPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new UnknownPacket(buffer);

		packet.parseCommonHeader();

		return packet;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP Unknown packet info.
	 */
	override dump(): UnknownPacketDump {
		return {
			...super.dump(),
			unknownValueLength: this.getBodyLength(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): UnknownPacket {
		const clonedPacket = new UnknownPacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	/**
	 * Get the value that follows the RTCP Common Header (excluding padding). It
	 * is empty if the packet has no value.
	 *
	 * @remarks
	 * - The returned value is a view over the buffer of the packet (no bytes
	 *   are copied).
	 */
	getUnknownValue(): Uint8Array {
		return this.getBody();
	}
}
