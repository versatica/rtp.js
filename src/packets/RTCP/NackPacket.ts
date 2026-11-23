import {
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacketDump,
} from './RtcpPacket';
import { FEEDBACK_HEADER_LENGTH } from './AnyFeedbackPacket';
import {
	AnyTransportLayerFeedbackPacket,
	TransportLayerFeedbackMessageType,
} from './AnyTransportLayerFeedbackPacket';
import { isUnsignedInteger } from '../../utils/numbers';

/**
 * Length (in bytes) of a NACK item.
 *
 * @internal
 * @knipignore
 */
export const NACK_ITEM_LENGTH = 4;

/**
 * NACK item.
 */
export type NackItem = {
	/**
	 * Packet ID (PID): The RTP sequence number of a lost packet.
	 */
	pid: number;
	/**
	 * Bitmask of following lost packets (BLP): Bit i set to 1 means that the
	 * packet with sequence number PID + i + 1 is also lost.
	 */
	bitmask: number;
};

/**
 * RTCP NACK packet info dump.
 */
export type NackPacketDump = RtcpPacketDump & {
	messageType: TransportLayerFeedbackMessageType;
	senderSsrc: number;
	mediaSsrc: number;
	items: NackItem[];
};

/**
 * RTCP Generic NACK packet (RTPFB 205, FMT 1).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=1  |  PT=RTPFB=205 |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     SSRC of packet sender                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                      SSRC of media source                     |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |              PID              |              BLP              |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * ```
 *
 * - Packet ID (PID) (16 bits): The RTP sequence number of a lost packet.
 * - Bitmask of following lost packets (BLP) (16 bits): Bit i set to 1 means
 *   that the packet with sequence number PID + i + 1 is also lost.
 *
 * @remarks
 * - The Feedback Control Information (FCI) must contain at least one item.
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized. Modifications that need more bytes throw if
 *   the buffer has no space for them, in which case the packet is not
 *   modified.
 *
 * @see
 * - [RFC 4585 section 6.2.1](https://datatracker.ietf.org/doc/html/rfc4585#section-6.2.1)
 */
export class NackPacket extends AnyTransportLayerFeedbackPacket {
	/**
	 * Parse a RTCP NACK packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP NACK packet.
	 */
	static parse(buffer: Uint8Array): NackPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new NackPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.RTPFB);
		packet.#validate();

		return packet;
	}

	/**
	 * Create a RTCP NACK packet with both SSRCs set to 0 and no items.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 *
	 * @remarks
	 * - At least one item must be added before sending the packet.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than 12 bytes.
	 */
	static factory(buffer: Uint8Array): NackPacket {
		const packet = new NackPacket(buffer);

		packet.initializeHeader(
			RtcpPacketType.RTPFB,
			TransportLayerFeedbackMessageType.NACK,
			FEEDBACK_HEADER_LENGTH
		);

		// Set SSRC of packet sender and SSRC of media source to 0.
		buffer.fill(0, COMMON_HEADER_LENGTH, FEEDBACK_HEADER_LENGTH);

		return packet;
	}

	/**
	 * Length (in bytes) of a RTCP NACK packet with the given number of items.
	 *
	 * @internal
	 */
	static computeLengthFor(numItems: number): number {
		// The items go right after the feedback header, and each one is a
		// multiple of 4 bytes, so the packet never needs padding.
		return FEEDBACK_HEADER_LENGTH + numItems * NACK_ITEM_LENGTH;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP NACK packet info.
	 */
	override dump(): NackPacketDump {
		return {
			...super.dump(),
			messageType: this.getMessageType(),
			senderSsrc: this.getSenderSsrc(),
			mediaSsrc: this.getMediaSsrc(),
			items: this.getItems(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): NackPacket {
		const clonedPacket = new NackPacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	/**
	 * Get the number of items.
	 */
	getItemsCount(): number {
		return (
			(this.getLength() - this.getPadding() - FEEDBACK_HEADER_LENGTH) /
			NACK_ITEM_LENGTH
		);
	}

	/**
	 * Get the items.
	 */
	getItems(): NackItem[] {
		const view = this.getView();
		const itemsCount = this.getItemsCount();
		const items: NackItem[] = [];

		for (let idx = 0; idx < itemsCount; ++idx) {
			const pos = FEEDBACK_HEADER_LENGTH + idx * NACK_ITEM_LENGTH;

			items.push({
				pid: view.getUint16(pos),
				bitmask: view.getUint16(pos + 2),
			});
		}

		return items;
	}

	/**
	 * Set the items. If `items` is not given (or if it's an empty array) all
	 * items are removed.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 * - At least one item must exist before sending the packet.
	 *
	 * @throws
	 * - `TypeError` if `pid` or `bitmask` of some item is not an integer between
	 *   0 and 65535.
	 * - `TypeError` if the buffer has no space for the given items.
	 */
	setItems(items: NackItem[] = []): void {
		for (const item of items) {
			this.#assertItem(item);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(
			FEEDBACK_HEADER_LENGTH -
				COMMON_HEADER_LENGTH +
				items.length * NACK_ITEM_LENGTH
		);

		for (const [idx, item] of items.entries()) {
			this.#writeItem(FEEDBACK_HEADER_LENGTH + idx * NACK_ITEM_LENGTH, item);
		}
	}

	/**
	 * Add an item at the end of the packet.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if `pid` or `bitmask` is not an integer between 0 and
	 *   65535.
	 * - `TypeError` if the buffer has no space for the item.
	 */
	addItem(item: NackItem): void {
		this.#assertItem(item);

		const pos =
			FEEDBACK_HEADER_LENGTH + this.getItemsCount() * NACK_ITEM_LENGTH;

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(pos + NACK_ITEM_LENGTH - COMMON_HEADER_LENGTH);

		this.#writeItem(pos, item);
	}

	#validate(): void {
		if (this.getMessageType() !== TransportLayerFeedbackMessageType.NACK) {
			throw new TypeError('not a RTCP NACK packet');
		}

		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();

		// The Feedback Control Information (FCI) must contain at least one item.
		if (contentLength < FEEDBACK_HEADER_LENGTH + NACK_ITEM_LENGTH) {
			throw new TypeError('no space for feedback header and at least one item');
		}
		// The Feedback Control Information (FCI) must contain whole items.
		else if (
			(contentLength - FEEDBACK_HEADER_LENGTH) % NACK_ITEM_LENGTH !==
			0
		) {
			throw new TypeError(
				`Feedback Control Information length (${contentLength - FEEDBACK_HEADER_LENGTH} bytes) is not multiple of ${NACK_ITEM_LENGTH}`
			);
		}
	}

	/**
	 * @throws
	 * - `TypeError` if `pid` or `bitmask` is not an integer between 0 and
	 *   65535.
	 */
	#assertItem(item: NackItem): void {
		if (!isUnsignedInteger(item.pid, 0xffff)) {
			throw new TypeError(
				`pid (${item.pid}) must be an integer between 0 and 65535`
			);
		} else if (!isUnsignedInteger(item.bitmask, 0xffff)) {
			throw new TypeError(
				`bitmask (${item.bitmask}) must be an integer between 0 and 65535`
			);
		}
	}

	#writeItem(pos: number, item: NackItem): void {
		const view = this.getView();

		view.setUint16(pos, item.pid);
		view.setUint16(pos + 2, item.bitmask);
	}
}
