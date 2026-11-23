import { RtcpPacketType, isRtcp, type RtcpPacketDump } from './RtcpPacket';
import {
	AnyReportPacket,
	REPORT_LENGTH,
	type ReceptionReport,
} from './AnyReportPacket';

/**
 * Length (in bytes) of the fixed header that precedes the reception report
 * blocks (Common Header and SSRC of packet sender).
 */
const HEADER_LENGTH = 8;

/**
 * RTCP Receiver Report packet info dump.
 */
export type ReceiverReportPacketDump = RtcpPacketDump & {
	ssrc: number;
	reports: ReceptionReport[];
};

/**
 * RTCP Receiver Report packet.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|    RC   |   PT=RR=201   |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     SSRC of packet sender                     |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |                   Reception report block 1                    |
 * |                              ...                              |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |                   Reception report block 2                    |
 * |                              ...                              |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |                  profile-specific extensions                  |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * - Reception report count (RC) (5 bits): The number of reception report
 *   blocks contained in this packet.
 * - SSRC of packet sender (32 bits).
 * - Reception report blocks: See {@link AnyReportPacket}.
 *
 * @remarks
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized. Modifications that need more bytes throw if
 *   the buffer has no space for them, in which case the packet is not
 *   modified.
 *
 * @see
 * - [RFC 3550 section 6.4.2](https://datatracker.ietf.org/doc/html/rfc3550#section-6.4.2)
 */
export class ReceiverReportPacket extends AnyReportPacket {
	/**
	 * Parse a RTCP Receiver Report packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP Receiver Report
	 *   packet.
	 */
	static parse(buffer: Uint8Array): ReceiverReportPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new ReceiverReportPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.RR);
		packet.validateReports();

		return packet;
	}

	/**
	 * Create a RTCP Receiver Report packet with SSRC 0 and no reception report
	 * blocks.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than the length of the
	 *   fixed header (8 bytes).
	 */
	static factory(buffer: Uint8Array): ReceiverReportPacket {
		const packet = new ReceiverReportPacket(buffer);

		packet.initializeHeader(RtcpPacketType.RR, 0, HEADER_LENGTH);
		packet.setSsrc(0);

		return packet;
	}

	/**
	 * Length (in bytes) of a RTCP Receiver Report packet with the given number
	 * of reception report blocks and no profile-specific extensions.
	 *
	 * @internal
	 */
	static computeLengthFor(numReports: number): number {
		// The reception report blocks go right after the fixed header, and each
		// one is a multiple of 4 bytes, so the packet never needs padding.
		return HEADER_LENGTH + numReports * REPORT_LENGTH;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP Receiver Report packet info.
	 */
	override dump(): ReceiverReportPacketDump {
		return {
			...super.dump(),
			ssrc: this.getSsrc(),
			reports: this.getReports(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): ReceiverReportPacket {
		const clonedPacket = new ReceiverReportPacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	protected getHeaderLength(): number {
		return HEADER_LENGTH;
	}
}
