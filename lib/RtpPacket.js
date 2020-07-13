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
        const extFlag = Boolean((firstByte >> 4) & 1);
        let extBuffer;
        if (extFlag) {
            // NOTE: This will throw RangeError if there is no space in the buffer.
            this.headerExtensionId = buffer.readUInt16BE(pos);
            const length = buffer.readUInt16BE(pos + 2) * 4;
            extBuffer =
                Buffer.from(buffer.buffer, buffer.byteOffset + pos + 4, length);
            pos += (4 + length);
        }
        // Parse One-Byte or Two-Bytes extensions.
        if (extBuffer && this.hasOneByteExtensions()) {
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
        else if (extBuffer && this.hasTwoBytesExtensions()) {
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
            headerExtensionId: this.headerExtensionId,
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
        // Update CSRC count.
        const count = this.csrc.length;
        this.buffer.writeUInt8(this.buffer.readUInt8(0) | (count & 0x0F), 0);
    }
    getMarker() {
        return Boolean(this.buffer.readUInt8(1) >> 7);
    }
    setMarker(marker) {
        const bit = marker ? 1 : 0;
        this.buffer.writeUInt8(this.buffer.readUInt8(1) | (bit << 7), 1);
    }
    hasOneByteExtensions() {
        return this.headerExtensionId === 0xBEDE;
    }
    hasTwoBytesExtensions() {
        return this.headerExtensionId
            ? (this.headerExtensionId & 0b1111111111110000) === 0b0001000000000000
            : false;
    }
    setOneByteExtensions() {
        if (this.hasOneByteExtensions()) {
            return;
        }
        this.serializationNeeded = true;
        // Update header extension bit if required.
        if (this.extensions.size > 0) {
            this.setHeaderExtensionBit(1);
        }
        this.headerExtensionId = 0xBEDE;
    }
    setTwoBytesExtensions() {
        if (this.hasTwoBytesExtensions()) {
            return;
        }
        this.serializationNeeded = true;
        // Update header extension bit if required.
        if (this.extensions.size > 0) {
            this.setHeaderExtensionBit(1);
        }
        this.headerExtensionId = 0b0001000000000000;
    }
    getExtension(id) {
        return this.extensions.get(id);
    }
    setExtension(id, value) {
        this.serializationNeeded = true;
        // Update header extension bit if needed.
        if (this.extensions.size === 0) {
            this.setHeaderExtensionBit(1);
        }
        this.extensions.set(id, value);
    }
    deleteExtension(id) {
        if (this.extensions.delete(id)) {
            this.serializationNeeded = true;
            // Update header extension bit if needed.
            if (this.extensions.size === 0) {
                this.setHeaderExtensionBit(0);
            }
        }
    }
    clearExtensions() {
        if (this.extensions.size === 0) {
            return;
        }
        this.serializationNeeded = true;
        // Update header extension bit.
        this.setHeaderExtensionBit(0);
        this.extensions.clear();
    }
    setHeaderExtensionBit(bit) {
        this.buffer.writeUInt8(this.buffer.readUInt8(0) | (bit << 4), 0);
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
        // Update padding bit.
        const bit = padding ? 1 : 0;
        this.setPaddingBit(bit);
    }
    setPaddingBit(bit) {
        this.buffer.writeUInt8(this.buffer.readUInt8(0) | (bit << 5), 0);
    }
    isSerializationNeeded() {
        return this.serializationNeeded;
    }
    serialize() {
        const previousBuffer = this.buffer;
        // Compute required buffer length.
        let length = FIXED_HEADER_LENGTH;
        // Add space for CSRC values.
        length += this.csrc.length * 4;
        // Add space for the headere extension (just if One-Byte or Two-Bytes is
        // enabled and there are extensions in the packet).
        if (this.extensions.size > 0 &&
            (this.hasOneByteExtensions() || this.hasTwoBytesExtensions())) {
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
            // May need to add padding.
            length = utils_1.padTo4Bytes(length);
        }
        // Add space for payload.
        if (this.payload) {
            length += this.payload.length;
        }
        // Add space for padding.
        length += this.padding;
        // Allocate new buffer.
        const newBuffer = Buffer.alloc(length);
        // Copy the fixed header into the new buffer.
        previousBuffer.copy(newBuffer, 0, 0, FIXED_HEADER_LENGTH);
        let pos = FIXED_HEADER_LENGTH;
        // Write CSRC.
        for (const ssrc of this.csrc) {
            newBuffer.writeUInt32BE(ssrc, pos);
            pos += 4;
        }
        // Write header extension.
        if (this.extensions.size > 0 && this.hasOneByteExtensions()) {
            newBuffer.writeUInt16BE(this.headerExtensionId, pos);
            const extLengthPos = pos + 2;
            let extLength = 0;
            // Move to the header extension value.
            pos += 4;
            for (const [id, value] of this.extensions) {
                if (value.length === 0) {
                    throw new TypeError('cannot serialize extensions with length 0 in One-Byte mode');
                }
                else if (value.length > 16) {
                    throw new RangeError('cannot serialize extensions with length > 16 in One-Byte mode');
                }
                const idLength = (id << 4) & ((value.length - 1) & 0x0F);
                newBuffer.writeUInt8(idLength, pos);
                pos += 1;
                extLength += 1;
                value.copy(newBuffer, pos);
                pos += value.length;
                extLength += value.length;
            }
            // May need to add padding.
            pos = utils_1.padTo4Bytes(pos);
            extLength = utils_1.padTo4Bytes(extLength);
            // Write header extension length.
            newBuffer.writeUInt16BE(extLength / 4, extLengthPos);
        }
        else if (this.extensions.size > 0 && this.hasTwoBytesExtensions()) {
            newBuffer.writeUInt16BE(this.headerExtensionId, pos);
            const extLengthPos = pos + 2;
            let extLength = 0;
            // Move to the header extension value.
            pos += 4;
            for (const [id, value] of this.extensions) {
                if (value.length > 255) {
                    throw new RangeError('cannot serialize extensions with length > 255 in Two-Bytes mode');
                }
                newBuffer.writeUInt8(id, pos);
                pos += 1;
                extLength += 1;
                newBuffer.writeUInt8(value.length, pos);
                pos += 1;
                extLength += 1;
                value.copy(newBuffer, pos);
                pos += value.length;
                extLength += value.length;
            }
            // May need to add padding.
            pos = utils_1.padTo4Bytes(pos);
            extLength = utils_1.padTo4Bytes(extLength);
            // Write header extension length.
            newBuffer.writeUInt16BE(extLength / 4, extLengthPos);
        }
        // Otherwise remove the header extension.
        else {
            this.setHeaderExtensionBit(0);
            this.extensions.clear();
        }
        // Write payload.
        if (this.payload) {
            this.payload.copy(newBuffer, pos);
            pos += this.payload.length;
        }
        // Write padding.
        if (this.padding > 0) {
            if (this.padding > 255) {
                throw new TypeError(`padding (${this.padding} bytes) cannot be higher than 255`);
            }
            newBuffer.fill(0, pos, pos + this.padding - 1);
            newBuffer.writeUInt8(this.padding, pos + this.padding - 1);
            pos += this.padding;
        }
        // Assert that current position matches new buffer length.
        if (pos !== newBuffer.length) {
            throw new RangeError(`parsed length (${pos} bytes) does not match new buffer length (${newBuffer.length} bytes)`);
        }
        // Update buffer.
        this.buffer = newBuffer;
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
