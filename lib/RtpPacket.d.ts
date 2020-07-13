/// <reference types="node" />
export declare function isRtp(buffer: Buffer): boolean;
export declare class RtpPacket {
    private buffer;
    private csrc;
    private headerExtensionId?;
    private readonly extensions;
    private payload;
    private padding;
    private serializationNeeded;
    constructor(buffer?: Buffer);
    dump(): any;
    getBuffer(): Buffer;
    getVersion(): number;
    setVersion(): void;
    getPayloadType(): number;
    setPayloadType(payloadType: number): void;
    getSequenceNumber(): number;
    setSequenceNumber(sequenceNumber: number): void;
    getTimestamp(): number;
    setTimestamp(timestamp: number): void;
    getSsrc(): number;
    setSsrc(ssrc: number): void;
    getCsrc(): number[];
    setCsrc(csrc: number[]): void;
    getMarker(): boolean;
    setMarker(marker: boolean): void;
    hasOneByteExtensions(): boolean;
    hasTwoBytesExtensions(): boolean;
    setOneByteExtensions(): void;
    setTwoBytesExtensions(): void;
    getExtension(id: number): Buffer | undefined;
    setExtension(id: number, value: Buffer): void;
    deleteExtension(id: number): void;
    clearExtensions(): void;
    getPayload(): Buffer;
    setPayload(payload: Buffer): void;
    getPadding(): number;
    setPadding(padding: number): void;
    isSerializationNeeded(): boolean;
    serialize(): void;
    clone(): RtpPacket;
    rtxEncode(payloadType: number, ssrc: number, sequenceNumber: number): void;
    rtxDecode(payloadType: number, ssrc: number): void;
    private setHeaderExtensionBit;
    private setPaddingBit;
}
//# sourceMappingURL=RtpPacket.d.ts.map