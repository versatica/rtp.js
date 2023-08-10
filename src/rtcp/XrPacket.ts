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



// Common RTCP header length + 4.
const FIXED_HEADER_LENGTH = COMMON_HEADER_LENGTH + 4;

const EXTENDED_REPORT_MIN_LENGTH = 4;

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
}
