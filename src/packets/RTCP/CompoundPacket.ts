import { Serializable, type SerializableDump } from '../common/Serializable';
import {
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacket,
	type RtcpPacketDump,
} from './RtcpPacket';
import { TransportLayerFeedbackMessageType } from './AnyTransportLayerFeedbackPacket';
import { PayloadSpecificFeedbackMessageType } from './AnyPayloadSpecificFeedbackPacket';
import { SenderReportPacket } from './SenderReportPacket';
import { ReceiverReportPacket } from './ReceiverReportPacket';
import { SdesPacket } from './SdesPacket';
import { ByePacket } from './ByePacket';
import { NackPacket } from './NackPacket';
import { TransportWideCcPacket } from './TransportWideCcPacket';
import { UnknownTransportLayerFeedbackPacket } from './UnknownTransportLayerFeedbackPacket';
import { PliPacket } from './PliPacket';
import { FirPacket } from './FirPacket';
import { RembPacket } from './RembPacket';
import { UnknownPayloadSpecificFeedbackPacket } from './UnknownPayloadSpecificFeedbackPacket';
import { XrPacket } from './XrPacket';
import { UnknownPacket } from './UnknownPacket';
import { readBits } from '../../utils/bits';

/**
 * RTCP Compound packet info dump.
 */
export type CompoundPacketDump = SerializableDump & {
	/**
	 * Dump of each RTCP packet in the compound packet.
	 */
	packets: RtcpPacketDump[];
};

/**
 * Parse the RTCP packet in the given buffer, whose `byteLength` is the exact
 * length of the packet, with the class of its packet type (and message type).
 *
 * @throws
 * - `TypeError` if the buffer does not contain a valid RTCP packet.
 */
function parsePacket(buffer: Uint8Array): RtcpPacket {
	const packetType: RtcpPacketType = buffer[1]!;

	switch (packetType) {
		case RtcpPacketType.SR: {
			return SenderReportPacket.parse(buffer);
		}

		case RtcpPacketType.RR: {
			return ReceiverReportPacket.parse(buffer);
		}

		case RtcpPacketType.SDES: {
			return SdesPacket.parse(buffer);
		}

		case RtcpPacketType.BYE: {
			return ByePacket.parse(buffer);
		}

		case RtcpPacketType.RTPFB: {
			// The FMT field tells the type of the feedback message.
			const messageType: TransportLayerFeedbackMessageType = readBits(
				buffer[0]!,
				0b00011111
			);

			switch (messageType) {
				case TransportLayerFeedbackMessageType.NACK: {
					return NackPacket.parse(buffer);
				}

				case TransportLayerFeedbackMessageType.TCC: {
					return TransportWideCcPacket.parse(buffer);
				}

				default: {
					return UnknownTransportLayerFeedbackPacket.parse(buffer);
				}
			}
		}

		case RtcpPacketType.PSFB: {
			// The FMT field tells the type of the feedback message.
			const messageType: PayloadSpecificFeedbackMessageType = readBits(
				buffer[0]!,
				0b00011111
			);

			switch (messageType) {
				case PayloadSpecificFeedbackMessageType.PLI: {
					return PliPacket.parse(buffer);
				}

				case PayloadSpecificFeedbackMessageType.FIR: {
					return FirPacket.parse(buffer);
				}

				case PayloadSpecificFeedbackMessageType.AFB: {
					return RembPacket.isRemb(buffer)
						? RembPacket.parse(buffer)
						: UnknownPayloadSpecificFeedbackPacket.parse(buffer);
				}

				default: {
					return UnknownPayloadSpecificFeedbackPacket.parse(buffer);
				}
			}
		}

		case RtcpPacketType.XR: {
			return XrPacket.parse(buffer);
		}

		default: {
			return UnknownPacket.parse(buffer);
		}
	}
}

/**
 * RTCP Compound packet: a sequence of RTCP packets in the same buffer.
 *
 * @see
 * - [RFC 3550 section 6.1](https://datatracker.ietf.org/doc/html/rfc3550#section-6.1)
 */
export class CompoundPacket extends Serializable {
	// RTCP packets.
	#packets: RtcpPacket[] = [];

	/**
	 * Parse a RTCP Compound packet.
	 *
	 * @param buffer - Buffer holding the compound packet. Its `byteLength` must
	 *   be the exact length of the compound packet.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP Compound packet.
	 */
	static parse(buffer: Uint8Array): CompoundPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP Compound packet');
		}

		const compoundPacket = new CompoundPacket(buffer);
		let pos = 0;

		while (pos < buffer.byteLength) {
			// The remaining length in the buffer is the potential buffer of the
			// current packet.
			const remainingBuffer = buffer.subarray(pos);

			if (!isRtcp(remainingBuffer)) {
				throw new TypeError('not a RTCP packet');
			}

			const packetLength =
				((remainingBuffer[2]! << 8) + remainingBuffer[3]! + 1) * 4;

			if (packetLength > remainingBuffer.byteLength) {
				throw new TypeError(
					`no space for announced RTCP packet length (${packetLength} bytes)`
				);
			}

			// The buffer of the packet is its exact length.
			const packet = parsePacket(remainingBuffer.subarray(0, packetLength));

			compoundPacket.#packets.push(packet);

			pos += packet.getLength();
		}

		compoundPacket.setLength(pos);

		return compoundPacket;
	}

	/**
	 * Create a RTCP Compound packet without RTCP packets, so its length is 0
	 * until a packet is added.
	 *
	 * @param buffer - Buffer for the compound packet. Its `byteLength` is the
	 *   maximum length the compound packet can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than the RTCP Common Header
	 *   length (4 bytes).
	 */
	static factory(buffer: Uint8Array): CompoundPacket {
		// No space for a single packet.
		if (buffer.byteLength < COMMON_HEADER_LENGTH) {
			throw new TypeError('buffer too small');
		}

		return new CompoundPacket(buffer);
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
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
	clone(buffer: Uint8Array): CompoundPacket {
		const clonedCompoundPacket = new CompoundPacket(buffer);

		// NOTE: No byte is copied here. Each packet copies its own bytes, and the
		// packets fill the whole compound packet.
		this.cloneInto(clonedCompoundPacket, /* copyBytes */ false);

		const byteOffset = this.getBuffer().byteOffset;
		const clonedCompoundPacketBuffer = clonedCompoundPacket.getBuffer();

		// Each packet goes at the same position within the cloned compound packet.
		for (const packet of this.#packets) {
			const packetBuffer = packet.getBuffer();
			const pos = packetBuffer.byteOffset - byteOffset;

			clonedCompoundPacket.#packets.push(
				packet.clone(
					clonedCompoundPacketBuffer.subarray(
						pos,
						pos + packetBuffer.byteLength
					)
				)
			);
		}

		return clonedCompoundPacket;
	}

	/**
	 * Get the RTCP packets.
	 *
	 * @remarks
	 * - The returned array is a copy, but the packets in it are the ones in the
	 *   compound packet, so modifying them modifies the compound packet.
	 * - The packets must not be modified in a way that changes their length,
	 *   since the compound packet doesn't track it and would contain stale
	 *   bytes between packets.
	 */
	getPackets(): RtcpPacket[] {
		return this.#packets.slice();
	}

	/**
	 * Get the first RTCP packet of the given class.
	 *
	 * @example
	 * ```ts
	 * const senderReportPacket =
	 *   compoundPacket.getFirstPacketOfType(SenderReportPacket);
	 * ```
	 */
	getFirstPacketOfType<T extends RtcpPacket>(type: {
		prototype: T;
	}): T | undefined {
		for (const packet of this.#packets) {
			if (packet.constructor === type) {
				return packet as T;
			}
		}

		return undefined;
	}

	/**
	 * Clone the given RTCP packet into the buffer of the compound packet, after
	 * the existing ones.
	 *
	 * @throws
	 * - `Error` if some packet is being built in place within the compound
	 *   packet, or within the given packet (see {@link needsConsolidation}).
	 * - `TypeError` if the buffer of the given packet shares memory with the
	 *   position where it would be cloned (in the free space of the buffer of
	 *   the compound packet), in which case nothing changes.
	 * - `TypeError` if the buffer has no space for the packet, in which case
	 *   nothing changes.
	 */
	addPacket(packet: RtcpPacket): void {
		this.assertDoesNotNeedConsolidation();

		// NOTE: Checked before changing anything, since the clone below would
		// throw once the length of the compound packet has been updated.
		if (packet.needsConsolidation()) {
			throw new Error(
				'given packet needs consolidation of some item being built in place'
			);
		}

		const previousLength = this.getLength();
		const packetBuffer = packet.getBuffer();
		const packetLength = packetBuffer.byteLength;
		const view = this.getView();
		const byteOffset = view.byteOffset + previousLength;

		// NOTE: Checked before changing anything, since the clone below would
		// throw once the length of the compound packet has been updated.
		if (
			packetBuffer.buffer === view.buffer &&
			byteOffset < packetBuffer.byteOffset + packet.getBufferLength() &&
			packetBuffer.byteOffset < byteOffset + packetLength
		) {
			throw new TypeError(
				'buffer of given packet shares memory with the position where it would be cloned'
			);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setLength(previousLength + packetLength);

		this.#packets.push(
			packet.clone(
				this.getBuffer().subarray(previousLength, previousLength + packetLength)
			)
		);
	}

	/**
	 * Build a RTCP packet of the given class within the free space of the buffer
	 * of the compound packet. The application can modify it and the changes are
	 * written in the buffer of the compound packet. Once completed, the
	 * application must call {@link consolidate} on it so the compound packet
	 * adds it, or {@link discard} so the compound packet is left as it was.
	 *
	 * @param type - Class of the RTCP packet, whose `factory()` is used to
	 *   create it.
	 *
	 * @remarks
	 * - Meanwhile, {@link getLength} of the compound packet does not include the
	 *   length of the packet.
	 *
	 * @throws
	 * - `Error` if some packet is being built in place within the compound
	 *   packet (see {@link needsConsolidation}).
	 * - `TypeError` if the buffer has no space for the packet.
	 *
	 * @example
	 * ```ts
	 * const byePacket = compoundPacket.buildPacketInPlace(ByePacket);
	 *
	 * byePacket.addSsrc(1234);
	 * byePacket.consolidate();
	 * ```
	 */
	buildPacketInPlace<T extends RtcpPacket>(type: {
		factory(buffer: Uint8Array): T;
	}): T {
		this.assertDoesNotNeedConsolidation();

		const view = this.getView();
		// The new packet goes after the other packets in the compound packet.
		const pos = this.getLength();
		// The free space of the buffer is the potential buffer of the packet.
		const packet = type.factory(
			new Uint8Array(view.buffer, view.byteOffset + pos, view.byteLength - pos)
		);

		this.handleInPlaceItem(packet, consolidatedPacket => {
			// NOTE: This throws if there is no space in the buffer.
			this.setLength(this.getLength() + consolidatedPacket.getLength());

			this.#packets.push(consolidatedPacket);
		});

		return packet;
	}

	protected override setBuffer(buffer: Uint8Array): void {
		for (const packet of this.#packets) {
			this.setItemBuffer(packet, buffer);
		}

		super.setBuffer(buffer);
	}
}
