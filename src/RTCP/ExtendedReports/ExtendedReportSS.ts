import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	COMMON_HEADER_LENGTH
} from './ExtendedReport';
import {
	readBitInDataView,
	writeBitInDataView,
	readBitsInDataView,
	writeBitsInDataView
} from '../../bitOps';

const EXTENDED_REPORT_SS_LENGTH = COMMON_HEADER_LENGTH + 36;

/**
 * Statistics Summary Extended Report dump.
 *
 * @category RTCP
 */
export type ExtendedReportSSDump = ExtendedReportDump &
{
	ssrc: number;
	beginSeq: number;
	endSeq: number;
	lostPackets?: number;
	duplicatePackets?: number;
	minJitter?: number;
	maxJitter?: number;
	meanJitter?: number;
	devJitter?: number;
	minTtlOrHl?: number;
	maxTtlOrHl?: number;
	meanTtlOrHl?: number;
	devTtlOrHl?: number;
	ttlOrHlMode?: 'ipv4-ttl' | 'ipv6-hop-limit';
};

/**
 * Statistics Summary Extended Report.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=6      |L|D|J|ToH|rsvd.|       block length = 9        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                        SSRC of source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |          begin_seq            |             end_seq           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                        lost_packets                           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                        dup_packets                            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                         min_jitter                            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                         max_jitter                            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                         mean_jitter                           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                         dev_jitter                            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | min_ttl_or_hl | max_ttl_or_hl |mean_ttl_or_hl | dev_ttl_or_hl |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP
 *
 * @see
 * - [RFC 3611 section 4.6](https://datatracker.ietf.org/doc/html/rfc3611#section-4.6)
 */
export class ExtendedReportSS extends ExtendedReport
{
	/**
	 * @param view - If given it will be parsed. Otherwise an empty Statistics
	 *   Summary Extended Report will be created.
	 */
	constructor(view?: DataView)
	{
		super(ExtendedReportType.SS, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(EXTENDED_REPORT_SS_LENGTH));

			// Write report type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength !== EXTENDED_REPORT_SS_LENGTH)
		{
			throw new TypeError(
				'wrong byte length for a Statistics Summary Extended Report'
			);
		}
	}

	/**
	 * Dump Statistics Summary Extended Report info.
	 */
	dump(): ExtendedReportSSDump
	{
		return {
			...super.dump(),
			ssrc             : this.getSsrc(),
			beginSeq         : this.getBeginSeq(),
			endSeq           : this.getEndSeq(),
			lostPackets      : this.getLostPackets(),
			duplicatePackets : this.getDuplicatePackets(),
			minJitter        : this.getMinJitter(),
			maxJitter        : this.getMaxJitter(),
			meanJitter       : this.getMeanJitter(),
			devJitter        : this.getDevJitter(),
			minTtlOrHl       : this.getMinTtlOrHopLimit(),
			maxTtlOrHl       : this.getMaxTtlOrHopLimit(),
			meanTtlOrHl      : this.getMeanTtlOrHopLimit(),
			devTtlOrHl       : this.getDevTtlOrHopLimit(),
			ttlOrHlMode      : this.getTtlOrHopLimitMode()
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		return EXTENDED_REPORT_SS_LENGTH;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void
	{
		const view = this.serializeBase(buffer, byteOffset);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to the fixed header fields after the common header.
		pos += COMMON_HEADER_LENGTH;

		// Copy the rest of the Extended Report into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset + pos,
				EXTENDED_REPORT_SS_LENGTH - COMMON_HEADER_LENGTH
			),
			pos
		);

		// Move to the end.
		pos += EXTENDED_REPORT_SS_LENGTH - COMMON_HEADER_LENGTH;

		if (pos !== view.byteLength)
		{
			throw new RangeError(
				`filled length (${pos} bytes) does not match the available buffer size (${view.byteLength} bytes)`
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
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number
	): ExtendedReportSS
	{
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new ExtendedReportSS(view);
	}

	/**
	 * Get SSRC of source.
	 */
	getSsrc(): number
	{
		return this.view.getUint32(4);
	}

	/**
	 * Set SSRC of source.
	 */
	setSsrc(ssrc: number): void
	{
		this.view.setUint32(4, ssrc);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get begin sequence number.
	 */
	getBeginSeq(): number
	{
		return this.view.getUint16(8);
	}

	/**
	 * Set begin sequence number.
	 */
	setBeginSeq(seq: number): void
	{
		this.view.setUint16(8, seq);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get end sequence number.
	 */
	getEndSeq(): number
	{
		return this.view.getUint16(10);
	}

	/**
	 * Set end sequence number.
	 */
	setEndSeq(seq: number): void
	{
		this.view.setUint16(10, seq);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get number of lost packets.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getLostPackets(): number | undefined
	{
		if (!this.hasLostPacketsBit())
		{
			return undefined;
		}

		return this.view.getUint32(12);
	}

	/**
	 * Set number of lost packets.
	 */
	setLostPackets(lostPackets: number | undefined): void
	{
		if (lostPackets !== undefined)
		{
			this.setLostPacketsBit(true);

			this.view.setUint32(12, lostPackets);
		}
		else
		{
			this.setLostPacketsBit(false);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Get number of duplicate packets.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getDuplicatePackets(): number | undefined
	{
		if (!this.hasDuplicatePacketsBit())
		{
			return undefined;
		}

		return this.view.getUint32(16);
	}

	/**
	 * Set number of duplicate packets.
	 */
	setDuplicatePackets(duplicatePackets: number | undefined): void
	{
		if (duplicatePackets !== undefined)
		{
			this.setDuplicatePacketsBit(true);

			this.view.setUint32(16, duplicatePackets);
		}
		else
		{
			this.setDuplicatePacketsBit(false);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Get minimum jitter.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getMinJitter(): number | undefined
	{
		if (!this.hasJitterBit())
		{
			return undefined;
		}

		return this.view.getUint32(20);
	}

	/**
	 * Set minimum jitter.
	 */
	setMinJitter(minJitter: number | undefined): void
	{
		if (minJitter !== undefined)
		{
			this.setJitterBit(true);

			this.view.setUint32(20, minJitter);
		}
		else
		{
			this.setJitterBit(false);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Get maximum jitter.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getMaxJitter(): number | undefined
	{
		if (!this.hasJitterBit())
		{
			return undefined;
		}

		return this.view.getUint32(24);
	}

	/**
	 * Set maximum jitter.
	 */
	setMaxJitter(maxJitter: number | undefined): void
	{
		if (maxJitter !== undefined)
		{
			this.setJitterBit(true);

			this.view.setUint32(24, maxJitter);
		}
		else
		{
			this.setJitterBit(false);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Get mean jitter.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getMeanJitter(): number | undefined
	{
		if (!this.hasJitterBit())
		{
			return undefined;
		}

		return this.view.getUint32(28);
	}

	/**
	 * Set mean jitter.
	 */
	setMeanJitter(meanJitter: number | undefined): void
	{
		if (meanJitter !== undefined)
		{
			this.setJitterBit(true);

			this.view.setUint32(28, meanJitter);
		}
		else
		{
			this.setJitterBit(false);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Get dev jitter.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getDevJitter(): number | undefined
	{
		if (!this.hasJitterBit())
		{
			return undefined;
		}

		return this.view.getUint32(32);
	}

	/**
	 * Set dev jitter.
	 */
	setDevJitter(devJitter: number | undefined): void
	{
		if (devJitter !== undefined)
		{
			this.setJitterBit(true);

			this.view.setUint32(32, devJitter);
		}
		else
		{
			this.setJitterBit(false);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Get minimum TTL or Hop Limit value.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getMinTtlOrHopLimit(): number | undefined
	{
		if (!this.getTtlOrHopLimitMode())
		{
			return undefined;
		}

		return this.view.getUint8(36);
	}

	/**
	 * Set minimum TTL or Hop Limit value.
	 */
	setMinTtlOrHl(minTtlOrHl: number | undefined): void
	{
		if (minTtlOrHl !== undefined)
		{
			if (!this.getTtlOrHopLimitMode())
			{
				this.setTtlOrHlMode('ipv4-ttl');
			}

			this.view.setUint8(36, minTtlOrHl);
		}
		else
		{
			this.setTtlOrHlMode(undefined);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Get maximum TTL or Hop Limit value.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getMaxTtlOrHopLimit(): number | undefined
	{
		if (!this.getTtlOrHopLimitMode())
		{
			return undefined;
		}

		return this.view.getUint8(37);
	}

	/**
	 * Set maximum TTL or Hop Limit value.
	 */
	setMaxTtlOrHl(maxTtlOrHl: number | undefined): void
	{
		if (maxTtlOrHl !== undefined)
		{
			if (!this.getTtlOrHopLimitMode())
			{
				this.setTtlOrHlMode('ipv4-ttl');
			}

			this.view.setUint8(37, maxTtlOrHl);
		}
		else
		{
			this.setTtlOrHlMode(undefined);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Get mean TTL or Hop Limit value.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getMeanTtlOrHopLimit(): number | undefined
	{
		if (!this.getTtlOrHopLimitMode())
		{
			return undefined;
		}

		return this.view.getUint8(38);
	}

	/**
	 * Set mean TTL or Hop Limit value.
	 */
	setMeanTtlOrHl(meanTtlOrHl: number | undefined): void
	{
		if (meanTtlOrHl !== undefined)
		{
			if (!this.getTtlOrHopLimitMode())
			{
				this.setTtlOrHlMode('ipv4-ttl');
			}

			this.view.setUint8(38, meanTtlOrHl);
		}
		else
		{
			this.setTtlOrHlMode(undefined);
		}

		this.setSerializationNeeded(true);
	}

	/**
	 * Get dev TTL or Hop Limit value.
	 *
	 * @remarks
	 * - It could be `undefined` if the field is unset in the report.
	 */
	getDevTtlOrHopLimit(): number | undefined
	{
		if (!this.getTtlOrHopLimitMode())
		{
			return undefined;
		}

		return this.view.getUint8(39);
	}

	/**
	 * Set dev TTL or Hop Limit value.
	 */
	setDevTtlOrHl(devTtlOrHl: number | undefined): void
	{
		if (devTtlOrHl !== undefined)
		{
			if (!this.getTtlOrHopLimitMode())
			{
				this.setTtlOrHlMode('ipv4-ttl');
			}

			this.view.setUint8(39, devTtlOrHl);
		}
		else
		{
			this.setTtlOrHlMode(undefined);
		}

		this.setSerializationNeeded(true);
	}

	getTtlOrHopLimitMode(): 'ipv4-ttl' | 'ipv6-hop-limit' | undefined
	{
		const value = readBitsInDataView(
			{ view: this.view, byte: 1, mask: 0b00011000 }
		);

		if (value === 1)
		{
			return 'ipv4-ttl';
		}
		else if (value === 2)
		{
			return 'ipv6-hop-limit';
		}
		else
		{
			return undefined;
		}
	}

	setTtlOrHlMode(mode: 'ipv4-ttl' | 'ipv6-hop-limit' | undefined): void
	{
		if (mode === 'ipv4-ttl')
		{
			writeBitsInDataView(
				{ view: this.view, byte: 1, mask: 0b00011000, value: 1 }
			);
		}
		else if (mode === 'ipv6-hop-limit')
		{
			writeBitsInDataView(
				{ view: this.view, byte: 1, mask: 0b00011000, value: 2 }
			);
		}
		else
		{
			writeBitsInDataView(
				{ view: this.view, byte: 1, mask: 0b00011000, value: 0 }
			);

			this.view.setUint8(36, 0);
			this.view.setUint8(37, 0);
			this.view.setUint8(38, 0);
			this.view.setUint8(39, 0);
		}

		this.setSerializationNeeded(true);
	}

	private hasLostPacketsBit()
	{
		return readBitInDataView({ view: this.view, byte: 1, bit: 7 });
	}

	private setLostPacketsBit(flag: boolean): void
	{
		writeBitInDataView({ view: this.view, byte: 1, bit: 1, flag });

		if (!flag)
		{
			this.view.setUint32(12, 0);
		}
	}

	private hasDuplicatePacketsBit()
	{
		return readBitInDataView({ view: this.view, byte: 1, bit: 6 });
	}

	private setDuplicatePacketsBit(flag: boolean): void
	{
		writeBitInDataView({ view: this.view, byte: 1, bit: 6, flag });

		if (!flag)
		{
			this.view.setUint32(16, 0);
		}
	}

	private hasJitterBit()
	{
		return readBitInDataView({ view: this.view, byte: 1, bit: 5 });
	}

	private setJitterBit(flag: boolean): void
	{
		writeBitInDataView({ view: this.view, byte: 1, bit: 5, flag });

		if (!flag)
		{
			this.view.setUint32(20, 0);
			this.view.setUint32(24, 0);
			this.view.setUint32(28, 0);
			this.view.setUint32(32, 0);
		}
	}
}
