import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	getExtendedReportType,
	getExtendedReportLength
} from './ExtendedReports/ExtendedReport';
import { ExtendedReportLRLE } from './ExtendedReports/ExtendedReportLRLE';
import { ExtendedReportDRLE } from './ExtendedReports/ExtendedReportDRLE';
import { ExtendedReportPRT } from './ExtendedReports/ExtendedReportPRT';
import { ExtendedReportRRT } from './ExtendedReports/ExtendedReportRRT';
import { ExtendedReportDLRR } from './ExtendedReports/ExtendedReportDLRR';
import { ExtendedReportSS } from './ExtendedReports/ExtendedReportSS';
import { ExtendedReportVM } from './ExtendedReports/ExtendedReportVM';
import { GenericExtendedReport } from './ExtendedReports/GenericExtendedReport';
import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	COMMON_HEADER_LENGTH
} from './RtcpPacket';

// Common RTCP header length + 4 (SSRC of packet sender).
const FIXED_HEADER_LENGTH = COMMON_HEADER_LENGTH + 4;

/**
 * RTCP XR packet info dump.
 */
export type XrPacketDump = RtcpPacketDump &
{
	ssrc: number;
	reports: ExtendedReportDump[];
};

/**
 * RTCP XR packet.
 *
 * ```text
 *
 *         0                   1                   2                   3
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|reserved |   PT=XR=207   |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                              SSRC                             |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * report :                         report blocks                         :
 * blocks +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @see
 * - [RFC 3611 section 2](https://datatracker.ietf.org/doc/html/rfc3611#section-2)
 */
export class XrPacket extends RtcpPacket
{
	// Extended Reports.
	#reports: ExtendedReport[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP XR packet
	 *   will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP XR packet.
	 */
	constructor(view?: DataView)
	{
		super(RtcpPacketType.XR, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to Extended Reports.
		pos += FIXED_HEADER_LENGTH;

		while (pos < this.view.byteLength - this.padding)
		{
			const remainingView = new DataView(
				this.view.buffer,
				this.view.byteOffset + pos,
				this.view.byteLength - this.padding - pos
			);

			const reportType = getExtendedReportType(remainingView);
			const reportLength = getExtendedReportLength(remainingView);

			const reportView = new DataView(
				this.view.buffer,
				this.view.byteOffset + pos,
				reportLength
			);

			let report: ExtendedReport;

			switch (reportType)
			{
				case ExtendedReportType.LRLE:
				{
					report = new ExtendedReportLRLE(reportView);

					break;
				}

				case ExtendedReportType.DRLE:
				{
					report = new ExtendedReportDRLE(reportView);

					break;
				}

				case ExtendedReportType.PRT:
				{
					report = new ExtendedReportPRT(reportView);

					break;
				}

				case ExtendedReportType.RRT:
				{
					report = new ExtendedReportRRT(reportView);

					break;
				}

				case ExtendedReportType.DLRR:
				{
					report = new ExtendedReportDLRR(reportView);

					break;
				}

				case ExtendedReportType.SS:
				{
					report = new ExtendedReportSS(reportView);

					break;
				}

				case ExtendedReportType.VM:
				{
					report = new ExtendedReportVM(reportView);

					break;
				}

				default:
				{
					report = new GenericExtendedReport(reportView);
				}
			}

			pos += reportLength;

			this.#reports.push(report);
		}

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
	 * Dump XR packet info.
	 */
	dump(): XrPacketDump
	{
		return {
			...super.dump(),
			ssrc    : this.getSsrc(),
			reports : this.#reports.map((report) => report.dump())
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

		const packetLength =
			FIXED_HEADER_LENGTH +
			this.#reports.reduce(
				(sum, report) => sum + report.getByteLength(),
				0
			) +
			this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	needsSerialization(): boolean
	{
		return (
			super.needsSerialization() ||
			this.#reports.some((report) => report.needsSerialization())
		);
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

		// Copy the rest of the fixed header into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset + pos,
				FIXED_HEADER_LENGTH - COMMON_HEADER_LENGTH
			),
			pos
		);

		// Move to Reception Reports.
		pos += FIXED_HEADER_LENGTH - COMMON_HEADER_LENGTH;

		// Write Reception Reports.
		for (const report of this.#reports)
		{
			// Serialize the report into the current position.
			report.serialize(view.buffer, view.byteOffset + pos);

			pos += report.getByteLength();
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength)
		{
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
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number
	): XrPacket
	{
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new XrPacket(view);
	}

	/**
	 * Get sender SSRC.
	 */
	getSsrc(): number
	{
		return this.view.getUint32(4);
	}

	/**
	 * Set sender SSRC.
	 */
	setSsrc(ssrc: number)
	{
		this.view.setUint32(4, ssrc);
	}

	/**
	 * Get Extended Reports.
	 */
	getReports(): ExtendedReport[]
	{
		return Array.from(this.#reports);
	}

	/**
	 * Set Extended Reports.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setReports(reports: ExtendedReport[]): void
	{
		this.#reports = Array.from(reports);

		// NOTE: Do not update RTCP count since XR packets do not have that field.

		this.setSerializationNeeded(true);
	}

	/**
	 * Add Extended Report.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	addReport(report: ExtendedReport): void
	{
		this.#reports.push(report);

		// Update RTCP count.
		// NOTE: Do not update RTCP count since XR packets do not have that field.

		this.setSerializationNeeded(true);
	}
}
