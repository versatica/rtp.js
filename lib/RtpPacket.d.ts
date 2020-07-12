/// <reference types="node" />
export declare type RtpHeaderExtension = {
    id: Buffer;
    value: Buffer;
};
export declare class RtpPacket {
    private buffer;
    private readonly version;
    private payloadType;
    private sequenceNumber;
    private timestamp;
    private ssrc;
    private csrc;
    private marker;
    private padding;
    private headerExtension?;
    private payload?;
    constructor(buffer: Buffer);
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
    getPadding(): number;
    setPadding(padding: number): void;
    getHeaderExtension(): RtpHeaderExtension | undefined;
    setHeaderExtension(headerExtension?: RtpHeaderExtension): void;
    getPayload(): Buffer | undefined;
    setPayload(payload?: Buffer): void;
}
export declare function isRtp(buffer: Buffer): boolean;
export declare function parseRtp(buffer: Buffer): RtpPacket;
//# sourceMappingURL=RtpPacket.d.ts.map