import {
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacketDump,
} from './RtcpPacket';
import {
	AnyReportPacket,
	REPORT_LENGTH,
	type ReceptionReport,
} from './AnyReportPacket';
import { isUnsignedInteger } from '../../utils/numbers';
import type { Ntp } from '../../utils/types';

/**
 * Length (in bytes) of the fixed header that precedes the reception report
 * blocks (Common Header, SSRC of sender and sender info).
 */
const HEADER_LENGTH = 28;

/**
 * RTCP Sender Report packet info dump.
 */
export type SenderReportPacketDump = RtcpPacketDump & {
	/**
	 * SSRC of the packet sender.
	 */
	ssrc: number;
	/**
	 * NTP timestamp.
	 */
	ntp: Ntp;
	/**
	 * RTP timestamp.
	 */
	rtpTimestamp: number;
	/**
	 * Sender's packet count.
	 */
	packetCount: number;
	/**
	 * Sender's octet count.
	 */
	octetCount: number;
	/**
	 * Reception reports.
	 */
	reports: ReceptionReport[];
};

/**
 * RTCP Sender Report packet.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|    RC   |   PT=SR=200   |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                         SSRC of sender                        |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |              NTP timestamp, most significant word             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |             NTP timestamp, least significant word             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                         RTP timestamp                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     sender's packet count                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                      sender's octet count                     |
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
 * - SSRC of sender (32 bits).
 * - NTP timestamp (64 bits): Wallclock time when this report was sent.
 * - RTP timestamp (32 bits): Same time as the NTP timestamp but in the same
 *   units and with the same random offset as the RTP timestamps in data
 *   packets.
 * - Sender's packet count (32 bits): Total number of RTP data packets
 *   transmitted by the sender since starting transmission.
 * - Sender's octet count (32 bits): Total number of payload octets
 *   transmitted by the sender since starting transmission.
 * - Reception report blocks: See {@link AnyReportPacket}.
 *
 * @remarks
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized. Modifications that need more bytes throw if
 *   the buffer has no space for them, in which case the packet is not
 *   modified.
 *
 * @see
 * - [RFC 3550 section 6.4.1](https://datatracker.ietf.org/doc/html/rfc3550#section-6.4.1)
 */
export class SenderReportPacket extends AnyReportPacket {
	/**
	 * Parse a RTCP Sender Report packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP Sender Report
	 *   packet.
	 */
	static parse(buffer: Uint8Array): SenderReportPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new SenderReportPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.SR);
		packet.validateReports();

		return packet;
	}

	/**
	 * Create a RTCP Sender Report packet with all fields set to 0 and no
	 * reception report blocks.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than the length of the
	 *   fixed header (28 bytes).
	 */
	static factory(buffer: Uint8Array): SenderReportPacket {
		const packet = new SenderReportPacket(buffer);

		packet.initializeHeader(RtcpPacketType.SR, 0, HEADER_LENGTH);

		// Set SSRC of sender and sender info to 0.
		buffer.fill(0, COMMON_HEADER_LENGTH, HEADER_LENGTH);

		return packet;
	}

	/**
	 * Length (in bytes) of a RTCP Sender Report packet with the given number of
	 * reception report blocks and no profile-specific extensions.
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
	 * Dump RTCP Sender Report packet info.
	 */
	override dump(): SenderReportPacketDump {
		return {
			...super.dump(),
			ssrc: this.getSsrc(),
			ntp: this.getNtp(),
			rtpTimestamp: this.getRtpTimestamp(),
			packetCount: this.getPacketCount(),
			octetCount: this.getOctetCount(),
			reports: this.getReports(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): SenderReportPacket {
		const clonedPacket = new SenderReportPacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	/**
	 * Get the NTP timestamp.
	 */
	getNtp(): Ntp {
		const view = this.getView();

		return {
			seconds: view.getUint32(8),
			fractions: view.getUint32(12),
		};
	}

	/**
	 * Set the NTP timestamp.
	 *
	 * @throws
	 * - `TypeError` if `seconds` or `fractions` is not an integer between 0 and
	 *   4294967295.
	 */
	setNtp(ntp: Ntp): void {
		if (
			!isUnsignedInteger(ntp.seconds, 0xffffffff) ||
			!isUnsignedInteger(ntp.fractions, 0xffffffff)
		) {
			throw new TypeError(
				'ntp seconds and fractions must be integers between 0 and 4294967295'
			);
		}

		const view = this.getView();

		view.setUint32(8, ntp.seconds);
		view.setUint32(12, ntp.fractions);
	}

	/**
	 * Get the RTP timestamp.
	 */
	getRtpTimestamp(): number {
		return this.getView().getUint32(16);
	}

	/**
	 * Set the RTP timestamp.
	 *
	 * @throws
	 * - `TypeError` if `rtpTimestamp` is not an integer between 0 and
	 *   4294967295.
	 */
	setRtpTimestamp(rtpTimestamp: number): void {
		if (!isUnsignedInteger(rtpTimestamp, 0xffffffff)) {
			throw new TypeError(
				`rtpTimestamp (${rtpTimestamp}) must be an integer between 0 and 4294967295`
			);
		}

		this.getView().setUint32(16, rtpTimestamp);
	}

	/**
	 * Get the sender's packet count.
	 */
	getPacketCount(): number {
		return this.getView().getUint32(20);
	}

	/**
	 * Set the sender's packet count.
	 *
	 * @throws
	 * - `TypeError` if `packetCount` is not an integer between 0 and
	 *   4294967295.
	 */
	setPacketCount(packetCount: number): void {
		if (!isUnsignedInteger(packetCount, 0xffffffff)) {
			throw new TypeError(
				`packetCount (${packetCount}) must be an integer between 0 and 4294967295`
			);
		}

		this.getView().setUint32(20, packetCount);
	}

	/**
	 * Get the sender's octet count.
	 */
	getOctetCount(): number {
		return this.getView().getUint32(24);
	}

	/**
	 * Set the sender's octet count.
	 *
	 * @throws
	 * - `TypeError` if `octetCount` is not an integer between 0 and 4294967295.
	 */
	setOctetCount(octetCount: number): void {
		if (!isUnsignedInteger(octetCount, 0xffffffff)) {
			throw new TypeError(
				`octetCount (${octetCount}) must be an integer between 0 and 4294967295`
			);
		}

		this.getView().setUint32(24, octetCount);
	}

	protected getHeaderLength(): number {
		return HEADER_LENGTH;
	}
}
