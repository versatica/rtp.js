"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("./Logger");
const RTP_VERSION = 2;
const FIXED_HEADER_LENGTH = 12;
const logger = new Logger_1.Logger('RtpPacket');
class RtpPacket {
    constructor(buffer) {
        // RTP version.
        this.version = RTP_VERSION;
        // Payload type.
        this.payloadType = 0;
        // Sequence number.
        this.sequenceNumber = 0;
        // Timestamp.
        this.timestamp = 0;
        // SSRC.
        this.ssrc = 0;
        // CSRC.
        this.csrc = [];
        // Marker flag.
        this.marker = false;
        // Number of bytes of padding.
        this.padding = 0;
        logger.debug('constructor()');
        this.buffer = buffer;
    }
    getVersion() {
        return this.version;
    }
    getPayloadType() {
        return this.payloadType;
    }
    setPayloadType(payloadType) {
        this.payloadType = payloadType;
    }
    getSequenceNumber() {
        return this.sequenceNumber;
    }
    setSequenceNumber(sequenceNumber) {
        this.sequenceNumber = sequenceNumber;
    }
    getTimestamp() {
        return this.timestamp;
    }
    setTimestamp(timestamp) {
        this.timestamp = timestamp;
    }
    getSsrc() {
        return this.ssrc;
    }
    setSsrc(ssrc) {
        this.ssrc = ssrc;
    }
    getCsrc() {
        return this.csrc;
    }
    setCsrc(csrc) {
        this.csrc = csrc;
    }
    getMarker() {
        return this.marker;
    }
    setMarker(marker) {
        this.marker = marker;
    }
    getPadding() {
        return this.padding;
    }
    setPadding(padding) {
        this.padding = padding;
    }
    getHeaderExtension() {
        return this.headerExtension;
    }
    setHeaderExtension(headerExtension) {
        this.headerExtension = headerExtension;
    }
    getPayload() {
        return this.payload;
    }
    setPayload(payload) {
        this.payload = payload;
    }
}
exports.RtpPacket = RtpPacket;
function isRtp(buffer) {
    const firstByte = buffer.readUInt8(0);
    return (Buffer.isBuffer(buffer) &&
        buffer.length >= FIXED_HEADER_LENGTH &&
        // DOC: https://tools.ietf.org/html/draft-ietf-avtcore-rfc5764-mux-fixes
        (buffer[0] > 127 && buffer[0] < 192) &&
        // RTP Version must be 2.
        (firstByte >> 6) === RTP_VERSION);
}
exports.isRtp = isRtp;
function parseRtp(buffer) {
    if (!isRtp(buffer)) {
        throw new TypeError('not a valid RTP packeet');
    }
    const packet = new RtpPacket(buffer);
    const firstByte = buffer.readUInt8(0);
    const secondByte = buffer.readUInt8(1);
    let parsedLength = FIXED_HEADER_LENGTH;
    // Parse payload type.
    const payloadType = secondByte & 0x7F;
    packet.setPayloadType(payloadType);
    // Parse sequence number.
    const sequenceNumber = buffer.readUInt16BE(2);
    packet.setSequenceNumber(sequenceNumber);
    // Parse timestamp.
    const timestamp = buffer.readUInt32BE(4);
    packet.setTimestamp(timestamp);
    // Parse SSRC.
    const ssrc = buffer.readUInt32BE(8);
    packet.setSsrc(ssrc);
    // Parse marker.
    const marker = Boolean(secondByte >> 7);
    packet.setMarker(marker);
    // Parse padding.
    const paddingFlag = Boolean((firstByte >> 5) & 1);
    if (paddingFlag) {
        const lastByte = buffer.readUInt8(buffer.length - 1);
        packet.setPadding(lastByte);
    }
    // Parse CSRC.
    const csrcCount = firstByte & 0x0F;
    if (csrcCount > 0) {
        if (buffer.length < parsedLength + (csrcCount * 4)) {
            throw new TypeError('no space for announced CSRC count');
        }
        const csrc = [];
        for (let idx = 0; idx < csrcCount; ++idx) {
            parsedLength += (idx * 4);
            csrc.push(buffer.readUInt32BE(parsedLength));
        }
        packet.setCsrc(csrc);
    }
    // Parse header extension.
    const extensionFlag = Boolean((firstByte >> 4) & 1);
    if (extensionFlag) {
        const id = Buffer.from(buffer.buffer, parsedLength, 2);
        const length = buffer.readUInt16BE(parsedLength + 2) * 4;
        const value = Buffer.from(buffer.buffer, parsedLength + 4, length);
        packet.setHeaderExtension({ id, value });
        parsedLength += (4 + length);
    }
    // Parse payload.
    const payloadLength = buffer.length - parsedLength - packet.getPadding();
    if (payloadLength < 0) {
        throw new TypeError('announced padding bigger than available space for payload');
    }
    const payload = Buffer.from(buffer.buffer, parsedLength, payloadLength);
    packet.setPayload(payload);
    parsedLength += (payload.length + packet.getPadding());
    // Ensure that buffer length and parsed length match.
    if (parsedLength !== buffer.length) {
        throw new TypeError('parsed length does not match buffer length');
    }
    return packet;
}
exports.parseRtp = parseRtp;
