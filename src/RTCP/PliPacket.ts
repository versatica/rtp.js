import { RtcpPacketType } from './RtcpPacket';
import {
	FeedbackPacket,
	PsFeedbackMessageType,
	FeedbackPacketDump,
	FIXED_HEADER_LENGTH
} from './FeedbackPacket';

/**
 * RTCP PLI packet info dump.
 */
export type PliPacketDump = FeedbackPacketDump;

/**
 * RTCP PLI packet.
 *
 *
 * @see
 * - [RFC 4585 section 6.3.1](https://datatracker.ietf.org/doc/html/rfc4585#section-6.3.1)
 *
 * @emits
 * - will-serialize: {@link WillSerializeEvent}
 */
export class PliPacket extends FeedbackPacket
{
	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP PLI
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP PLI packet.
	 */
	constructor(view?: DataView)
	{
		super(RtcpPacketType.PSFB, PsFeedbackMessageType.PLI, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version, packet type and feedback message type.
			this.writeFixedHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to padding.
		pos += FIXED_HEADER_LENGTH;

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP PLI packet info.
	 */
	dump(): PliPacketDump
	{
		return {
			...super.dump()
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		if (!this.needsSerialization())
		{
			return this.view.byteLength;
		}

		const packetLength = FIXED_HEADER_LENGTH + this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const view = super.serializeBase();

		// Nothing else to do.

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): PliPacket
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new PliPacket(view);
	}
}