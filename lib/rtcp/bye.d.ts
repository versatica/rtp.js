/// <reference types="node" />
import { RtcpPacket, RtcpPacketType } from './';
/**
 * ```ts
 * import { ByePacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Bye packet.
 */
export declare class ByePacket extends RtcpPacket {
    static packetType: RtcpPacketType;
    private readonly ssrcs;
    private reason?;
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
     * Get SSRCs.
     */
    getSsrcs(): number[];
    /**
     * Add a SSRC.
     */
    addSsrc(ssrc: number): void;
    /**
     * Get reason.
     */
    getReason(): string | undefined;
    /**
     * Set reason.
     */
    setReason(reason?: string): void;
    /**
     * Apply pending changes into the packet and serialize it into a new internal
     * buffer (the one that [[getBuffer]] will later return).
     *
     * **NOTE:** In most cases there is no need to use this method. It must be
     * called only if the application retrieves information from the packet (by
     * calling [[getBuffer]], [[getSsrcs]], etc) and modifies the obtained
     * buffers in place. However, it's recommended to use the existing setter
     * methods instead ([[addSsrc]], etc).
     *
     */
    serialize(): void;
}
//# sourceMappingURL=bye.d.ts.map