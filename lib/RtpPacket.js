"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const RTP_VERSION = 2;
const FIXED_HEADER_LENGTH = 12;
function isRtp(buffer) {
    const firstByte = buffer.readUInt8(0);
    return (Buffer.isBuffer(buffer) &&
        buffer.length >= FIXED_HEADER_LENGTH &&
        // DOC: https://tools.ietf.org/html/draft-ietf-avtcore-rfc5764-mux-fixes
        (firstByte > 127 && firstByte < 192) &&
        // RTP Version must be 2.
        (firstByte >> 6) === RTP_VERSION);
}
exports.isRtp = isRtp;
class RtpPacket {
    constructor(buffer) {
        // CSRC.
        this.csrc = [];
        // One-Byte or Two-Bytes extensions.
        this.extensions = new Map();
        // Number of bytes of padding.
        this.padding = 0;
        // Whether serialization is needed due to modifications.
        this.serializationNeeded = false;
        // If no buffer is given, create an empty one with minimum required length.
        if (!buffer) {
            this.buffer = Buffer.alloc(FIXED_HEADER_LENGTH);
            // Set version.
            this.setVersion();
            return;
        }
        if (!isRtp(buffer)) {
            throw new TypeError('invalid RTP packet');
        }
        this.buffer = buffer;
        const firstByte = buffer.readUInt8(0);
        let pos = FIXED_HEADER_LENGTH;
        // Parse CSRC.
        const csrcCount = firstByte & 0x0F;
        if (csrcCount > 0) {
            for (let i = 0; i < csrcCount; ++i) {
                // NOTE: This will throw RangeError if there is no space in the buffer.
                this.csrc.push(buffer.readUInt32BE(pos));
                pos += 4;
            }
        }
        // Parse header extension.
        const extensionFlag = Boolean((firstByte >> 4) & 1);
        if (extensionFlag) {
            // NOTE: This will throw RangeError if there is no space in the buffer.
            const id = buffer.readUInt16BE(pos);
            const length = buffer.readUInt16BE(pos + 2) * 4;
            const value = Buffer.from(buffer.buffer, buffer.byteOffset + pos + 4, length);
            this.headerExtension = { id, value };
            pos += (4 + length);
        }
        // Parse One-Byte or Two-Bytes extensions.
        if (this.hasOneByteExtensions()) {
            const extBuffer = this.headerExtension.value;
            let extPos = 0;
            // One-Byte extensions cannot have length 0.
            while (extPos < extBuffer.length) {
                const id = (extBuffer.readUInt8(extPos) & 0xF0) >> 4;
                const length = (extBuffer.readUInt8(extPos) & 0x0F) + 1;
                // id=15 in One-Byte extensions means "stop parsing here".
                if (id === 15) {
                    break;
                }
                // Valid extension id.
                if (id !== 0) {
                    if (extPos + 1 + length > extBuffer.length) {
                        throw new RangeError('not enough space for the announced One-Byte extension value');
                    }
                    // Store the One-Byte extension element in the map.
                    this.extensions.set(id, Buffer.from(extBuffer.buffer, extBuffer.byteOffset + extPos + 1, length));
                    extPos += (length + 1);
                }
                // id=0 means alignment.
                else {
                    ++extPos;
                }
                // Counting padding bytes.
                while (extPos < extBuffer.length && extBuffer.readUInt8(extPos) === 0) {
                    ++extPos;
                }
            }
        }
        else if (this.hasTwoBytesExtensions()) {
            const extBuffer = this.headerExtension.value;
            let extPos = 0;
            // Two-Byte extensions can have length 0.
            while (extPos + 1 < extBuffer.length) {
                const id = extBuffer.readUInt8(extPos);
                const length = extBuffer.readUInt8(extPos + 1);
                // Valid extension id.
                if (id !== 0) {
                    if (extPos + 2 + length > extBuffer.length) {
                        throw new RangeError('not enough space for the announced Two-Bytes extension value');
                    }
                    // Store the Two-Bytes extension element in the map.
                    this.extensions.set(id, Buffer.from(extBuffer.buffer, extBuffer.byteOffset + extPos + 2, length));
                    extPos += (length + 2);
                }
                // id=0 means alignment.
                else {
                    ++extPos;
                }
                // Counting padding bytes.
                while (extPos < extBuffer.length && extBuffer.readUInt8(extPos) === 0) {
                    ++extPos;
                }
            }
        }
        // Get padding.
        const paddingFlag = Boolean((firstByte >> 5) & 1);
        if (paddingFlag) {
            // NOTE: This will throw RangeError if there is no space in the buffer.
            this.padding = buffer.readUInt8(buffer.length - 1);
        }
        // Get payload.
        const payloadLength = buffer.length - pos - this.padding;
        if (payloadLength < 0) {
            throw new RangeError(`announced padding (${this.padding} bytes) is bigger than available space for payload (${buffer.length - pos} bytes)`);
        }
        this.payload =
            Buffer.from(buffer.buffer, buffer.byteOffset + pos, payloadLength);
        // Ensure that buffer length and parsed length match.
        pos += (payloadLength + this.padding);
        if (pos !== buffer.length) {
            throw new RangeError(`parsed length (${pos} bytes) does not match buffer length (${buffer.length} bytes)`);
        }
    }
    dump() {
        const extensions = {};
        for (const [id, value] of this.extensions) {
            extensions[id] = value;
        }
        return {
            version: this.getVersion(),
            payloadType: this.getPayloadType(),
            sequenceNumber: this.getSequenceNumber(),
            timestamp: this.getTimestamp(),
            ssrc: this.getSsrc(),
            csrc: this.csrc,
            marker: this.getMarker(),
            headerExtension: this.headerExtension
                ? {
                    id: this.headerExtension.id,
                    length: this.headerExtension.value.length
                }
                : undefined,
            extensions: extensions,
            payloadLength: this.payload ? this.payload.length : 0,
            padding: this.padding
        };
    }
    getBuffer() {
        return this.buffer;
    }
    getVersion() {
        return (this.buffer.readUInt8(0) >> 6);
    }
    setVersion() {
        this.buffer.writeUInt8(RTP_VERSION << 6, 0);
    }
    getPayloadType() {
        return (this.buffer.readUInt8(1) & 0x7F);
    }
    setPayloadType(payloadType) {
        this.buffer.writeUInt8(this.buffer.readUInt8(1) | (payloadType & 0x7F), 1);
    }
    getSequenceNumber() {
        return this.buffer.readUInt16BE(2);
    }
    setSequenceNumber(sequenceNumber) {
        this.buffer.writeUInt16BE(sequenceNumber, 2);
    }
    getTimestamp() {
        return this.buffer.readUInt32BE(4);
    }
    setTimestamp(timestamp) {
        this.buffer.writeUInt32BE(timestamp, 4);
    }
    getSsrc() {
        return this.buffer.readUInt32BE(8);
    }
    setSsrc(ssrc) {
        this.buffer.writeUInt32BE(ssrc, 8);
    }
    getCsrc() {
        return this.csrc;
    }
    setCsrc(csrc) {
        this.serializationNeeded = true;
        this.csrc = csrc;
    }
    getMarker() {
        return Boolean(this.buffer.readUInt8(1) >> 7);
    }
    setMarker(marker) {
        const bit = marker ? 1 : 0;
        this.buffer.writeUInt8(this.buffer.readUInt8(1) | (bit << 7), 1);
    }
    hasOneByteExtensions() {
        return this.headerExtension
            ? this.headerExtension.id === 0xBEDE
            : false;
    }
    hasTwoBytesExtensions() {
        return this.headerExtension
            ? (this.headerExtension.id & 0b1111111111110000) === 0b0001000000000000
            : false;
    }
    setOneByteExtensions() {
        if (this.hasOneByteExtensions()) {
            return;
        }
        this.headerExtension =
            {
                id: 0xBEDE,
                value: Buffer.alloc(0)
            };
    }
    setTwoBytesExtensions() {
        if (this.hasTwoBytesExtensions()) {
            return;
        }
        this.headerExtension =
            {
                id: 0b0001000000000000,
                value: Buffer.alloc(0)
            };
    }
    getExtension(id) {
        return this.extensions.get(id);
    }
    setExtension(id, value) {
        this.serializationNeeded = true;
        this.extensions.set(id, value);
    }
    deleteExtension(id) {
        if (this.extensions.delete(id)) {
            this.serializationNeeded = true;
        }
    }
    clearExtensions() {
        if (this.extensions.size > 0) {
            this.serializationNeeded = true;
        }
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
    isSerializationNeeded() {
        return this.serializationNeeded;
    }
    serialize() {
        // Compute required buffer length.
        let length = FIXED_HEADER_LENGTH;
        // Add space for CSRC values.
        length += this.csrc.length * 4;
        if (this.extensions.size > 0) {
            // Add space for header extension id/length fields.
            length += 4;
            if (this.hasOneByteExtensions()) {
                for (const value of this.extensions.values()) {
                    // Add space for extension id/length fields.
                    length += 1 + value.length;
                }
            }
            else if (this.hasTwoBytesExtensions()) {
                for (const value of this.extensions.values()) {
                    // Add space for extension id/length fields.
                    length += 2 + value.length;
                }
            }
        }
        // Add space for payload.
        if (this.payload) {
            length += this.payload.length;
        }
        // Add space for padding.
        length += this.padding;
        // Update our buffer.
        this.buffer = Buffer.alloc(length);
        // TODO: Serialize everything into the buffer.
        // TODO: Including the version field.
        // Reset flag.
        this.serializationNeeded = false;
    }
    clone() {
        if (this.serializationNeeded) {
            this.serialize();
        }
        return new RtpPacket(utils_1.clone(this.buffer));
    }
}
exports.RtpPacket = RtpPacket;
