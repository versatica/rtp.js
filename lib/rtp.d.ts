/**
 * RTP classes and utilities.
 *
 * @packageDocumentation
 */
/// <reference types="node" />
/**
 * Inspect the given buffer and return a boolean indicating whether it could be
 * a valid RTP packet or not.
 *
 * ```ts
 * if (isRtp(buffer)) {
 *   console.log('it seems a valid RTP packet');
 * }
 * ```
 */
export declare function isRtp(buffer: Buffer): boolean;
export declare class RtpPacket {
    private buffer;
    private csrc;
    private headerExtensionId?;
    private readonly extensions;
    private payload;
    private padding;
    private serializationNeeded;
    /**
     * @param buffer - If given if will be parsed. Otherwise an empty RTP packet
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
     * Get the RTP version of the packet (always 2).
     */
    getVersion(): number;
    /**
     * Get the RTP payload type.
     */
    getPayloadType(): number;
    /**
     * Set the RTP payload type.
     */
    setPayloadType(payloadType: number): void;
    /**
     * Get the RTP sequence number.
     */
    getSequenceNumber(): number;
    /**
     * Set the RTP sequence number.
     */
    setSequenceNumber(sequenceNumber: number): void;
    /**
     * Get the RTP timestamp.
     */
    getTimestamp(): number;
    /**
     * Set the RTP timestamp.
     */
    setTimestamp(timestamp: number): void;
    /**
     * Get the RTP SSRC.
     */
    getSsrc(): number;
    /**
     * Set the RTP SSRC.
     */
    setSsrc(ssrc: number): void;
    /**
     * Get the RTP CSRC values.
     */
    getCsrc(): number[];
    /**
     * Set the RTP CSRC values.
     */
    setCsrc(csrc: number[]): void;
    /**
     * Get the RTP marker flag.
     */
    getMarker(): boolean;
    /**
     * Set the RTP marker flag.
     */
    setMarker(marker: boolean): void;
    /**
     * Whether One-Byte extensions (as per RFC 5285) are enabled.
     */
    hasOneByteExtensions(): boolean;
    /**
     * Whether Two-Bytes extensions (as per RFC 5285) are enabled.
     */
    hasTwoBytesExtensions(): boolean;
    /**
     * Enable One-Byte extensions.
     */
    setOneByteExtensions(): void;
    /**
     * Enable Two-Bytes extensions.
     */
    setTwoBytesExtensions(): void;
    /**
     * Get the value of the extension with given `id` (if any).
     */
    getExtension(id: number): Buffer | undefined;
    /**
     * Set the value of the extension with given `id`.
     */
    setExtension(id: number, value: Buffer): void;
    /**
     * Delete the extension with given `id` (if any).
     */
    deleteExtension(id: number): void;
    /**
     * Clear all extensions.
     */
    clearExtensions(): void;
    /**
     * Get the packet payload.
     */
    getPayload(): Buffer;
    /**
     * Set the packet payload.
     */
    setPayload(payload: Buffer): void;
    /**
     * Get the padding (in bytes) after the packet payload.
     */
    getPadding(): number;
    /**
     * Set the padding (in bytes) after the packet payload.
     */
    setPadding(padding: number): void;
    /**
     * Pad the packet total legth to 4 bytes. To achieve it, this method may add
     * or remove bytes of padding.
     */
    padTo4Bytes(): void;
    /**
     * Clone the packet. The cloned packet does not share any memory with the
     * original one.
     */
    clone(): RtpPacket;
    /**
     * Encode the packet using RTX procedures (as per RFC 4588).
     *
     * @param payloadType - The RTX payload type.
     * @param ssrc - The RTX SSRC.
     * @param sequenceNumber - The RTX sequence number.
     */
    rtxEncode(payloadType: number, ssrc: number, sequenceNumber: number): void;
    /**
     * Decode the packet using RTX procedures (as per RFC 4588).
     *
     * @param payloadType - The original payload type.
     * @param ssrc - The original SSRC.
     */
    rtxDecode(payloadType: number, ssrc: number): void;
    private setVersion;
    private setHeaderExtensionBit;
    private setPaddingBit;
    private serialize;
}
//# sourceMappingURL=rtp.d.ts.map