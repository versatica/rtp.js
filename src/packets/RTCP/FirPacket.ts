import {
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacketDump,
} from './RtcpPacket';
import { FEEDBACK_HEADER_LENGTH } from './AnyFeedbackPacket';
import {
	AnyPayloadSpecificFeedbackPacket,
	PayloadSpecificFeedbackMessageType,
} from './AnyPayloadSpecificFeedbackPacket';
import { isUnsignedInteger } from '../../utils/numbers';
import { write3BytesInDataView } from '../../utils/bytes';

/**
 * Length (in bytes) of a FIR item.
 *
 * @internal
 * @knipignore
 */
export const FIR_ITEM_LENGTH = 8;

/**
 * FIR item.
 */
export type FirItem = {
	/**
	 * SSRC of the media sender that is requested to send a decoder refresh
	 * point.
	 */
	ssrc: number;
	/**
	 * Command sequence number (8 bits).
	 */
	sequenceNumber: number;
};

/**
 * RTCP FIR packet info dump.
 */
export type FirPacketDump = RtcpPacketDump & {
	messageType: PayloadSpecificFeedbackMessageType;
	senderSsrc: number;
	mediaSsrc: number;
	items: FirItem[];
};

/**
 * RTCP Full Intra Request (FIR) packet (PSFB 206, FMT 4).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=4  |  PT=PSFB=206  |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     SSRC of packet sender                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                      SSRC of media source                     |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |                              SSRC                             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | Seq nr.       |    Reserved                                   |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * ```
 *
 * - SSRC (32 bits): The SSRC of the media sender that is requested to send a
 *   decoder refresh point.
 * - Seq nr. (8 bits): Command sequence number.
 * - Reserved (24 bits): All set to 0.
 *
 * @remarks
 * - The Feedback Control Information (FCI) must contain at least one item.
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized. Modifications that need more bytes throw if
 *   the buffer has no space for them, in which case the packet is not
 *   modified.
 *
 * @see
 * - [RFC 5104 section 4.3.1](https://datatracker.ietf.org/doc/html/rfc5104#section-4.3.1)
 */
export class FirPacket extends AnyPayloadSpecificFeedbackPacket {
	/**
	 * Parse a RTCP FIR packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP FIR packet.
	 */
	static parse(buffer: Uint8Array): FirPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new FirPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.PSFB);
		packet.#validate();

		return packet;
	}

	/**
	 * Create a RTCP FIR packet with both SSRCs set to 0 and no items.
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
	static factory(buffer: Uint8Array): FirPacket {
		const packet = new FirPacket(buffer);

		packet.initializeHeader(
			RtcpPacketType.PSFB,
			PayloadSpecificFeedbackMessageType.FIR,
			FEEDBACK_HEADER_LENGTH
		);

		// Set SSRC of packet sender and SSRC of media source to 0.
		buffer.fill(0, COMMON_HEADER_LENGTH, FEEDBACK_HEADER_LENGTH);

		return packet;
	}

	/**
	 * Length (in bytes) of a RTCP FIR packet with the given number of items.
	 *
	 * @internal
	 */
	static computeLengthFor(numItems: number): number {
		// The items go right after the feedback header, and each one is a
		// multiple of 4 bytes, so the packet never needs padding.
		return FEEDBACK_HEADER_LENGTH + numItems * FIR_ITEM_LENGTH;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP FIR packet info.
	 */
	override dump(): FirPacketDump {
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
	clone(buffer: Uint8Array): FirPacket {
		const clonedPacket = new FirPacket(buffer);

		this.cloneInto(clonedPacket);

		return clonedPacket;
	}

	/**
	 * Get the number of items.
	 */
	getItemsCount(): number {
		return (
			(this.getLength() - this.getPadding() - FEEDBACK_HEADER_LENGTH) /
			FIR_ITEM_LENGTH
		);
	}

	/**
	 * Get the items.
	 */
	getItems(): FirItem[] {
		const view = this.getView();
		const itemsCount = this.getItemsCount();
		const items: FirItem[] = [];

		for (let idx = 0; idx < itemsCount; ++idx) {
			const pos = FEEDBACK_HEADER_LENGTH + idx * FIR_ITEM_LENGTH;

			items.push({
				ssrc: view.getUint32(pos),
				sequenceNumber: view.getUint8(pos + 4),
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
	 * - `TypeError` if `ssrc` of some item is not an integer between 0 and
	 *   4294967295 or if its `sequenceNumber` is not an integer between 0 and
	 *   255.
	 * - `TypeError` if the buffer has no space for the given items.
	 */
	setItems(items: FirItem[] = []): void {
		for (const item of items) {
			this.#assertItem(item);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(
			FEEDBACK_HEADER_LENGTH -
				COMMON_HEADER_LENGTH +
				items.length * FIR_ITEM_LENGTH
		);

		for (const [idx, item] of items.entries()) {
			this.#writeItem(FEEDBACK_HEADER_LENGTH + idx * FIR_ITEM_LENGTH, item);
		}
	}

	/**
	 * Add an item at the end of the packet.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295 or if
	 *   `sequenceNumber` is not an integer between 0 and 255.
	 * - `TypeError` if the buffer has no space for the item.
	 */
	addItem(item: FirItem): void {
		this.#assertItem(item);

		const pos = FEEDBACK_HEADER_LENGTH + this.getItemsCount() * FIR_ITEM_LENGTH;

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(pos + FIR_ITEM_LENGTH - COMMON_HEADER_LENGTH);

		this.#writeItem(pos, item);
	}

	#validate(): void {
		if (this.getMessageType() !== PayloadSpecificFeedbackMessageType.FIR) {
			throw new TypeError('not a RTCP FIR packet');
		}

		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();

		// The Feedback Control Information (FCI) must contain at least one item.
		if (contentLength < FEEDBACK_HEADER_LENGTH + FIR_ITEM_LENGTH) {
			throw new TypeError('no space for feedback header and at least one item');
		}
		// The Feedback Control Information (FCI) must contain whole items.
		else if ((contentLength - FEEDBACK_HEADER_LENGTH) % FIR_ITEM_LENGTH !== 0) {
			throw new TypeError(
				`Feedback Control Information length (${contentLength - FEEDBACK_HEADER_LENGTH} bytes) is not multiple of ${FIR_ITEM_LENGTH}`
			);
		}
	}

	/**
	 * @throws
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295 or if
	 *   `sequenceNumber` is not an integer between 0 and 255.
	 */
	#assertItem(item: FirItem): void {
		if (!isUnsignedInteger(item.ssrc, 0xffffffff)) {
			throw new TypeError(
				`ssrc (${item.ssrc}) must be an integer between 0 and 4294967295`
			);
		} else if (!isUnsignedInteger(item.sequenceNumber, 0xff)) {
			throw new TypeError(
				`sequenceNumber (${item.sequenceNumber}) must be an integer between 0 and 255`
			);
		}
	}

	/**
	 * Write the given item at the given position, with the reserved bits set
	 * to 0.
	 */
	#writeItem(pos: number, item: FirItem): void {
		const view = this.getView();

		view.setUint32(pos, item.ssrc);
		view.setUint8(pos + 4, item.sequenceNumber);
		write3BytesInDataView(view, pos + 5, 0);
	}
}
