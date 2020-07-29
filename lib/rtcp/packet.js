"use strict";
/*
        0                   1                   2                   3
        0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
header |V=2|P|    SC   |      PT       |             length            |
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 */
Object.defineProperty(exports, "__esModule", { value: true });
/** @ignore */
const RTCP_VERSION = 2;
/** @ignore */
const COMMON_HEADER_LENGTH = 4;
var PacketType;
(function (PacketType) {
    PacketType[PacketType["SR"] = 200] = "SR";
    PacketType[PacketType["RR"] = 201] = "RR";
    PacketType[PacketType["SDES"] = 202] = "SDES";
    PacketType[PacketType["BYE"] = 203] = "BYE";
    PacketType[PacketType["APP"] = 204] = "APP";
    PacketType[PacketType["RTPFB"] = 205] = "RTPFB";
    PacketType[PacketType["PSFB"] = 206] = "PSFB";
    PacketType[PacketType["XR"] = 207] = "XR";
})(PacketType = exports.PacketType || (exports.PacketType = {}));
/**
 * Inspect the given buffer and return a boolean indicating whether it could be
 * a valid RTCP packet or not.
 *
 * ```ts
 * if (isRtcp(buffer)) {
 *   console.log('it seems a valid RTCP packet');
 * }
 * ```
 */
function isRtcp(buffer) {
    const firstByte = buffer.readUInt8(0);
    return (Buffer.isBuffer(buffer) &&
        buffer.length >= COMMON_HEADER_LENGTH &&
        // DOC: https://tools.ietf.org/html/draft-ietf-avtcore-rfc5764-mux-fixes
        (firstByte > 127 && firstByte < 192) &&
        // RTCP Version must be 2.
        (firstByte >> 6) === RTCP_VERSION &&
        // RTCP packet types defined by IANA:
        // http://www.iana.org/assignments/rtp-parameters/rtp-parameters.xhtml#rtp-parameters-4
        // RFC 5761 (RTCP-mux) states this range for secure RTCP/RTP detection.
        (buffer.readUInt8(1) >= 192 && buffer.readUInt8(1) <= 223));
}
exports.isRtcp = isRtcp;
class RtcpPacket {
    /**
     * @ignore
     *
     * @param PacketType.
     */
    constructor(packetType) {
        this.packetType = packetType;
    }
    /**
     * @ignore
     *
     * @param Buffer.
     */
    static getCount(buffer) {
        return buffer.readUInt8(0) & 0x1F;
    }
    /**
     * @ignore
     */
    dump() {
        return {
            version: this.getVersion(),
            count: this.getCount(),
            length: this.getLength(),
            padding: this.getPadding()
        };
    }
    /**
     * Get the RTCP version of the packet (always 2).
     */
    getVersion() {
        return RTCP_VERSION;
    }
    /**
     * Get the padding flag.
     */
    getPadding() {
        return Boolean(this.buffer.readUInt8(0) & 0x20);
    }
    /**
     * Set the padding flag.
     */
    setPadding(padding) {
        // Update padding bit.
        const bit = padding ? 1 : 0;
        this.buffer.writeUInt8(this.buffer.readUInt8(0) | (bit << 5), 0);
    }
    /**
     * Get the RTCP header count value.
     */
    getCount() {
        return this.buffer.readUInt8(0) & 0x1F;
    }
    /**
     * Get the RTCP packet type.
     */
    getPacketType() {
        return this.buffer.readUInt8(1);
    }
    /**
     * Get the RTCP packet length.
     */
    getLength() {
        return this.buffer.readUInt16BE(2);
    }
    /**
     * Set the RTCP header count value.
     */
    setCount(count) {
        this.buffer.writeUInt8(this.buffer.readUInt8() | (count & 0x1F), 0);
    }
    /**
     * Serialize RTCP packet into a new buffer.
     */
    serialize(length) {
        // Allocate new buffer.
        const newBuffer = Buffer.alloc(length);
        this.buffer.copy(newBuffer, 0, 0, COMMON_HEADER_LENGTH);
        this.buffer = newBuffer;
        this.writeCommonHeader();
        this.setLength((length / 4) - 1);
    }
    writeCommonHeader() {
        this.setVersion();
        this.setPacketType(this.packetType);
    }
    /**
     * Set the RTCP version of the packet (always 2).
     */
    setVersion() {
        this.buffer.writeUInt8(this.buffer.readUInt8() | (RTCP_VERSION << 6), 0);
    }
    /**
     * Set the RTCP packet type.
     */
    setPacketType(count) {
        this.buffer.writeUInt8(count, 1);
    }
    /**
     * Set the RTCP packet length.
     */
    setLength(length) {
        this.buffer.writeUInt16BE(length, 2);
    }
}
exports.RtcpPacket = RtcpPacket;
