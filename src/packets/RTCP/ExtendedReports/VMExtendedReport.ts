import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	COMMON_HEADER_LENGTH
} from './ExtendedReport';
import {
	readBitsInDataView,
	writeBitsInDataView
} from '../../../utils/bitOps';

const VM_EXTENDED_REPORT_LENGTH = COMMON_HEADER_LENGTH + 32;

/**
 * VoIP Metrics Extended Report dump.
 *
 * @category RTCP Extended Reports
 */
export type VMExtendedReportDump = ExtendedReportDump &
{
	ssrc: number;
	lossRate: number;
	discardRate: number;
	burstDensity: number;
	gapDensity: number;
	burstDuration: number;
	gapDuration: number;
	roundTripDelay: number;
	endSystemDelay: number;
	signalLevel: number;
	noiseLevel: number;
	rerl: number;
	gmin: number;
	rFactor: number;
	extRFactor: number;
	mosLq: number;
	mosCq: number;
	plc: number;
	jba: number;
	jbRate: number;
	jbNominal: number;
	jbMax: number;
	jbAbsMax: number;
};

/**
 * VoIP Metrics Extended Report.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=7      |   reserved    |       block length = 8        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                        SSRC of source                         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |   loss rate   | discard rate  | burst density |  gap density  |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |       burst duration          |         gap duration          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     round trip delay          |       end system delay        |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * | signal level  |  noise level  |     RERL      |     Gmin      |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |   R factor    | ext. R factor |    MOS-LQ     |    MOS-CQ     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |   RX config   |   reserved    |          JB nominal           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |          JB maximum           |          JB abs max           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP Extended Reports
 *
 * @see
 * - [RFC 3611 section 4.7](https://datatracker.ietf.org/doc/html/rfc3611#section-4.7)
 */
export class VMExtendedReport extends ExtendedReport
{
	/**
	 * @param view - If given it will be parsed. Otherwise an empty VoIP Metrics
	 * 	 Extended Report will be created.
	 */
	constructor(view?: DataView)
	{
		super(ExtendedReportType.VM, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(VM_EXTENDED_REPORT_LENGTH));

			// Write report type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength !== VM_EXTENDED_REPORT_LENGTH)
		{
			throw new TypeError(
				'wrong byte length for a VoIP Metrics Extended Report'
			);
		}
	}

	/**
	 * Dump VoIP Metrics Extended Report info.
	 */
	dump(): VMExtendedReportDump
	{
		return {
			...super.dump(),
			ssrc           : this.getSsrc(),
			lossRate       : this.getLossRate(),
			discardRate    : this.getDiscardRate(),
			burstDensity   : this.getBurstDensity(),
			gapDensity     : this.getGapDensity(),
			burstDuration  : this.getBurstDuration(),
			gapDuration    : this.getGapDuration(),
			roundTripDelay : this.getRoundTripDelay(),
			endSystemDelay : this.getEndSystemDelay(),
			signalLevel    : this.getSignalLevel(),
			noiseLevel     : this.getNoiseLevel(),
			rerl           : this.getResidualEchoReturnLoss(),
			gmin           : this.getGmin(),
			rFactor        : this.getRFactor(),
			extRFactor     : this.getExternalRFactor(),
			mosLq          : this.getMosLQ(),
			mosCq          : this.getMosCQ(),
			plc            : this.getPacketLossConcealment(),
			jba            : this.getJitterBufferAdaptive(),
			jbRate         : this.getJitterBufferRate(),
			jbNominal      : this.getJitterBufferNominalDelay(),
			jbMax          : this.getJitterBufferMaximumDelay(),
			jbAbsMax       : this.getJitterBufferAbsoluteMaximumDelay()
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		return VM_EXTENDED_REPORT_LENGTH;
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
				VM_EXTENDED_REPORT_LENGTH - COMMON_HEADER_LENGTH
			),
			pos
		);

		// Move to the end.
		pos += VM_EXTENDED_REPORT_LENGTH - COMMON_HEADER_LENGTH;

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
	): VMExtendedReport
	{
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new VMExtendedReport(view);
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
	 * Get loss rate.
	 */
	getLossRate(): number
	{
		return this.view.getUint8(8);
	}

	/**
	 * Set loss rate.
	 */
	setLossRate(lossRate: number): void
	{
		this.view.setUint8(8, lossRate);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get discard rate.
	 */
	getDiscardRate(): number
	{
		return this.view.getUint8(9);
	}

	/**
	 * Set discard rate.
	 */
	setDiscardRate(discardRate: number): void
	{
		this.view.setUint8(9, discardRate);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get burst density.
	 */
	getBurstDensity(): number
	{
		return this.view.getUint8(10);
	}

	/**
	 * Set burst density.
	 */
	setBurstDensity(burstDensity: number): void
	{
		this.view.setUint8(10, burstDensity);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get gap density.
	 */
	getGapDensity(): number
	{
		return this.view.getUint8(11);
	}

	/**
	 * Set gap density.
	 */
	setGapDensity(gapDensity: number): void
	{
		this.view.setUint8(11, gapDensity);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get burst duration.
	 */
	getBurstDuration(): number
	{
		return this.view.getUint16(12);
	}

	/**
	 * Set burst duration.
	 */
	setBurstDuration(burstDuration: number): void
	{
		this.view.setUint16(12, burstDuration);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get gap duration.
	 */
	getGapDuration(): number
	{
		return this.view.getUint16(14);
	}

	/**
	 * Set gap duration.
	 */
	setGapDuration(gapDuration: number): void
	{
		this.view.setUint16(14, gapDuration);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get round trip delay.
	 */
	getRoundTripDelay(): number
	{
		return this.view.getUint16(16);
	}

	/**
	 * Set round trip delay.
	 */
	setRoundTripDelay(delay: number): void
	{
		this.view.setUint16(16, delay);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get end system delay.
	 */
	getEndSystemDelay(): number
	{
		return this.view.getUint16(18);
	}

	/**
	 * Set end system delay.
	 */
	setEndSystemDelay(delay: number): void
	{
		this.view.setUint16(18, delay);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get signal level.
	 */
	getSignalLevel(): number
	{
		return this.view.getUint8(20);
	}

	/**
	 * Set signal level.
	 */
	setSignalLevel(level: number): void
	{
		this.view.setUint8(20, level);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get noise level.
	 */
	getNoiseLevel(): number
	{
		return this.view.getUint8(21);
	}

	/**
	 * Set noise level.
	 */
	setNoiseLevel(level: number): void
	{
		this.view.setUint8(21, level);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get residual echo return loss.
	 */
	getResidualEchoReturnLoss(): number
	{
		return this.view.getUint8(22);
	}

	/**
	 * Set residual echo return loss.
	 */
	setResidualEchoReturnLoss(loss: number): void
	{
		this.view.setUint8(22, loss);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get Gmin.
	 */
	getGmin(): number
	{
		return this.view.getUint8(23);
	}

	/**
	 * Set Gmin.
	 */
	setGmin(value: number): void
	{
		this.view.setUint8(23, value);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get R factor.
	 */
	getRFactor(): number
	{
		return this.view.getUint8(24);
	}

	/**
	 * Set R factor.
	 */
	setRFactor(factor: number): void
	{
		this.view.setUint8(24, factor);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get external R factor.
	 */
	getExternalRFactor(): number
	{
		return this.view.getUint8(25);
	}

	/**
	 * Set external R factor.
	 */
	setExternalRFactor(factor: number): void
	{
		this.view.setUint8(25, factor);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get MOS-LQ.
	 */
	getMosLQ(): number
	{
		return this.view.getUint8(26);
	}

	/**
	 * Set MOS-LQ.
	 */
	setMosLQ(value: number): void
	{
		this.view.setUint8(26, value);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get MOS-CQ.
	 */
	getMosCQ(): number
	{
		return this.view.getUint8(27);
	}

	/**
	 * Set MOS-CQ.
	 */
	setMosCQ(value: number): void
	{
		this.view.setUint8(27, value);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get packet loss concealment (PLC).
	 */
	getPacketLossConcealment(): number
	{
		return readBitsInDataView(
			{ view: this.view, pos: 28, mask: 0b11000000 }
		);
	}

	/**
	 * Set packet loss concealment (PLC).
	 */
	setPacketLossConcealment(value: number): void
	{
		writeBitsInDataView(
			{ view: this.view, pos: 28, mask: 0b11000000, value: value }
		);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get jitter buffer adaptive (JBA).
	 */
	getJitterBufferAdaptive(): number
	{
		return readBitsInDataView(
			{ view: this.view, pos: 28, mask: 0b00110000 }
		);
	}

	/**
	 * Set jitter buffer adaptive (JBA).
	 */
	setJitterBufferAdaptive(value: number): void
	{
		writeBitsInDataView(
			{ view: this.view, pos: 28, mask: 0b00110000, value: value }
		);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get jitter buffer rate (JB rate).
	 */
	getJitterBufferRate(): number
	{
		return readBitsInDataView(
			{ view: this.view, pos: 28, mask: 0b00001111 }
		);
	}

	/**
	 * Set jitter buffer rate (JB rate).
	 */
	setJitterBufferRate(value: number): void
	{
		writeBitsInDataView(
			{ view: this.view, pos: 28, mask: 0b00001111, value: value }
		);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get jitter buffer nominal delay.
	 */
	getJitterBufferNominalDelay(): number
	{
		return this.view.getUint16(30);
	}

	/**
	 * Set jitter buffer nominal delay.
	 */
	setJitterBufferNominalDelay(delay: number): void
	{
		this.view.setUint16(30, delay);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get jitter buffer maximum delay.
	 */
	getJitterBufferMaximumDelay(): number
	{
		return this.view.getUint16(32);
	}

	/**
	 * Set jitter buffer maximum delay.
	 */
	setJitterBufferMaximumDelay(delay: number): void
	{
		this.view.setUint16(32, delay);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get jitter buffer absolute maximum delay.
	 */
	getJitterBufferAbsoluteMaximumDelay(): number
	{
		return this.view.getUint16(34);
	}

	/**
	 * Set jitter buffer absolute maximum delay.
	 */
	setJitterBufferAbsoluteMaximumDelay(delay: number): void
	{
		this.view.setUint16(34, delay);

		this.setSerializationNeeded(true);
	}
}
