import { Packet, PacketDump } from '../Packet.mts';
import {
	isRtcp,
	RtcpPacketType,
	RtcpPacket,
	RtcpPacketDump,
	getRtcpPacketType,
	getRtcpLength,
} from './RtcpPacket.mts';
import { ReceiverReportPacket } from './ReceiverReportPacket.mts';
import { SenderReportPacket } from './SenderReportPacket.mts';
import { ByePacket } from './ByePacket.mts';
import { SdesPacket } from './SdesPacket.mts';
import {
	RtpFeedbackMessageType,
	PsFeedbackMessageType,
	getRtcpFeedbackMessageType,
} from './FeedbackPacket.mts';
import { NackPacket } from './NackPacket.mts';
import { SrReqPacket } from './SrReqPacket.mts';
import { EcnPacket } from './EcnPacket.mts';
import { PliPacket } from './PliPacket.mts';
import { SliPacket } from './SliPacket.mts';
import { RpsiPacket } from './RpsiPacket.mts';
import { GenericFeedbackPacket } from './GenericFeedbackPacket.mts';
import { XrPacket } from './XrPacket.mts';
import { ExtendedJitterReportsPacket } from './ExtendedJitterReportsPacket.mts';
import { GenericPacket } from './GenericPacket.mts';

/**
 * RTCP Compound packet info dump.
 *
 * @category RTCP
 */
export type CompoundPacketDump = PacketDump & {
	packets: RtcpPacketDump[];
};

/**
 * RTCP Compound packet.
 *
 * @category RTCP
 *
 * @see
 * - [RFC 3550](https://datatracker.ietf.org/doc/html/rfc3550)
 */
export class CompoundPacket extends Packet {
	// RTCP packets.
	#packets: RtcpPacket[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP Compound
	 *   packet will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP Compound packet.
	 */
	constructor(view?: DataView) {
		super(view);

		if (this.view && !isRtcp(this.view)) {
			throw new TypeError('not a RTCP compound packet');
		}

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(0));

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Parse all RTCP packets.
		while (pos < this.view.byteLength) {
			const remainingView = new DataView(
				this.view.buffer,
				this.view.byteOffset + pos,
				this.view.byteLength - pos
			);

			const packetLength = getRtcpLength(remainingView);

			const packetView = new DataView(
				this.view.buffer,
				this.view.byteOffset + pos,
				packetLength
			);

			let packet: RtcpPacket;

			switch (getRtcpPacketType(remainingView)) {
				case RtcpPacketType.RR: {
					packet = new ReceiverReportPacket(packetView);

					break;
				}

				case RtcpPacketType.SR: {
					packet = new SenderReportPacket(packetView);

					break;
				}

				case RtcpPacketType.BYE: {
					packet = new ByePacket(packetView);

					break;
				}

				case RtcpPacketType.SDES: {
					packet = new SdesPacket(packetView);

					break;
				}

				case RtcpPacketType.RTPFB: {
					switch (getRtcpFeedbackMessageType(packetView)) {
						case RtpFeedbackMessageType.NACK: {
							packet = new NackPacket(packetView);

							break;
						}

						case RtpFeedbackMessageType.SR_REQ: {
							packet = new SrReqPacket(packetView);

							break;
						}

						case RtpFeedbackMessageType.ECN: {
							packet = new EcnPacket(packetView);

							break;
						}

						default: {
							packet = new GenericFeedbackPacket(packetView);
						}
					}

					break;
				}

				case RtcpPacketType.PSFB: {
					switch (getRtcpFeedbackMessageType(packetView)) {
						case PsFeedbackMessageType.PLI: {
							packet = new PliPacket(packetView);

							break;
						}

						case PsFeedbackMessageType.SLI: {
							packet = new SliPacket(packetView);

							break;
						}

						case PsFeedbackMessageType.RPSI: {
							packet = new RpsiPacket(packetView);

							break;
						}

						default: {
							packet = new GenericFeedbackPacket(packetView);
						}
					}

					break;
				}

				case RtcpPacketType.XR: {
					packet = new XrPacket(packetView);

					break;
				}

				case RtcpPacketType.IJ: {
					packet = new ExtendedJitterReportsPacket(packetView);

					break;
				}

				default: {
					packet = new GenericPacket(packetView);
				}
			}

			pos += packetLength;

			this.#packets.push(packet);
		}

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength) {
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump RTCP Compound packet info.
	 */
	override dump(): CompoundPacketDump {
		return {
			...super.dump(),
			packets: this.#packets.map(packet => packet.dump()),
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		if (!this.needsSerialization()) {
			return this.view.byteLength;
		}

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
	override getPadding(): number {
		return 0;
	}

	/**
	 * Not implemented in RTCP Compound packet.
	 *
	 * @hidden
	 */
	override padTo4Bytes(): void {
		throw new Error('method not implemented in RTCP CompoundPacket');
	}

	/**
	 * @inheritDoc
	 */
	override needsSerialization(): boolean {
		return (
			super.needsSerialization() ||
			this.#packets.some(packet => packet.needsSerialization())
		);
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBufferLike, byteOffset?: number): void {
		const bufferData = this.getSerializationBuffer(buffer, byteOffset);

		// Create new DataView with new buffer.
		const view = new DataView(
			bufferData.buffer,
			bufferData.byteOffset,
			bufferData.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		for (const packet of this.#packets) {
			packet.serialize(view.buffer, view.byteOffset + pos);

			pos += packet.getByteLength();
		}

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength) {
			throw new RangeError(
				`filled length (${pos} bytes) is different than the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(
		buffer?: ArrayBufferLike,
		byteOffset?: number,
		serializationBuffer?: ArrayBufferLike,
		serializationByteOffset?: number
	): CompoundPacket {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new CompoundPacket(view);
	}

	/**
	 * Return the {@link RtcpPacket} entries in this RTCP Compound packet.
	 *
	 * @remarks
	 * - The returned value is an array of {@link RtcpPacket}, which is an
	 *   abstract class.
	 * - By inspecting {@link RtcpPacket.getPacketType} we can cast each packet
	 *   to its specific class.
	 *
	 * @example
	 * ```ts
	 * import { packets } from 'rtp.js';
	 * const { CompoundPacket, RtcpPacketType, SdesPacket } = packets;
	 *
	 * const compoundPacket = new CompoundPacket(view);
	 *
	 * for (const packet of compoundPacket.getPackets())
	 * {
	 *   switch (packet.getPacketType())
	 *   {
	 *     case RtcpPacketType.SDES:
	 *     {
	 *       const sdesPacket = packet as SdesPacket;
	 *
	 *       console.log(sdesPacket.getChunks());
	 *
	 *       break;
	 *     }
	 *
	 *     // etc.
	 *   }
	 * }
	 * ```
	 */
	getPackets(): RtcpPacket[] {
		return Array.from(this.#packets);
	}

	/**
	 * Set the {@link RtcpPacket} entries in this RTCP Compound packet.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setPackets(packets: RtcpPacket[]): void {
		this.#packets = Array.from(packets);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add a new {@link RtcpPacket} at the end of this RTCP Compound packet.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	addPacket(packet: RtcpPacket): void {
		this.#packets.push(packet);

		this.setSerializationNeeded(true);
	}
}
