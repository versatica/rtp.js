/// <reference types="node" />
export declare enum PacketType {
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
export declare abstract class RtcpPacket {
    protected buffer: Buffer;
    private packetType;
    /**
     * @ignore
     *
     * @param PacketType.
     */
    protected constructor(packetType: PacketType);
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
     * Get the padding flag.
     */
    getPadding(): boolean;
    /**
     * Set the padding flag.
     */
    setPadding(padding: boolean): void;
    /**
     * Get the RTCP header count value.
     */
    getCount(): number;
    /**
     * Set the RTCP header count value.
     */
    protected setCount(count: number): void;
    /**
     * Get the RTCP packet type.
     */
    getPacketType(): PacketType;
    /**
     * Get the RTCP packet length.
     */
    getLength(): number;
    /**
     * Serialize RTCP packet into a new buffer.
     */
    protected serialize(length: number): void;
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
}
//# sourceMappingURL=packet.d.ts.map