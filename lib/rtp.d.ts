/// <reference types="node" />
/**
 * ```ts
 * import { isRtp } from 'rtp.js';
 * ```
 *
 * Inspect the given buffer and return a boolean indicating whether it could be
 * a valid RTP packet or not.
 *
 * ```ts
 * if (isRtp(buffer)) {
 *   console.log('it looks like a valid RTP packet');
 * }
 * ```
 */
export declare function isRtp(buffer: Buffer): boolean;
/**
 * ```ts
 * import { RtpPacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTP packet with methods to access and modify its fields.
 */
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
     *   (with just the minimal fixed header) will be created.
     * @throws if `buffer` is given and it does not contain a valid RTP packet.
     */
    constructor(buffer?: Buffer);
    /**
     * @ignore
     */
    dump(): any;
    /**
     * Get the internal buffer containing the serialized RTP binary packet. The
     * buffer is serialized only if needed (to apply packet modifications).
     *
     * @throws if buffer serialization is needed and it fails due to invalid
     *   fields.
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
     * Set the RTP CSRC values. If `csrc` is not given (or if it's an empty
     * array) CSRC field will be removed from the RTP packet.
     */
    setCsrc(csrc?: number[]): void;
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
     * Enable One-Byte extensions (RFC 5285).
     */
    enableOneByteExtensions(): void;
    /**
     * Enable Two-Bytes extensions (RFC 5285).
     */
    enableTwoBytesExtensions(): void;
    /**
     * Get the value of the extension (RFC 5285) with given `id` (if any).
     */
    getExtension(id: number): Buffer | undefined;
    /**
     * Set the value of the extension (RFC 5285) with given `id`.
     *
     * ```ts
     * // Assuming id 1 corresponds to the RTP MID extension.
     * packet.setExtension(1, Buffer.from('audio'));
     *
     * // Assuming id 3 corresponds to the RTP ssrc-audio-level extension.
     * packet.setExtension(3, Buffer.from([ 0b10010110 ]));
     * ```
     */
    setExtension(id: number, value: Buffer): void;
    /**
     * Delete the extension (RFC 5285) with given `id` (if any).
     */
    deleteExtension(id: number): void;
    /**
     * Clear all extensions (RFC 5285).
     */
    clearExtensions(): void;
    /**
     * Get the packet payload.
     */
    getPayload(): Buffer;
    /**
     * Set the packet payload.
     *
     * ```ts
     * packet.setPayload(Buffer.from([ 0x01, 0x02, 0x03, 0x04 ]));
     * ```
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
     * Pad the packet total length to 4 bytes. To achieve it, this method may add
     * or remove bytes of padding.
     *
     * @throws if buffer serialization is needed and it fails due to invalid
     *   fields.
     */
    padTo4Bytes(): void;
    /**
     * Clone the packet. The cloned packet does not share any memory with the
     * original one.
     *
     * @throws if buffer serialization is needed and it fails due to invalid
     *   fields.
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
     * @throws if payload length is less than 2 bytes, so RTX decode is not
     *   possible.
     */
    rtxDecode(payloadType: number, ssrc: number): void;
    private setVersion;
    private setHeaderExtensionBit;
    private setPaddingBit;
    private serialize;
}
//# sourceMappingURL=rtp.d.ts.map