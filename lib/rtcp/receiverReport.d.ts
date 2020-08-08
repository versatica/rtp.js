/// <reference types="node" />
import { RtcpPacket, RtcpPacketType } from './';
/** @ignore */
export declare const REPORT_LENGTH = 24;
/**
 * ```ts
 * import { ReceiverReport } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Receiver Report.
 */
export declare class ReceiverReport {
    private buffer;
    /**
     * @param buffer - If given it will be parsed. Otherwise an empty RTCP Receiver
     *   Report will be created.
     */
    constructor(buffer?: Buffer);
    /**
     * @ignore
     */
    dump(): any;
    /**
     * Get the internal buffer containing the RTCP Receiver Report binary.
     */
    getBuffer(): Buffer;
    /**
     * Get receiver SSRC.
     */
    getSsrc(): number;
    /**
     * Set receiver SSRC.
     */
    setSsrc(ssrc: number): void;
    /**
     * Get fraction lost.
     */
    getFractionLost(): number;
    /**
     * Set fraction lost.
     */
    setFractionLost(fractionLost: number): void;
    /**
     * Get total lost.
     */
    getTotalLost(): number;
    /**
     * Set total lost.
     */
    setTotalLost(totalLost: number): void;
    /**
     * Get highest RTP sequence number.
     */
    getHighestSeqNumber(): number;
    /**
     * Set highest RTP sequence number.
     */
    setHighestSeqNumber(lastSeq: number): void;
    /**
     * Get interarrival jitter.
     */
    getJitter(): number;
    /**
     * Set interarrival jitter.
     */
    setJitter(jitter: number): void;
    /**
     * Set last Sender Report timestamp.
     */
    getLastSRTimestamp(): number;
    /**
     * Set last Sender Report timestamp.
     */
    setLastSRTimestamp(lsr: number): void;
    /**
     * Get delay since last Sender Report.
     */
    getDelaySinceLastSR(): number;
    /**
     * Set delay since last Sender Report.
     */
    setDelaySinceLastSR(dlsr: number): void;
}
/**
 * ```ts
 * import { ReceiverReportPacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Receiver Report packet. It may contain various
 * [[ReceiverReport]] instances.
 */
export declare class ReceiverReportPacket extends RtcpPacket {
    static packetType: RtcpPacketType;
    private reports;
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
//# sourceMappingURL=receiverReport.d.ts.map