import {
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacketDump,
} from './RtcpPacket.js';
import { FEEDBACK_HEADER_LENGTH } from './AnyFeedbackPacket.js';
import {
	AnyPayloadSpecificFeedbackPacket,
	PayloadSpecificFeedbackMessageType,
} from './AnyPayloadSpecificFeedbackPacket.js';
import { isUnsignedInteger, isUnsignedInteger32 } from '../../utils/numbers.js';
import {
	readBit,
	readBitsInDataView,
	writeBitsInDataView,
} from '../../utils/bits.js';

/**
 * Value of the Unique identifier field ('R' 'E' 'M' 'B').
 */
const UNIQUE_IDENTIFIER = 0x52454d42;

/**
 * Length (in bytes) of the fixed header that precedes the SSRCs, RTCP Common
 * Header included.
 */
const REMB_HEADER_LENGTH = 20;

/**
 * Maximum number of SSRCs in a packet (the Num SSRC field has 8 bits).
 */
const MAX_SSRCS = 255;

/**
 * Maximum value of the BR Mantissa field (18 bits).
 */
const MAX_MANTISSA = 0x3ffff;

/**
 * From here on (in bps) a bitrate does not fit in the signed 64 bits integer
 * in which receivers (such as libwebrtc and mediasoup) store it, so they
 * discard the packet.
 */
const BITRATE_OUT_OF_RANGE = 2 ** 63;

/**
 * RTCP REMB packet info dump.
 */
export type RembPacketDump = RtcpPacketDump & {
	/**
	 * Feedback message type.
	 */
	messageType: PayloadSpecificFeedbackMessageType;
	/**
	 * SSRC of the packet sender.
	 */
	senderSsrc: number;
	/**
	 * SSRC of the media source.
	 */
	mediaSsrc: number;
	/**
	 * Estimated maximum bitrate (in bits per second).
	 */
	bitrate: number;
	/**
	 * SSRCs the estimation applies to.
	 */
	ssrcs: number[];
};

/**
 * RTCP Receiver Estimated Maximum Bitrate (REMB) Application Layer Feedback
 * packet (PSFB 206, FMT 15).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P| FMT=15  |  PT=PSFB=206  |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     SSRC of packet sender                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                    SSRC of media source = 0                   |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |              Unique identifier 'R' 'E' 'M' 'B'                |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |   Num SSRC    |  BR Exp   |           BR Mantissa             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                         SSRC feedback                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * ```
 *
 * - Unique identifier (32 bits): Always 'R' 'E' 'M' 'B'.
 * - Num SSRC (8 bits): Number of SSRC feedback entries.
 * - BR Exp (6 bits): Exponential scaling of the mantissa for the maximum total
 *   media bitrate.
 * - BR Mantissa (18 bits): Unsigned mantissa of the maximum total media
 *   bitrate (in bps) of all media streams in the session.
 * - SSRC feedback (32 bits each): SSRCs of the media streams this estimation
 *   applies to.
 *
 * @remarks
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized. Modifications that need more bytes throw if
 *   the buffer has no space for them, in which case the packet is not
 *   modified.
 *
 * @see
 * - [draft-alvestrand-rmcat-remb-03](https://datatracker.ietf.org/doc/html/draft-alvestrand-rmcat-remb-03)
 */
export class RembPacket extends AnyPayloadSpecificFeedbackPacket {
	/**
	 * Whether the given buffer holds a REMB packet, this is, a RTCP
	 * Payload-Specific Feedback packet of Application Layer Feedback type
	 * whose Unique identifier is 'R' 'E' 'M' 'B'.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` can be
	 *   greater than the length of the packet.
	 *
	 * @remarks
	 * - The rest of the packet is not validated, {@link parse} does it.
	 *
	 * @internal
	 */
	static isRemb(buffer: Uint8Array): boolean {
		if (!isRtcp(buffer)) {
			return false;
		}

		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength
		);

		if (
			view.getUint8(1) !== (RtcpPacketType.PSFB as number) ||
			readBitsInDataView(view, 0, 0b00011111) !==
				(PayloadSpecificFeedbackMessageType.AFB as number)
		) {
			return false;
		}

		const packetLength = (view.getUint16(2) + 1) * 4;

		if (packetLength > buffer.byteLength) {
			return false;
		}

		const padding = readBit(view.getUint8(0), 5)
			? view.getUint8(packetLength - 1)
			: 0;

		// The Unique identifier comes right after the common header of every
		// feedback packet.
		if (packetLength - padding < FEEDBACK_HEADER_LENGTH + 4) {
			return false;
		}

		return view.getUint32(FEEDBACK_HEADER_LENGTH) === UNIQUE_IDENTIFIER;
	}

	/**
	 * Parse a RTCP REMB packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP REMB packet.
	 */
	static parse(buffer: Uint8Array): RembPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new RembPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.PSFB);
		packet.#validate();

		return packet;
	}

	/**
	 * Create a RTCP REMB packet with both SSRCs set to 0, bitrate 0 and no
	 * SSRC feedback entries.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than 20 bytes.
	 */
	static factory(buffer: Uint8Array): RembPacket {
		const packet = new RembPacket(buffer);

		packet.initializeHeader(
			RtcpPacketType.PSFB,
			PayloadSpecificFeedbackMessageType.AFB,
			REMB_HEADER_LENGTH
		);

		// Set SSRC of packet sender, SSRC of media source, Num SSRC, BR Exp and
		// BR Mantissa to 0.
		buffer.fill(0, COMMON_HEADER_LENGTH, REMB_HEADER_LENGTH);

		packet.getView().setUint32(FEEDBACK_HEADER_LENGTH, UNIQUE_IDENTIFIER);

		return packet;
	}

	/**
	 * Length (in bytes) of a RTCP REMB packet with the given number of SSRC
	 * feedback entries.
	 *
	 * @internal
	 */
	static computeLengthFor(numSsrcs: number): number {
		// Each SSRC takes 4 bytes, so the packet never needs padding.
		return REMB_HEADER_LENGTH + numSsrcs * 4;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP REMB packet info.
	 */
	override dump(): RembPacketDump {
		return {
			...super.dump(),
			messageType: this.getMessageType(),
			senderSsrc: this.getSenderSsrc(),
			mediaSsrc: this.getMediaSsrc(),
			bitrate: this.getBitrate(),
			ssrcs: this.getSsrcs(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): RembPacket {
		const clonedPacket = new RembPacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	/**
	 * Get the maximum total media bitrate (in bps).
	 */
	getBitrate(): number {
		const view = this.getView();
		const exponent = readBitsInDataView(view, 17, 0b11111100);
		const mantissa =
			readBitsInDataView(view, 17, 0b00000011) * 0x10000 + view.getUint16(18);

		// NOTE: Not using `<<` since it operates on 32 bits. The result is exact
		// since the mantissa has 18 bits.
		return mantissa * 2 ** exponent;
	}

	/**
	 * Set the maximum total media bitrate (in bps).
	 *
	 * @remarks
	 * - The bitrate is encoded as an 18 bits mantissa and a 6 bits exponent,
	 *   so the lowest bits of big values are lost.
	 *
	 * @throws
	 * - `TypeError` if `bitrate` is not an unsigned integer.
	 * - `TypeError` if `bitrate` does not fit in a signed 64 bits integer,
	 *   since receivers (such as libwebrtc and mediasoup) would discard the
	 *   packet.
	 */
	setBitrate(bitrate: number): void {
		if (!isUnsignedInteger(bitrate)) {
			throw new TypeError(`bitrate (${bitrate}) must be an unsigned integer`);
		} else if (bitrate >= BITRATE_OUT_OF_RANGE) {
			throw new TypeError(
				`bitrate (${bitrate}) does not fit in a signed 64 bits integer`
			);
		}

		let mantissa = bitrate;
		let exponent = 0;

		while (mantissa > MAX_MANTISSA) {
			mantissa = Math.floor(mantissa / 2);
			++exponent;
		}

		const view = this.getView();

		writeBitsInDataView(view, 17, 0b11111100, exponent);
		writeBitsInDataView(view, 17, 0b00000011, Math.floor(mantissa / 0x10000));
		view.setUint16(18, mantissa & 0xffff);
	}

	/**
	 * Get the SSRC feedback entries.
	 */
	getSsrcs(): number[] {
		const view = this.getView();
		const ssrcsCount = view.getUint8(16);
		const ssrcs: number[] = [];

		for (let idx = 0; idx < ssrcsCount; ++idx) {
			ssrcs.push(view.getUint32(REMB_HEADER_LENGTH + idx * 4));
		}

		return ssrcs;
	}

	/**
	 * Set the SSRC feedback entries. If `ssrcs` is not given (or if it's an
	 * empty array) all SSRC feedback entries are removed.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if more than 255 SSRCs are given.
	 * - `TypeError` if some SSRC is not an integer between 0 and 4294967295.
	 * - `TypeError` if the buffer has no space for the given SSRCs.
	 */
	setSsrcs(ssrcs: number[] = []): void {
		if (ssrcs.length > MAX_SSRCS) {
			throw new TypeError(
				`cannot set more than ${MAX_SSRCS} SSRCs (${ssrcs.length} given)`
			);
		}

		for (const ssrc of ssrcs) {
			this.#assertSsrc(ssrc);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(
			REMB_HEADER_LENGTH - COMMON_HEADER_LENGTH + ssrcs.length * 4
		);

		const view = this.getView();

		for (const [idx, ssrc] of ssrcs.entries()) {
			view.setUint32(REMB_HEADER_LENGTH + idx * 4, ssrc);
		}

		view.setUint8(16, ssrcs.length);
	}

	/**
	 * Add a SSRC feedback entry at the end of the packet.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if the packet already has 255 SSRCs.
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295.
	 * - `TypeError` if the buffer has no space for the SSRC.
	 */
	addSsrc(ssrc: number): void {
		const view = this.getView();
		const ssrcsCount = view.getUint8(16);

		if (ssrcsCount === MAX_SSRCS) {
			throw new TypeError(`cannot add more than ${MAX_SSRCS} SSRCs`);
		}

		this.#assertSsrc(ssrc);

		const pos = REMB_HEADER_LENGTH + ssrcsCount * 4;

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(pos + 4 - COMMON_HEADER_LENGTH);

		view.setUint32(pos, ssrc);
		view.setUint8(16, ssrcsCount + 1);
	}

	#validate(): void {
		const view = this.getView();

		if (this.getMessageType() !== PayloadSpecificFeedbackMessageType.AFB) {
			throw new TypeError('not a RTCP AFB packet');
		}

		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();

		if (contentLength < REMB_HEADER_LENGTH) {
			throw new TypeError(
				`packet length (${contentLength} bytes, excluding padding) is lower than ${REMB_HEADER_LENGTH} bytes`
			);
		} else if (view.getUint32(FEEDBACK_HEADER_LENGTH) !== UNIQUE_IDENTIFIER) {
			throw new TypeError('not a RTCP REMB packet');
		}

		const ssrcsCount = view.getUint8(16);

		// The packet (excluding padding) must end right after the announced
		// SSRCs.
		if (contentLength !== REMB_HEADER_LENGTH + ssrcsCount * 4) {
			throw new TypeError(
				`packet length (${contentLength} bytes, excluding padding) does not match the number of SSRCs (${ssrcsCount})`
			);
		}

		const bitrate = this.getBitrate();

		if (bitrate >= BITRATE_OUT_OF_RANGE) {
			throw new TypeError(
				`bitrate (${bitrate}) does not fit in a signed 64 bits integer`
			);
		}
	}

	/**
	 * @throws
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295.
	 */
	#assertSsrc(ssrc: number): void {
		if (!isUnsignedInteger32(ssrc)) {
			throw new TypeError(
				`ssrc (${ssrc}) must be an integer between 0 and 4294967295`
			);
		}
	}
}
