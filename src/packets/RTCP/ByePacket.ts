import {
	RtcpPacket,
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacketDump,
} from './RtcpPacket.js';
import { isUnsignedInteger32 } from '../../utils/numbers.js';
import { padTo4Bytes } from '../../utils/buffers.js';

/**
 * Maximum number of SSRC/CSRC values (the Count field has 5 bits).
 */
const MAX_SSRCS = 31;

/**
 * Maximum length (in bytes) of the Reason field.
 */
const MAX_REASON_LENGTH = 255;

const textEncoder = new TextEncoder();
// NOTE: `ignoreBOM` keeps a leading byte order mark in the decoded text, so
// valid UTF-8 is written back byte by byte as it was.
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });

/**
 * RTCP BYE packet info dump.
 */
export type ByePacketDump = RtcpPacketDump & {
	/**
	 * SSRCs of the sources leaving.
	 */
	ssrcs: number[];
	/**
	 * Reason for leaving, if any.
	 */
	reason?: string;
};

/**
 * RTCP BYE packet.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|    SC   |   PT=BYE=203  |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                           SSRC/CSRC                           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * | Reason length |               Reason for leaving            ...
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * - Source count (SC) (5 bits): The number of SSRC/CSRC identifiers
 *   included in this BYE packet.
 * - Reason length (8 bits): Number of bytes of text indicating the reason
 *   for leaving.
 * - Reason for leaving (variable length): If the string fills the packet to
 *   the next 32-bit boundary, the string is not null terminated. If not, the
 *   BYE packet MUST be padded with null octets to the next 32-bit boundary.
 *
 * @remarks
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized. Modifications that need more bytes throw if
 *   the buffer has no space for them, in which case the packet is not
 *   modified.
 *
 * @see
 * - [RFC 3550 section 6.6](https://datatracker.ietf.org/doc/html/rfc3550#section-6.6)
 */
export class ByePacket extends RtcpPacket {
	/**
	 * Parse a RTCP BYE packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP BYE packet.
	 */
	static parse(buffer: Uint8Array): ByePacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new ByePacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.BYE);
		packet.#validate();

		return packet;
	}

	/**
	 * Create a RTCP BYE packet with no SSRC/CSRC values and no reason.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than the length of the
	 *   Common Header.
	 */
	static factory(buffer: Uint8Array): ByePacket {
		const packet = new ByePacket(buffer);

		packet.initializeHeader(RtcpPacketType.BYE, 0, COMMON_HEADER_LENGTH);

		return packet;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP BYE packet info.
	 */
	override dump(): ByePacketDump {
		return {
			...super.dump(),
			ssrcs: this.getSsrcs(),
			reason: this.getReason(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): ByePacket {
		const clonedPacket = new ByePacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	/**
	 * Get the SSRC/CSRC values.
	 */
	getSsrcs(): number[] {
		const view = this.getView();
		const ssrcs: number[] = [];

		for (let idx = 0; idx < this.getCount(); ++idx) {
			ssrcs.push(view.getUint32(COMMON_HEADER_LENGTH + idx * 4));
		}

		return ssrcs;
	}

	/**
	 * Set the SSRC/CSRC values. If `ssrcs` is not given (or if it's an empty
	 * array) all SSRC/CSRC values are removed.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if more than 31 SSRC/CSRC values are given.
	 * - `TypeError` if some SSRC/CSRC value is not an integer between 0 and
	 *   4294967295.
	 * - `TypeError` if the buffer has no space for the given SSRC/CSRC values.
	 */
	setSsrcs(ssrcs: number[] = []): void {
		if (ssrcs.length > MAX_SSRCS) {
			throw new TypeError(
				`cannot set more than ${MAX_SSRCS} SSRC/CSRC values (${ssrcs.length} given)`
			);
		}

		for (const ssrc of ssrcs) {
			if (!isUnsignedInteger32(ssrc)) {
				throw new TypeError(
					`SSRC/CSRC (${ssrc}) must be an integer between 0 and 4294967295`
				);
			}
		}

		const previousReasonOffset = this.#getReasonOffset();
		const reasonOffset = COMMON_HEADER_LENGTH + ssrcs.length * 4;
		const reasonFieldsLength = this.#hasReason()
			? padTo4Bytes(1 + this.#getReasonLength())
			: 0;
		const bodyLength = reasonOffset - COMMON_HEADER_LENGTH + reasonFieldsLength;

		// Move the Reason fields (if any) to their new position. If the packet
		// grows, its length must be updated before moving them. If it shrinks,
		// after moving them.
		if (reasonOffset > previousReasonOffset) {
			// NOTE: This throws if there is no space in the buffer.
			this.setBodyLength(bodyLength);

			this.getBuffer().copyWithin(
				reasonOffset,
				previousReasonOffset,
				previousReasonOffset + reasonFieldsLength
			);
		} else {
			this.getBuffer().copyWithin(
				reasonOffset,
				previousReasonOffset,
				previousReasonOffset + reasonFieldsLength
			);

			this.setBodyLength(bodyLength);
		}

		const view = this.getView();

		for (const [idx, ssrc] of ssrcs.entries()) {
			view.setUint32(COMMON_HEADER_LENGTH + idx * 4, ssrc);
		}

		this.setCount(ssrcs.length);
	}

	/**
	 * Add a SSRC/CSRC value.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if the packet already has 31 SSRC/CSRC values.
	 * - Same as {@link setSsrcs}.
	 */
	addSsrc(ssrc: number): void {
		if (this.getCount() === MAX_SSRCS) {
			throw new TypeError(`cannot add more than ${MAX_SSRCS} SSRC/CSRC values`);
		}

		this.setSsrcs([...this.getSsrcs(), ssrc]);
	}

	/**
	 * Get the reason for leaving, or `undefined` if the packet has no Reason
	 * fields.
	 */
	getReason(): string | undefined {
		if (!this.#hasReason()) {
			return undefined;
		}

		const reasonPos = this.#getReasonOffset() + 1;

		return textDecoder.decode(
			this.getBuffer().subarray(reasonPos, reasonPos + this.#getReasonLength())
		);
	}

	/**
	 * Set the reason for leaving. If not given (or if it's an empty string),
	 * the Reason fields are removed.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if the UTF-8 encoded `reason` is longer than 255 bytes.
	 * - `TypeError` if the buffer has no space for the given reason.
	 */
	setReason(reason?: string): void {
		const value = reason ? textEncoder.encode(reason) : undefined;

		if (value && value.byteLength > MAX_REASON_LENGTH) {
			throw new TypeError(
				`reason length (${value.byteLength} bytes) cannot be greater than ${MAX_REASON_LENGTH} bytes`
			);
		}

		const reasonOffset = this.#getReasonOffset();
		const reasonFieldsLength = value ? padTo4Bytes(1 + value.byteLength) : 0;

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(
			reasonOffset - COMMON_HEADER_LENGTH + reasonFieldsLength
		);

		if (!value) {
			return;
		}

		this.getView().setUint8(reasonOffset, value.byteLength);
		this.getBuffer().set(value, reasonOffset + 1);
		this.fillPadding(reasonFieldsLength - 1 - value.byteLength);
	}

	#validate(): void {
		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();
		const reasonOffset = this.#getReasonOffset();

		if (reasonOffset > contentLength) {
			throw new TypeError('SSRC/CSRC count exceeds the packet length');
		}

		if (!this.#hasReason()) {
			return;
		}

		const reasonLength = this.#getReasonLength();
		const reasonEndOffset = reasonOffset + 1 + reasonLength;

		if (reasonEndOffset > contentLength) {
			throw new TypeError(
				`Reason length (${reasonLength} bytes) exceeds the packet length`
			);
		}
		// The Reason is padded to the next 32-bit boundary, and that is the end
		// of the packet (excluding padding).
		else if (padTo4Bytes(reasonEndOffset) !== contentLength) {
			throw new TypeError(
				`packet length (${contentLength} bytes, excluding padding) does not end right after the padded Reason (${padTo4Bytes(reasonEndOffset)} bytes)`
			);
		}

		// The Reason must be padded with null octets.
		const view = this.getView();

		for (let pos = reasonEndOffset; pos < contentLength; ++pos) {
			if (view.getUint8(pos) !== 0) {
				throw new TypeError('Reason padding bytes must be zero');
			}
		}
	}

	/**
	 * Position where the Reason length field (if any) begins.
	 */
	#getReasonOffset(): number {
		return COMMON_HEADER_LENGTH + this.getCount() * 4;
	}

	#hasReason(): boolean {
		return this.getLength() - this.getPadding() > this.#getReasonOffset();
	}

	/**
	 * Value of the Reason length field.
	 *
	 * @remarks
	 * - It must only be called if the packet has Reason fields.
	 */
	#getReasonLength(): number {
		return this.getView().getUint8(this.#getReasonOffset());
	}
}
