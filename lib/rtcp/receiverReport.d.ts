/// <reference types="node" />
import { RtcpPacket, PacketType } from './packet';
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
    getSsrc(): number;
    setSsrc(ssrc: number): void;
    getFractionLost(): number;
    setFractionLost(fractionLost: number): void;
    getTotalLost(): number;
    setTotalLost(totalLost: number): void;
    getHighestSeqNumber(): number;
    setHighestSeqNumber(lastSeq: number): void;
    getJitter(): number;
    setJitter(jitter: number): void;
    getLastSRTimestamp(): number;
    setLastSRTimestamp(lsr: number): void;
    getDelaySinceLastSR(): number;
    setDelaySinceLastSR(dlsr: number): void;
}
export declare class ReceiverReportPacket extends RtcpPacket {
    private reports;
    private serializationNeeded;
    static packetType: PacketType;
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
    getSsrc(): number;
    setSsrc(ssrc: number): void;
    getReports(): ReceiverReport[];
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