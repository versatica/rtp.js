import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	getRtcpLength,
	COMMON_HEADER_LENGTH
} from './RtcpPacket';
import { Serializable } from '../Serializable';
import { assertUnreachable } from '../utils';

/*
 * https://tools.ietf.org/html/rfc3611
 *
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|reserved |   PT=XR=207   |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                              SSRC                             |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * report :                         report blocks                         :
 * blocks +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 */



// Common RTCP header length + 4 (SSRC of packet sender).
const FIXED_HEADER_LENGTH = COMMON_HEADER_LENGTH + 4;

const EXTENDED_REPORT_COMMON_HEADER_LENGTH = 4;

/**
 * Extended Report types.
 */
// ESLint absurdly complains about "'ExtendedReportType' is already declared in
// the upper scope".
// eslint-disable-next-line no-shadow
export enum ExtendedReportType
{
	/**
	 * Loss RLE Report.
	 */
	LRLE = 1,
	/**
	 * Duplicate RLE Report.
	 */
	DRLE = 2,
	/**
	 * Packet Receipt Times Report.
	 */
	PRT = 3,
	/**
	 * Receiver Reference Time Report.
	 */
	RRT = 4,
	/**
	 * DLRR Report.
	 */
	DLRR = 5,
	/**
	 * Statistics Summary Report.
	 */
	SS = 6,
	/**
	 * VoIP Metrics Report.
	 */
	VM = 7
}

/**
 * RTCP XR packet info dump.
 */
export type XrPacketDump = RtcpPacketDump &
{
	ssrc: number;
	reports: ExtendedReportDump[];
};

/**
 * Extended Report dump.
 */
// TODO: MAke this an interface so other dumps implement it and add fields.
export interface ExtendedReportDump
{
	blockType: ExtendedReportType;
}

/**
 * Get the RTCP packet type.
 *
 * @hidden
 */
function getExtendedReportType(view: DataView): ExtendedReportType
{
	return view.getUint8(0);
}

/**
 * Read the block length value of an Extended Report and compute its size in
 * bytes (including first octet).
 *
 * @hidden
 */
function getExtendedReportLength(view: DataView): number
{
	// As per RFC 3611, this is the length of this Extended Report in 32-bit words
	// minus one, including the header and any padding.
	const length = view.getUint16(2);
	const byteLength = (length + 1) * 4;

	return byteLength;
}

/**
 * Writes given length (in bytes) in the block length field of an Extended
 * Report.
 *
 * @hidden
 */
function setExtendedReportLength(view: DataView, byteLength: number): void
{
	// Report byte length must be multiple of 4.
	if (byteLength % 4 !== 0)
	{
		throw new RangeError(
			`Extended Report byte length must be multiple of 4 but given byte length is ${byteLength} bytes`
		);
	}

	const length = (byteLength / 4) - 1;

	view.setUint16(2, length);
}

function blockTypeToString(blockType: ExtendedReportType): string
{
	switch (blockType)
	{
		case ExtendedReportType.LRLE:
		{
			return 'Loss RLE';
		}

		case ExtendedReportType.DRLE:
		{
			return 'Duplicate RLE';
		}

		case ExtendedReportType.PRT:
		{
			return 'Packet Receipt Times';
		}

		case ExtendedReportType.RRT:
		{
			return 'Receiver Reference Time';
		}

		case ExtendedReportType.DLRR:
		{
			return 'DLRR';
		}

		case ExtendedReportType.SS:
		{
			return 'Statistics Summary';
		}

		case ExtendedReportType.VM:
		{
			return 'VoIP Metrics';
		}

		default:
		{
			assertUnreachable(blockType);
		}
	}
}

/**
 * RTCP XR packet.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
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

		let count = this.getCount();

		while (count-- > 0)
		{
			// TODO

			// this.#reports.push(report);
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
	serialize(): void
	{
		const view = super.serializeBase();
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
			// TODO
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength)
		{
			throw new RangeError(
				`computed packet length (${pos} bytes) is different than the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Assert that RTCP header length field is correct.
		if (getRtcpLength(view) !== view.byteLength)
		{
			throw new RangeError(
				`length in the RTCP header (${getRtcpLength(view)} bytes) does not match the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): XrPacket
	{
		const view = this.cloneInternal(buffer, byteOffset);

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

		// Update RTCP count.
		this.setCount(this.#reports.length);

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
		this.setCount(this.#reports.length);

		this.setSerializationNeeded(true);
	}
}

/**
 * Parent class of all Extended Reports.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export abstract class ExtendedReport extends Serializable
{
	readonly #blockType: ExtendedReportType;

	protected constructor(blockType: ExtendedReportType, view?: DataView)
	{
		super(view);

		this.#blockType = blockType;

		if (this.view)
		{
			// Extended Report byte length must be multiple of 4.
			if (this.view.byteLength % 4 !== 0)
			{
				throw new RangeError(
					`Extended Report byte length must be multiple of 4 but given buffer view is ${this.view.byteLength} bytes`
				);
			}
			else if (getExtendedReportType(this.view) !== blockType)
			{
				throw new TypeError(`not a ${blockTypeToString(blockType)} Extended Report`);
			}
			else if (getExtendedReportLength(this.view) !== this.view.byteLength)
			{
				throw new RangeError(
					`length in the RTCP header (${getExtendedReportLength(this.view)} bytes) does not match view length (${this.view.byteLength} bytes)`
				);
			}
		}
	}

	/**
	 * Base Extended Report dump.
	 *
	 * @remarks
	 * - Read the info dump type of each Extended Report instead.
	 */
	dump(): ExtendedReportDump
	{
		return {
			blockType : this.#blockType
		};
	}

	/**
	 * Get the Extended Report block type.
	 */
	getBlockType(): ExtendedReportType
	{
		return this.view.getUint8(1);
	}

	protected writeCommonHeader(): void
	{
		this.setBlockType(this.#blockType);
	}

	/**
	 * Serialize base RTCP packet into a new buffer.
	 */
	protected serializeBase(): DataView
	{
		const blockLength = this.getByteLength();
		const { buffer, byteOffset } = this.getSerializationBuffer(blockLength);

		// Create new DataView with new buffer.
		const view = new DataView(buffer, byteOffset, blockLength);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Copy the common header into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset,
				EXTENDED_REPORT_COMMON_HEADER_LENGTH
			),
			0
		);

		// Update the block length field in the report header.
		setExtendedReportLength(view, blockLength);

		return view;
	}

	/**
	 * Set the Extended Report block type.
	 *
	 * @privateRemarks
	 * - This method is not public since users should not manipulate this field
	 *   directly.
	 */
	private setBlockType(blockType: ExtendedReportType): void
	{
		this.view.setUint8(1, blockType);
	}
}
