import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	getRtcpLength,
	COMMON_HEADER_LENGTH
} from './RtcpPacket';
import { Serializable } from '../Serializable';

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
 * Extended Report block types.
 */
// ESLint absurdly complains about "'ExtendedReportBlockType' is already declared
// in the upper scope".
// eslint-disable-next-line no-shadow
export enum ExtendedReportBlockType
{
	/**
	 * Loss RLE Report Block.
	 */
	LRLE = 1,
	/**
	 * Duplicate RLE Report Block.
	 */
	DRLE = 2,
	/**
	 * Packet Receipt Times Report Block.
	 */
	PRT = 3,
	/**
	 * Receiver Reference Time Report Block.
	 */
	RRT = 4,
	/**
	 * DLRR Report Block.
	 */
	DLRR = 5,
	/**
	 * Statistics Summary Report Block.
	 */
	SS = 6,
	/**
	 * VoIP Metrics Report Block.
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
	type: ExtendedReportBlockType;
}
