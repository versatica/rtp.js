/// <reference types="node" />
/**
 * ```ts
 * import { RtcpPacketType } from 'rtp.js';
 * ```
 */
export declare enum RtcpPacketType {
    SR = 200,
    RR = 201,
    SDES = 202,
    BYE = 203,
    APP = 204,
    RTPFB = 205,
    PSFB = 206,
    XR = 207
}
/**
 * ```ts
 * import { isRtcp } from 'rtp.js';
 * ```
 *
 * Inspect the given buffer and return a boolean indicating whether it could be
 * a valid RTCP packet or not.
 *
 * ```ts
 * if (isRtcp(buffer)) {
 *   console.log('it seems a valid RTCP packet');
 * }
 * ```
 */
export declare function isRtcp(buffer: Buffer): boolean;
/**
 * ```ts
 * import { RtcpPacket } from 'rtp.js';
 * ```
 *
 * Representation of a base RTCP packet.
 */
export declare abstract class RtcpPacket {
    protected buffer: Buffer;
    private packetType;
    protected padding: number;
    protected serializationNeeded: boolean;
    /**
     * @ignore
     *
     * @param Buffer.
     */
    static getCount(buffer: Buffer): number;
    /**
     * @ignore
     *
     * @param Buffer.
     */
    static getLength(buffer: Buffer): number;
    /**
     * @ignore
     *
     * @param PacketType.
     */
    protected constructor(packetType: RtcpPacketType);
    /**
     * @ignore
     */
    dump(): any;
    /**
     * Get the internal buffer containing the serialized RTCP binary packet.
     */
    abstract getBuffer(): Buffer;
    /**
     * Get the RTCP version of the packet (always 2).
     */
    getVersion(): number;
    /**
     * Get the padding (in bytes) after the packet payload.
     */
    getPadding(): number;
    /**
     * Set the padding (in bytes) after the packet payload.
     */
    setPadding(padding: number): void;
    /**
     * Get the RTCP header count value.
     */
    getCount(): number;
    /**
     * Get the RTCP packet type.
     */
    getPacketType(): RtcpPacketType;
    /**
     * Get the RTCP packet length.
     */
    getLength(): number;
    /**
     * Set the RTCP header count value.
     */
    protected setCount(count: number): void;
    /**
     * Serialize RTCP packet into a new buffer.
     */
    protected serialize(length: number): void;
    protected writeCommonHeader(): void;
    /**
     * Set the RTCP version of the packet (always 2).
     */
    private setVersion;
    /**
     * Set the RTCP packet type.
     */
    private setPacketType;
    /**
     * Set the RTCP packet length.
     */
    private setLength;
    /**
     * Set the padding bit.
     */
    private setPaddingBit;
}
//# sourceMappingURL=index.d.ts.map