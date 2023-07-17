import { isRtcp, RtcpPacket, RtcpPacketType, RtcpPacketDump } from './';
import { clone } from '../utils';

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
	constructor(buffer?: Buffer)
	{
		super(ByePacket.packetType);

		// If no buffer is given, create an empty one with minimum required length.
		if (!buffer)
		{
			this.buffer = Buffer.alloc(FIXED_HEADER_LENGTH);
			this.writeCommonHeader();

			return;
		}

		if (!isRtcp(buffer))
		{
			throw new TypeError('invalid RTCP packet');
		}

		// Get padding.
		const paddingFlag = Boolean((buffer.readUInt8() >> 5) & 1);

		if (paddingFlag)
		{
			// NOTE: This will throw RangeError if there is no space in the buffer.
			this.padding = buffer.readUInt8(((RtcpPacket.getLength(buffer) * 4) + 4 - 1));
		}

		let count = RtcpPacket.getCount(buffer);

		if (buffer.length < FIXED_HEADER_LENGTH + (count * SSRC_LENGTH))
		{
			throw new TypeError('buffer is too small');
		}

		let offset = FIXED_HEADER_LENGTH;

		while (count-- > 0)
		{
			const ssrc = buffer.readUInt32BE(offset);

			this.addSsrc(ssrc);

			offset += SSRC_LENGTH;
		}

		const size = (RtcpPacket.getLength(buffer) * 4) + 4;

		if (offset + this.padding < size)
		{
			const reasonLength = buffer.readUInt8(offset);
			const reasonPadding = -(reasonLength + 1) & 3;

			if (offset + this.padding + reasonLength + 1 + reasonPadding !== size)
			{
				throw new TypeError('invalid RTCP BYE packet');
			}

			offset += 1;

			this.reason = buffer.slice(offset, offset + reasonLength).toString('utf8');

			offset += reasonLength;
		}

		// Store a buffer within the packet boundaries.
		this.buffer = buffer.slice(undefined, offset + this.padding);
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
	 */
	addSsrc(ssrc: number): void
	{
		this.ssrcs.push(ssrc);
		this.serializationNeeded = true;
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
	 */
	setReason(reason?: string): void
	{
		this.reason = reason;
		this.serializationNeeded = true;
	}

	/**
	 * Clone the packet. The cloned packet does not share any memory with the
	 * original one.
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 */
	clone(): ByePacket
	{
		if (this.serializationNeeded)
		{
			this.serialize();
		}

		return new ByePacket(clone(this.buffer));
	}

	/**
	 * Apply pending changes into the packet and serialize it into a new internal
	 * buffer (the one that {@link getBuffer} will later return).
	 *
	 * @remarks
	 * In most cases there is no need to use this method. It must be
	 * called only if the application retrieves information from the packet (by
	 * calling {@link getBuffer}, {@link getSsrcs}, etc) and modifies the
	 * obtained buffers in place. However, it's recommended to use the existing
	 * setter methods instead ({@link addSsrc}, etc).
	 *
	 * @throws If buffer serialization is needed and it fails due to invalid
	 *   fields.
	 *
	 */
	serialize(): void
	{
		// Compute required buffer length.
		let length = FIXED_HEADER_LENGTH + (SSRC_LENGTH * this.ssrcs.length);

		if (this.reason)
		{
			length += this.reason.length + 1 + (-(this.reason.length + 1) & 3);
		}

		super.serializeBase(length);

		this.setCount(this.ssrcs.length);

		let offset = FIXED_HEADER_LENGTH;

		for (let i=0; i < this.ssrcs.length; ++i)
		{
			const ssrc = this.ssrcs[i];

			this.buffer.writeUInt32BE(ssrc, offset);

			offset += SSRC_LENGTH;
		}

		if (this.reason)
		{
			this.buffer.writeUInt8(this.reason.length, offset);

			offset += 1;

			const reasonBuffer = Buffer.from(this.reason, 'utf8');

			reasonBuffer.copy(this.buffer, offset, 0, reasonBuffer.length);

			const reasonPadding = -(this.reason.length + 1) & 3;

			// Write reason padding.
			if (reasonPadding)
			{
				this.buffer.fill(0, offset, reasonPadding);
			}
		}

		// Reset flag.
		this.serializationNeeded = false;
	}
}
