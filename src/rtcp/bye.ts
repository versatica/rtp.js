import { isRtcp, RtcpPacket, RtcpPacketType, RtcpPacketDump } from './';
import { clone, arrayBufferToString, stringToArrayBuffer } from '../utils';

/**
        0                   1                   2                   3
        0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
header |V=2|P|    SC   |   PT=BYE=203  |             length            |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                           SSRC/CSRC                           |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       :                              ...                              :
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
(opt)  |     length    |               reason for leaving            ...
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 */

// SSRC/CSRC length.
const SSRC_LENGTH = 4;
// Common RTCP header length.
const FIXED_HEADER_LENGTH = 4;

/**
 * Bye packet dump.
 */
export type ByePacketDump = RtcpPacketDump &
{
	ssrcs: number[];
	reason?: string;
};

/**
 * ```ts
 * import { ByePacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Bye packet.
 */
export class ByePacket extends RtcpPacket
{
	// Packet Type.
	static packetType = RtcpPacketType.BYE;

	// SSRC/CSRC array.
	private readonly ssrcs: number[] = [];

	// Termination season.
	private reason?: string;

	/**
	 * @param buffer - If given it will be parsed. Otherwise an empty RTP packet
	 *   will be created.
	 */
	constructor(buffer?: ArrayBuffer)
	{
		super(ByePacket.packetType);

		// If no buffer is given, create an empty one with minimum required length.
		if (!buffer)
		{
			this.buffer = new ArrayBuffer(FIXED_HEADER_LENGTH);
			this.view = new DataView(this.buffer);

			this.writeCommonHeader();

			return;
		}

		if (!isRtcp(buffer))
		{
			throw new TypeError('invalid RTCP packet');
		}

		this.buffer = buffer;
		this.view = new DataView(this.buffer);

		if (this.getPaddingBit())
		{
			// NOTE: This will throw RangeError if there is no space in the buffer.
			this.padding =
				this.view.getUint8(((RtcpPacket.getLength(this.buffer) * 4) + 4 - 1));
		}

		let count = RtcpPacket.getCount(this.buffer);

		if (this.buffer.byteLength < FIXED_HEADER_LENGTH + (count * SSRC_LENGTH))
		{
			throw new TypeError(`buffer is too small (${this.buffer.byteLength} bytes)`);
		}

		let offset = FIXED_HEADER_LENGTH;

		while (count-- > 0)
		{
			const ssrc = this.view.getUint32(offset);

			// NOTE: We don't call this.addSsrc() here because we don't want that
			// serialization is needed when parsing a packet.

			this.ssrcs.push(ssrc);

			this.setCount(this.ssrcs.length);

			offset += SSRC_LENGTH;
		}

		const size = (RtcpPacket.getLength(this.buffer) * 4) + 4;

		if (offset + this.padding < size)
		{
			const reasonLength = this.view.getUint8(offset);
			const reasonPadding = -(reasonLength + 1) & 3;

			if (offset + this.padding + reasonLength + 1 + reasonPadding !== size)
			{
				throw new TypeError('invalid RTCP BYE packet');
			}

			offset += 1;

			const reasonBuffer = this.buffer.slice(offset, offset + reasonLength);

			this.reason = arrayBufferToString(reasonBuffer);

			offset += reasonLength;
			offset += reasonPadding;
		}

		// Store a buffer within the packet boundaries.
		this.buffer = buffer.slice(0, offset + this.padding);
		this.view = new DataView(this.buffer);

		offset += this.padding;

		if (offset !== this.buffer.byteLength)
		{
			throw new RangeError(
				`parsed length (${offset} bytes) does not match buffer length (${this.buffer.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump Bye packet info.
	 */
	dump(): ByePacketDump
	{
		return {
			...super.dump(),
			ssrcs  : this.ssrcs,
			reason : this.reason
		};
	}

	/**
	 * Get SSRCs.
	 */
	getSsrcs(): number[]
	{
		return this.ssrcs;
	}

	/**
	 * Add a SSRC.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 */
	addSsrc(ssrc: number): void
	{
		this.ssrcs.push(ssrc);

		this.setCount(this.ssrcs.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get reason.
	 */
	getReason(): string | undefined
	{
		return this.reason;
	}

	/**
	 * Set reason.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 */
	setReason(reason?: string): void
	{
		this.reason = reason;

		this.setSerializationNeeded(true);
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
	clone(): ByePacket
	{
		if (this.needsSerialization())
		{
			this.serialize();
		}

		return new ByePacket(clone<ArrayBuffer>(this.buffer));
	}

	/**
	 * Apply pending changes into the packet and serialize it into a new internal
	 * buffer (the one that {@link getBuffer} will later return).
	 *
	 * @remarks
	 * In most cases there is no need to use this method since many setter methods
	 * apply the changes within the current buffer. To be sure, check
	 * {@link needsSerialization} before.
	 *
	 * @throws If invalid fields were previously added to the packet.
	 */
	serialize(): void
	{
		// Compute required buffer length.
		let length = FIXED_HEADER_LENGTH + (SSRC_LENGTH * this.ssrcs.length);
		let reasonBuffer: ArrayBuffer | undefined;

		if (this.reason)
		{
			reasonBuffer = stringToArrayBuffer(this.reason);
			length += 1 + reasonBuffer.byteLength + (-(reasonBuffer.byteLength + 1) & 3);
		}

		super.serializeBase(length);

		this.setCount(this.ssrcs.length);

		let offset = FIXED_HEADER_LENGTH;

		for (let i = 0; i < this.ssrcs.length; ++i)
		{
			const ssrc = this.ssrcs[i];

			this.view.setUint32(offset, ssrc);

			offset += SSRC_LENGTH;
		}

		if (reasonBuffer)
		{
			this.view.setUint8(offset, reasonBuffer.byteLength);

			offset += 1;

			const array = new Uint8Array(this.buffer);

			array.set(new Uint8Array(reasonBuffer), offset);

			const reasonPadding = -(reasonBuffer.byteLength + 1) & 3;

			// Write reason padding.
			if (reasonPadding)
			{
				offset += reasonBuffer.byteLength;

				array.fill(0, offset, offset + reasonPadding);
			}
		}

		this.setSerializationNeeded(false);
	}
}
