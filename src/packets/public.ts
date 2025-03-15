/**
 * @module packets
 *
 * @example
 * ```ts
 * import * as packets from 'rtp.js/packets';
 *
 * const {
 *   isRtp,
 *   isRtcp,
 *   RtpPacket,
 *   CompoundPacket,
 *   ReceiverReportPacket,
 *   SenderReportPacket,
 *   ReceptionReport,
 *   ByePacket,
 *   SdesPacket,
 *   NackPacket,
 *   SrReqPacket,
 *   EcnPacket,
 *   PliPacket,
 *   SliPacket,
 *   RpsiPacket,
 *   XrPacket,
 *   ExtendedJitterReportsPacket,
 *   GenericPacket,
 *   // etc.
 * } = packets;
 * ```
 */

// NOTE: We need to export Serializable, otherwise TypeDoc doesn't document
// inherited methods.
export { Serializable } from './Serializable';
export type { SerializableDump } from './Serializable';

// NOTE: We need to export Packet, otherwise TypeDoc doesn't document inherited
// methods.
export { Packet } from './Packet';
export type { PacketDump } from './Packet';

export { isRtp, RtpPacket } from './RTP/RtpPacket';
export type { RtpPacketDump } from './RTP/RtpPacket';

export {
	rtpExtensionUriToType,
	timeMsToAbsSendTime,
} from './RTP/rtpExtensions';
export type {
	RtpExtensionType,
	RtpExtensionMapping,
	SsrcAudioLevelExtension,
	VideoOrientationExtension,
} from './RTP/rtpExtensions';

export { isRtcp, RtcpPacket } from './RTCP/RtcpPacket';
export type { RtcpPacketType, RtcpPacketDump } from './RTCP/RtcpPacket';

export { CompoundPacket } from './RTCP/CompoundPacket';
export type { CompoundPacketDump } from './RTCP/CompoundPacket';

export {
	ReceiverReportPacket,
	ReceptionReport,
} from './RTCP/ReceiverReportPacket';
export type {
	ReceiverReportPacketDump,
	ReceptionReportDump,
} from './RTCP/ReceiverReportPacket';

export { SenderReportPacket } from './RTCP/SenderReportPacket';
export type { SenderReportPacketDump } from './RTCP/SenderReportPacket';

export { ByePacket } from './RTCP/ByePacket';
export type { ByePacketDump } from './RTCP/ByePacket';

export { SdesPacket, SdesChunk } from './RTCP/SdesPacket';
export type {
	SdesPacketDump,
	SdesChunkDump,
	SdesItemType,
} from './RTCP/SdesPacket';

export { FeedbackPacket } from './RTCP/FeedbackPacket';
export type {
	RtpFeedbackMessageType,
	PsFeedbackMessageType,
	FeedbackPacketDump,
} from './RTCP/FeedbackPacket';

export { NackPacket, parseNackItem, createNackItem } from './RTCP/NackPacket';
export type { NackPacketDump } from './RTCP/NackPacket';

export { SrReqPacket } from './RTCP/SrReqPacket';
export type { SrReqPacketDump } from './RTCP/SrReqPacket';

export { EcnPacket } from './RTCP/EcnPacket';
export type { EcnPacketDump } from './RTCP/EcnPacket';

export { PliPacket } from './RTCP/PliPacket';
export type { PliPacketDump } from './RTCP/PliPacket';

export { SliPacket } from './RTCP/SliPacket';
export type { SliPacketDump } from './RTCP/SliPacket';

export { RpsiPacket } from './RTCP/RpsiPacket';
export type { RpsiPacketDump } from './RTCP/RpsiPacket';

export { GenericFeedbackPacket } from './RTCP/GenericFeedbackPacket';
export type { GenericFeedbackPacketDump } from './RTCP/GenericFeedbackPacket';

export { XrPacket } from './RTCP/XrPacket';
export type { XrPacketDump } from './RTCP/XrPacket';

export { ExtendedReport } from './RTCP/extendedReports/ExtendedReport';
export type {
	ExtendedReportType,
	ExtendedReportDump,
} from './RTCP/extendedReports/ExtendedReport';

export { LrleExtendedReport } from './RTCP/extendedReports/LrleExtendedReport';
export type { LrleExtendedReportDump } from './RTCP/extendedReports/LrleExtendedReport';

export { DrleExtendedReport } from './RTCP/extendedReports/DrleExtendedReport';
export type { DrleExtendedReportDump } from './RTCP/extendedReports/DrleExtendedReport';

export { PrtExtendedReport } from './RTCP/extendedReports/PrtExtendedReport';
export type { PrtExtendedReportDump } from './RTCP/extendedReports/PrtExtendedReport';

export { RrtExtendedReport } from './RTCP/extendedReports/RrtExtendedReport';
export type { RrtExtendedReportDump } from './RTCP/extendedReports/RrtExtendedReport';

export { DlrrExtendedReport } from './RTCP/extendedReports/DlrrExtendedReport';
export type {
	DlrrExtendedReportDump,
	DlrrSubReport,
} from './RTCP/extendedReports/DlrrExtendedReport';

export { SsExtendedReport } from './RTCP/extendedReports/SsExtendedReport';
export type { SsExtendedReportDump } from './RTCP/extendedReports/SsExtendedReport';

export { VmExtendedReport } from './RTCP/extendedReports/VmExtendedReport';
export type { VmExtendedReportDump } from './RTCP/extendedReports/VmExtendedReport';

export { EcnExtendedReport } from './RTCP/extendedReports/EcnExtendedReport';
export type { EcnExtendedReportDump } from './RTCP/extendedReports/EcnExtendedReport';

export { GenericExtendedReport } from './RTCP/extendedReports/GenericExtendedReport';
export type { GenericExtendedReportDump } from './RTCP/extendedReports/GenericExtendedReport';

export {
	parseExtendedReportChunk,
	createExtendedReportRunLengthChunk,
	createExtendedReportBitVectorChunk,
} from './RTCP/extendedReports/chunks';
export type { ExtendedReportChunk } from './RTCP/extendedReports/chunks';

export { ExtendedJitterReportsPacket } from './RTCP/ExtendedJitterReportsPacket';
export type { ExtendedJitterReportsPacketDump } from './RTCP/ExtendedJitterReportsPacket';

export { GenericPacket } from './RTCP/GenericPacket';
export type { GenericPacketDump } from './RTCP/GenericPacket';
