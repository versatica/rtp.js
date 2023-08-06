import { Packet, PacketDump } from '../Packet';
import {
	isRtcp,
	RtcpPacketType,
	RtcpPacket,
	RtcpPacketDump,
	getRtcpPacketType,
	getRtcpLength
} from './RtcpPacket';
import { ReceiverReportPacket } from './ReceiverReportPacket';
import { SenderReportPacket } from './SenderReportPacket';
import { ByePacket } from './ByePacket';
import { UnknownPacket } from './UnknownPacket';

/**
 * RTCP Compound packet info dump.
 */
export type CompoundPacketDump = PacketDump &
{
	packets: RtcpPacketDump[];
};

/**
 * RTCP Compound packet.
 */
export class CompoundPacket extends Packet
{
	// RTCP packets.
	#packets: RtcpPacket[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP Compound
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP Compound packet.
	 */
	constructor(view?: DataView)
	{
		super(view);

		if (this.packetView && !isRtcp(this.packetView))
		{
			throw new TypeError('not a RTCP compound packet');
		}

		if (!this.packetView)
		{
			this.packetView = new DataView(new ArrayBuffer(0));

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Parse all RTCP packets.
		while (pos < this.packetView.byteLength)
		{
			const remainingView = new DataView(
				this.packetView.buffer,
				this.packetView.byteOffset + pos,
				this.packetView.byteLength - pos
			);

			const packetType = getRtcpPacketType(remainingView);
			const packetLength = getRtcpLength(remainingView);

			const packetView = new DataView(
				this.packetView.buffer,
				this.packetView.byteOffset + pos,
				packetLength
			);

			let packet: RtcpPacket | undefined;

			switch (packetType)
			{
				case RtcpPacketType.RR:
				{
					packet = new ReceiverReportPacket(packetView);

					break;
				}

				case RtcpPacketType.SR:
				{
					packet = new SenderReportPacket(packetView);

					break;
				}

				case RtcpPacketType.BYE:
				{
					packet = new ByePacket(packetView);

					break;
				}

				default:
				{
					packet = new UnknownPacket(packetView);
				}
			}

			pos += packetLength;

			if (packet)
			{
				this.#packets.push(packet);
			}
		}

		// Ensure that view length and parsed length match.
		if (pos !== this.packetView.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.packetView.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP Compound packet info.
	 */
	dump(): CompoundPacketDump
	{
		return {
			...super.dump(),
			packets : this.#packets.map((packet) => packet.dump())
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		const packetLength = this.#packets.reduce(
			(sum, packet) => sum + packet.getByteLength(),
			0
		);

		return packetLength;
	}

	/**
	 * Not implemented in RTCP Compound packet.
	 *
	 * @hidden
	 */
	getPadding(): number
	{
		return 0;
	}

	/**
	 * Not implemented in RTCP Compound packet.
	 *
	 * @hidden
	 */
	padTo4Bytes(): void
	{
		throw new Error('method not implemented in RTCP CompoundPacket');
	}

	/**
	 * @inheritDoc
	 */
	needsSerialization(): boolean
	{
		return (
			super.needsSerialization() ||
			this.#packets.some((packet) => packet.needsSerialization())
		);
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const packetLength = this.getByteLength();
		const { buffer, byteOffset } = this.getSerializationBuffer(packetLength);

		// Create new DataView with new buffer.
		const packetView = new DataView(buffer, byteOffset, packetLength);

		// Position relative to the DataView byte offset.
		let pos = 0;

		for (const packet of this.#packets)
		{
			// Serialize the RTCP packet into the current position.
			packet.prependOnceListener('will-serialize', (length, cb) =>
			{
				cb(packetView.buffer, packetView.byteOffset + pos);

				pos += length;
			});

			packet.serialize();
		}

		// Assert that current position is equal than new buffer length.
		if (pos !== packetView.byteLength)
		{
			throw new RangeError(
				`computed packet length (${pos} bytes) is different than the available buffer size (${packetView.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.packetView = packetView;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): CompoundPacket
	{
		const packetView = this.cloneInternal(buffer, byteOffset);

		return new CompoundPacket(packetView);
	}

	/**
	 * Return the {@link RtcpPacket} entries in this RTCP Compound packet.
	 */
	getPackets(): RtcpPacket[]
	{
		return Array.from(this.#packets);
	}

	/**
	 * Set the {@link RtcpPacket} entries in this RTCP Compound packet.
	 */
	setPackets(packets: RtcpPacket[]): void
	{
		this.#packets = Array.from(packets);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add a new {@link RtcpPacket} at the end of this RTCP Compound packet.
	 */
	addPacket(packet: RtcpPacket): void
	{
		this.#packets.push(packet);

		this.setSerializationNeeded(true);
	}
}
