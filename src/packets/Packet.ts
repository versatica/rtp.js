import { Serializable, SerializableDump } from './Serializable';
import { padTo4Bytes } from '../utils/helpers';
import {
	readBitInDataView,
	writeBitInDataView,
	writeBitsInDataView,
} from '../utils/bitOps';

export const RTP_VERSION = 2;

/**
 * Packet info dump.
 *
 * @remarks
 * - Read the info dump type of each RTP and RTCP packet instead.
 */
export type PacketDump = SerializableDump & {
	padding: number;
};

/**
 * Parent class of all RTP and RTCP packets.
 */
export abstract class Packet extends Serializable {
	// Number of bytes of padding.
	protected padding: number = 0;

	protected constructor(view?: DataView) {
		super(view);
	}

	/**
	 * Base RTCP packet dump.
	 *
	 * @remarks
	 * - Read the info dump type of each RTCP packet instead.
	 */
	dump(): PacketDump {
		return {
			...super.dump(),
			padding: this.getPadding(),
		};
	}

	/**
	 * Get the padding (in bytes) at the end of the packet.
	 */
	getPadding(): number {
		return this.padding;
	}

	/**
	 * Pad the packet total length to 4 bytes. To achieve it, this method may add
	 * or remove bytes of padding.
	 *
	 * @remarks
	 * - Serialization maybe needed after calling this method.
	 */
	padTo4Bytes(): void {
		const previousPacketLength = this.getByteLength();
		const packetLength = padTo4Bytes(previousPacketLength - this.padding);
		const padding = this.padding + packetLength - previousPacketLength;

		if (padding === this.padding) {
			return;
		}

		this.setPadding(padding);

		this.setSerializationNeeded(true);
	}

	protected setVersion(): void {
		writeBitsInDataView({
			view: this.view,
			pos: 0,
			mask: 0b11000000,
			value: RTP_VERSION,
		});
	}

	protected hasPaddingBit(): boolean {
		return readBitInDataView({ view: this.view, pos: 0, bit: 5 });
	}

	protected setPaddingBit(flag: boolean): void {
		writeBitInDataView({ view: this.view, pos: 0, bit: 5, flag });
	}

	protected setPadding(padding: number): void {
		if (padding === this.padding) {
			return;
		}

		this.padding = padding;

		// Update padding bit.
		this.setPaddingBit(Boolean(this.padding));

		this.setSerializationNeeded(true);
	}
}
