import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	getRtcpPacketType,
	getRtcpLength
} from './RtcpPacket';
import {
	dataViewToString,
	stringToUint8Array,
	getStringByteLength
} from '../utils';

/**
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|    SC   |   PT=BYE=203  |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                           SSRC/CSRC                           |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        :                              ...                              :
 *        +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * (opt)  |     length    |               reason for leaving            ...
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 */

// Common RTCP header length.
const FIXED_HEADER_LENGTH = 4;

/**
 * RTCP Bye packet dump.
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
	// SSRC/CSRC array.
	#ssrcs: number[] = [];
	// Termination season.
	#reason?: string;

	/**
	 * @param view - If given if will be parsed. Otherwise an empty RTCP Bye
	 *   packet (with just the minimal fixed header) will be created.
	 *
	 * @throws
	 * If `view` is given and it does not contain a valid RTCP Bye packet.
	 */
	constructor(view?: DataView)
	{
		super(RtcpPacketType.BYE, view);

		if (!view)
		{
			this.packetView = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			return;
		}

		if (getRtcpPacketType(view) !== RtcpPacketType.BYE)
		{
			throw new TypeError('not a RTCP Bye packet');
		}
		else if (getRtcpLength(view) !== view.byteLength)
		{
			throw new RangeError(
				`length in the RTCP header (${getRtcpLength(view)} bytes) does not match view length (${view.byteLength} bytes)`
			);
		}

		this.packetView = view;

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Get padding.
		if (this.getPaddingBit())
		{
			this.padding = this.packetView.getUint8(this.packetView.byteLength - 1);
		}

		// Move to SSRC field(s).
		pos += FIXED_HEADER_LENGTH;

		let count = this.getCount();

		while (count-- > 0)
		{
			const ssrc = this.packetView.getUint32(pos);

			this.#ssrcs.push(ssrc);

			pos += 4;
		}

		// Check if there is reason.
		if (pos + this.padding < this.packetView.byteLength)
		{
			const reasonLength = this.packetView.getUint8(pos);
			const reasonPadding = -(reasonLength + 1) & 3;

			// Move to the reason field.
			pos += 1;

			if (
				pos + reasonLength + reasonPadding + this.padding !==
				this.packetView.byteLength
			)
			{
				throw new TypeError('invalid RTCP BYE packet');
			}

			const reasonView = new DataView(
				this.packetView.buffer,
				this.packetView.byteOffset + pos,
				reasonLength
			);

			this.#reason = dataViewToString(reasonView);

			pos += reasonLength + reasonPadding;
		}

		if (pos !== this.packetView.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.packetView.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP Bye packet info.
	 */
	dump(): ByePacketDump
	{
		return {
			...super.dump(),
			ssrcs  : this.#ssrcs,
			reason : this.#reason
		};
	}

	/**
	 * Computes total length of the packet (in bytes) including padding if any.
	 *
	 * @remarks
	 * Value returned by this method may not match the byte length of the packet's
	 * `DataView`. This could happen if the original packet contains useless
	 * padding or alignment in the reason field. Anyway, the value returned by
	 * this method matches the byte length of the `DataView` once the packet is
	 * serialized.
	 */
	getByteLength(): number
	{
		let packetLength = FIXED_HEADER_LENGTH + (this.#ssrcs.length * 4);

		if (this.#reason)
		{
			const reasonLength = getStringByteLength(this.#reason);
			const reasonPadding = -(reasonLength + 1) & 3;

			packetLength += 1 + reasonLength + reasonPadding;
		}

		packetLength += this.padding;

		return packetLength;
	}

	/**
	 * Get SSRC values.
	 */
	getSsrcs(): number[]
	{
		return Array.from(this.#ssrcs);
	}

	/**
	 * Set SSRC values.
	 *
	 * @remarks
	 * Serialization is needed after calling this method.
	 */
	setSsrcs(ssrcs: number[] = []): void
	{
		this.#ssrcs = ssrcs;

		// Update RTCP count.
		this.setCount(this.#ssrcs.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get reason.
	 */
	getReason(): string | undefined
	{
		return this.#reason;
	}

	/**
	 * Set reason.
	 */
	setReason(reason?: string): void
	{
		this.#reason = reason;

		this.setSerializationNeeded(true);
	}

	/**
	 * Apply pending changes into the packet and serialize it into a new buffer.
	 *
	 * @remarks
	 * In most cases there is no need to use this method since many setter methods
	 * apply the changes within the current buffer. To be sure, check
	 * {@link needsSerialization} before.
	 *
	 * @throws
	 * If serialization fails due invalid fields were previously added to the
	 * packet.
	 */
	serialize(): void
	{
		const packetView = super.serializeBase();

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to SSRCs/CSRCs.
		pos += FIXED_HEADER_LENGTH;

		for (let i = 0; i < this.#ssrcs.length; ++i)
		{
			const ssrc = this.#ssrcs[i];

			packetView.setUint32(pos, ssrc);

			pos += 4;
		}

		if (this.#reason)
		{
			const reasonUint8Array = stringToUint8Array(this.#reason);
			const reasonLength = reasonUint8Array.byteLength;
			const reasonPadding = -(reasonLength + 1) & 3;
			const packetUint8Array = new Uint8Array(
				packetView.buffer,
				packetView.byteOffset,
				packetView.byteLength
			);

			// Write reason length.
			packetView.setUint8(pos, reasonLength);

			// Move to reason field.
			pos += 1;

			// Copy reason.
			packetUint8Array.set(reasonUint8Array, pos);

			// Move to padding.
			pos += reasonLength + reasonPadding;
		}

		// Assert that current position is equal or less than new buffer length.
		// NOTE: Don't be strict matching resulting length since we may have
		// discarded/reduced some padding/alignment bytes during the process.
		if (pos > packetView.byteLength)
		{
			throw new RangeError(
				`computed packet length (${pos} bytes) is bigger than the available buffer size (${packetView.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.packetView = packetView;

		this.setSerializationNeeded(false);
	}

	/**
	 * Clone the packet. The cloned packet does not share any memory with the
	 * original one.
	 *
	 * @param buffer - Buffer in which the packet will be serialized. If not given,
	 *   a new one will internally allocated.
	 * @param byteOffset - Byte offset of the given `buffer` when serialization must
	 *   be done.
	 *
	 * @remarks
	 * The buffer is serialized if needed (to apply packet pending modifications).
	 *
	 * @throws
	 * If buffer serialization is needed and it fails due to invalid fields or if
	 * `buffer` is given and it doesn't hold enough space serializing the packet.
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): ByePacket
	{
		const destPacketView = this.cloneInternal(buffer, byteOffset);

		return new ByePacket(destPacketView);
	}
}
