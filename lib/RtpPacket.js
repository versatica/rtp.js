"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("./Logger");
const utils_1 = require("./utils");
const RTP_VERSION = 2;
const FIXED_HEADER_LENGTH = 12;
const logger = new Logger_1.Logger('RtpPacket');
class RtpPacket {
    constructor(buffer) {
        // Whether serialization is needed due to modifications.
        this.serializationNeeded = false;
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
        // One-Byte or Two-Bytes extensions.
        this.extensions = new Map();
        // Number of bytes of padding.
        this.padding = 0;
        this.buffer = buffer;
    }
    dump() {
        var _a;
        const headerExtension = this.getHeaderExtension();
        const extensions = {};
        for (const [id, value] of this.extensions) {
            extensions[id] = value;
        }
        return {
            version: this.version,
            payloadType: this.payloadType,
            sequenceNumber: this.sequenceNumber,
            timestamp: this.timestamp,
            ssrc: this.ssrc,
            csrc: this.csrc,
            marker: this.marker,
            headerExtension: headerExtension
                ? {
                    id: headerExtension.id,
                    length: headerExtension.value.length
                }
                : undefined,
            extensions: extensions,
            payloadLength: ((_a = this.payload) === null || _a === void 0 ? void 0 : _a.length) || 0,
            padding: this.padding
        };
    }
    getBuffer() {
        if (this.serializationNeeded) {
            this.serialize();
        }
        return this.buffer;
    }
    getVersion() {
        return this.version;
    }
    getPayloadType() {
        return this.payloadType;
    }
    setPayloadType(payloadType) {
        // TODO: No. Write the payloadType directly in this.buffer.
        // Same for other setters.
        if (payloadType !== this.payloadType) {
            this.serializationNeeded = true;
        }
        this.payloadType = payloadType;
    }
    getSequenceNumber() {
        return this.sequenceNumber;
    }
    setSequenceNumber(sequenceNumber) {
        if (sequenceNumber !== this.sequenceNumber) {
            this.serializationNeeded = true;
        }
        this.sequenceNumber = sequenceNumber;
    }
    getTimestamp() {
        return this.timestamp;
    }
    setTimestamp(timestamp) {
        if (timestamp !== this.timestamp) {
            this.serializationNeeded = true;
        }
        this.timestamp = timestamp;
    }
    getSsrc() {
        return this.ssrc;
    }
    setSsrc(ssrc) {
        if (ssrc !== this.ssrc) {
            this.serializationNeeded = true;
        }
        this.ssrc = ssrc;
    }
    getCsrc() {
        return this.csrc;
    }
    setCsrc(csrc) {
        this.serializationNeeded = true;
        this.csrc = csrc;
    }
    getMarker() {
        return this.marker;
    }
    setMarker(marker) {
        if (marker !== this.marker) {
            this.serializationNeeded = true;
        }
        this.marker = marker;
    }
    getHeaderExtension() {
        return this.headerExtension;
    }
    setHeaderExtension(headerExtension) {
        this.serializationNeeded = true;
        this.headerExtension = headerExtension;
    }
    HasOneByteExtensions() {
        var _a;
        return ((_a = this.headerExtension) === null || _a === void 0 ? void 0 : _a.id) === 0xBEDE;
    }
    HasTwoBytesExtensions() {
        var _a;
        return (((((_a = this.headerExtension) === null || _a === void 0 ? void 0 : _a.id) || 0) & 0b1111111111110000) ===
            0b0001000000000000);
    }
    getExtensionById(id) {
        return this.extensions.get(id);
    }
    setExtensionById(id, value) {
        this.serializationNeeded = true;
        this.extensions.set(id, value);
    }
    deleteExtensionById(id) {
        if (this.extensions.delete(id)) {
            this.serializationNeeded = true;
        }
    }
    clearExtensions() {
        this.serializationNeeded = true;
        this.extensions.clear();
    }
    getPayload() {
        return this.payload;
    }
    setPayload(payload) {
        this.serializationNeeded = true;
        this.payload = payload;
    }
    getPadding() {
        return this.padding;
    }
    setPadding(padding) {
        this.serializationNeeded = true;
        this.padding = padding;
    }
    parseExtensions() {
        this.extensions.clear();
        if (this.HasOneByteExtensions()) {
            const buffer = this.headerExtension.value;
            let pos = 0;
            // One-Byte extensions cannot have length 0.
            while (pos < buffer.length) {
                const id = (buffer[pos] & 0xF0) >> 4;
                const length = (buffer[pos] & 0x0F) + 1;
                // id=15 in One-Byte extensions means "stop parsing here".
                if (id === 15) {
                    break;
                }
                // Valid extension id.
                if (id !== 0) {
                    if (pos + 1 + length > buffer.length) {
                        logger.warn('parseExtensions() | not enough space for the announced One-Byte extension value');
                        break;
                    }
                    // Store the One-Byte extension element in the map.
                    this.extensions.set(id, Buffer.from(buffer.buffer, buffer.byteOffset + pos + 1, length));
                    pos += (length + 1);
                }
                // id=0 means alignment.
                else {
                    ++pos;
                }
                // Counting padding bytes.
                while (pos < buffer.length && buffer[pos] === 0) {
                    ++pos;
                }
            }
        }
        else if (this.HasTwoBytesExtensions()) {
            const buffer = this.headerExtension.value;
            let pos = 0;
            // Two-Byte extensions can have length 0.
            while (pos + 1 < buffer.length) {
                const id = buffer[pos];
                const length = buffer[pos + 1];
                // Valid extension id.
                if (id !== 0) {
                    if (pos + 2 + length > buffer.length) {
                        logger.warn('parseExtensions() | not enough space for the announced Two-Bytes extension value');
                        break;
                    }
                    // Store the Two-Bytes extension element in the map.
                    this.extensions.set(id, Buffer.from(buffer.buffer, buffer.byteOffset + pos + 2, length));
                    pos += (length + 2);
                }
                // id=0 means alignment.
                else {
                    ++pos;
                }
                // Counting padding bytes.
                while (pos < buffer.length && buffer[pos] === 0) {
                    ++pos;
                }
            }
        }
    }
    serialize() {
        var _a;
        let length = FIXED_HEADER_LENGTH;
        length += this.csrc.length * 4;
        // If the extensions map is filled, trust it.
        // TODO: This will fail if I clear all extensions. So better have another
        // this.extensionsSerializationNeeded flag.
        if (this.extensions.size > 0) {
            if (this.HasOneByteExtensions()) {
                for (const value of this.extensions.values()) {
                    length += 1 + value.length;
                }
            }
            else if (this.HasTwoBytesExtensions()) {
                for (const value of this.extensions.values()) {
                    length += 2 + value.length;
                }
            }
        }
        // Otherwise trust the header extension.
        else if (this.headerExtension) {
            length += 4 + this.headerExtension.value.length;
        }
        length += ((_a = this.payload) === null || _a === void 0 ? void 0 : _a.length) || 0;
        length += this.padding;
        this.buffer = Buffer.alloc(length);
        // TODO: Do everything.
    }
    clone() {
        const clonedPacket = new RtpPacket(utils_1.clone(this.buffer));
        clonedPacket.setPayloadType(this.payloadType);
        clonedPacket.setSequenceNumber(this.sequenceNumber);
        clonedPacket.setTimestamp(this.timestamp);
        clonedPacket.setSsrc(this.ssrc);
        clonedPacket.setCsrc(utils_1.clone(this.csrc));
        clonedPacket.setMarker(this.marker);
        clonedPacket.setHeaderExtension(utils_1.clone(this.headerExtension));
        clonedPacket.setPayload(utils_1.clone(this.payload));
        clonedPacket.setPadding(this.padding);
        for (const [id, value] of this.extensions) {
            clonedPacket.setExtensionById(id, value);
        }
        return clonedPacket;
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
        throw new TypeError('invalid RTP packet');
    }
    const packet = new RtpPacket(buffer);
    const firstByte = buffer.readUInt8(0);
    const secondByte = buffer.readUInt8(1);
    let pos = FIXED_HEADER_LENGTH;
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
    // Parse CSRC.
    const csrcCount = firstByte & 0x0F;
    if (csrcCount > 0) {
        if (buffer.length < pos + (csrcCount * 4)) {
            throw new TypeError('no space for announced CSRC count');
        }
        const csrc = [];
        for (let i = 0; i < csrcCount; ++i) {
            csrc.push(buffer.readUInt32BE(pos));
            pos += 4;
        }
        packet.setCsrc(csrc);
    }
    // Parse header extension.
    const extensionFlag = Boolean((firstByte >> 4) & 1);
    if (extensionFlag) {
        const id = buffer.readUInt16BE(pos);
        const length = buffer.readUInt16BE(pos + 2) * 4;
        const value = Buffer.from(buffer.buffer, buffer.byteOffset + pos + 4, length);
        packet.setHeaderExtension({ id, value });
        pos += (4 + length);
    }
    // Get padding.
    const paddingFlag = Boolean((firstByte >> 5) & 1);
    if (paddingFlag) {
        const padding = buffer.readUInt8(buffer.length - 1);
        packet.setPadding(padding);
    }
    // Get payload.
    const paddingLength = packet.getPadding();
    const payloadLength = buffer.length - pos - paddingLength;
    if (payloadLength < 0) {
        throw new TypeError(`announced padding (${paddingLength} bytes) is bigger than available space for payload (${buffer.length - pos} bytes)`);
    }
    const payload = Buffer.from(buffer.buffer, buffer.byteOffset + pos, payloadLength);
    packet.setPayload(payload);
    pos += (payload.length + paddingLength);
    // Ensure that buffer length and parsed length match.
    if (pos !== buffer.length) {
        throw new TypeError(`parsed length (${pos} bytes) does not match buffer length (${buffer.length} bytes)`);
    }
    return packet;
}
exports.parseRtp = parseRtp;
