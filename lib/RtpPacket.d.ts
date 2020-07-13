/// <reference types="node" />
export declare type RtpHeaderExtension = {
    id: number;
    value: Buffer;
};
export declare class RtpPacket {
    private buffer;
    private serializationNeeded;
    private readonly version;
    private payloadType;
    private sequenceNumber;
    private timestamp;
    private ssrc;
    private csrc;
    private marker;
    private headerExtension?;
    private extensions;
    private payload?;
    private padding;
    constructor(buffer: Buffer);
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
    getHeaderExtension(): RtpHeaderExtension | undefined;
    setHeaderExtension(headerExtension?: RtpHeaderExtension): void;
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
    parseExtensions(): void;
    serialize(): void;
    clone(): RtpPacket;
}
export declare function isRtp(buffer: Buffer): boolean;
export declare function parseRtp(buffer: Buffer): RtpPacket;
//# sourceMappingURL=RtpPacket.d.ts.map