/// <reference types="node" />
import { RtcpPacket, RtcpPacketType } from './';
import { ReceiverReport } from './receiverReport';
/**
 * ```ts
 * import { SenderReportPacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Sender Report packet. It may contain various
 * [[ReceiverReport]] instances.
 */
export declare class SenderReportPacket extends RtcpPacket {
    static packetType: RtcpPacketType;
    private readonly reports;
    /**
     * @param buffer - If given it will be parsed. Otherwise an empty RTP packet
     *   will be created.
     */
    constructor(buffer?: Buffer);
    /**
     * @ignore
     */
    dump(): any;
    /**
     * Get the internal buffer containing the serialized RTP binary packet.
     */
    getBuffer(): Buffer;
    /**
     * Get sender SSRC.
     */
    getSsrc(): number;
    /**
     * Set sender SSRC.
     */
    setSsrc(ssrc: number): void;
    /**
     * Get NTP seconds.
     */
    getNtpSeconds(): number;
    /**
     * Set NTP seconds.
     */
    setNtpSeconds(seconds: number): void;
    /**
     * Get NTP fraction.
     */
    getNtpFraction(): number;
    /**
     * Set NTP fraction.
     */
    setNtpFraction(fraction: number): void;
    /**
     * Get RTP Timestamp.
     */
    getRtpTimestamp(): number;
    /**
     * Set RTP Timestamp.
     */
    setRtpTimestamp(timestamp: number): void;
    /**
     * Get RTP packet count.
     */
    getPacketCount(): number;
    /**
     * Set RTP packet count.
     */
    setPacketCount(timestamp: number): void;
    /**
     * Get RTP octect count.
     */
    getOctetCount(): number;
    /**
     * Set RTP octect count.
     */
    setOctetCount(timestamp: number): void;
    /**
     * Get Receiver Reports.
     */
    getReports(): ReceiverReport[];
    /**
     * Add a Receiver Report.
     */
    addReport(report: ReceiverReport): void;
    /**
     * Apply pending changes into the packet and serialize it into a new internal
     * buffer (the one that [[getBuffer]] will later return).
     *
     * **NOTE:** In most cases there is no need to use this method. It must be
     * called only if the application retrieves information from the packet (by
     * calling [[getBuffer]], [[getReports]], etc) and modifies the obtained
     * buffers in place. However, it's recommended to use the existing setter
     * methods instead ([[addReport]], etc).
     *
     */
    serialize(): void;
}
//# sourceMappingURL=senderReport.d.ts.map