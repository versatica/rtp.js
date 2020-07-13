/// <reference types="node" />
export declare function isRtp(buffer: Buffer): boolean;
export declare class RtpPacket {
    private buffer;
    private csrc;
    private headerExtension?;
    private extensions;
    private payload?;
    private padding;
    private serializationNeeded;
    constructor(buffer?: Buffer);
    dump(): any;
    getBuffer(): Buffer;
    getVersion(): number;
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
    HasOneByteExtensions(): boolean;
    HasTwoBytesExtensions(): boolean;
    getExtensionById(id: number): Buffer | undefined;
    setExtensionById(id: number, value: Buffer): void;
    deleteExtensionById(id: number): void;
    clearExtensions(): void;
    getPayload(): Buffer | undefined;
    setPayload(payload?: Buffer): void;
    getPadding(): number;
    setPadding(padding: number): void;
    isSerializationNeeded(): boolean;
    serialize(): void;
    clone(): RtpPacket;
}
//# sourceMappingURL=RtpPacket.d.ts.map