"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require("./");
const receiverReport_1 = require("./receiverReport");
/**
        0                   1                   2                   3
        0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
header |V=2|P|    RC   |   PT=SR=200   |             length            |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                         SSRC of sender                        |
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
sender |              NTP timestamp, most significant word             |
info   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |             NTP timestamp, least significant word             |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                         RTP timestamp                         |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                     sender's packet count                     |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                      sender's octet count                     |
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
report |                 SSRC_1 (SSRC of first source)                 |
block  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  1    | fraction lost |       cumulative number of packets lost       |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |           extended highest sequence number received           |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                      interarrival jitter                      |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                         last SR (LSR)                         |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                   delay since last SR (DLSR)                  |
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
report |                 SSRC_2 (SSRC of second source)                |
block  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  2    :                               ...                             :
       +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
       |                  profile-specific extensions                  |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 */
/** @ignore */
const FIXED_HEADER_LENGTH = 4 + 24; // Common RTCP header length + 24.
/**
 * ```ts
 * import { SenderReportPacket } from 'rtp.js';
 * ```
 *
 * Representation of a RTCP Sender Report packet. It may contain various
 * [[ReceiverReport]] instances.
 */
class SenderReportPacket extends _1.RtcpPacket {
    /**
     * @param buffer - If given it will be parsed. Otherwise an empty RTP packet
     *   will be created.
     */
    constructor(buffer) {
        super(SenderReportPacket.packetType);
        // Receiver Reports.
        this.reports = [];
        // If no buffer is given, create an empty one with minimum required length.
        if (!buffer) {
            this.buffer = Buffer.alloc(FIXED_HEADER_LENGTH);
            this.writeCommonHeader();
            return;
        }
        if (!_1.isRtcp(buffer)) {
            throw new TypeError('invalid RTCP packet');
        }
        // Get padding.
        const paddingFlag = Boolean((buffer.readUInt8() >> 5) & 1);
        if (paddingFlag) {
            // NOTE: This will throw RangeError if there is no space in the buffer.
            this.padding = buffer.readUInt8(((_1.RtcpPacket.getLength(buffer) * 4) + 4 - 1));
        }
        let count = _1.RtcpPacket.getCount(buffer);
        if (buffer.length < FIXED_HEADER_LENGTH + (count * receiverReport_1.REPORT_LENGTH)) {
            throw new TypeError('buffer is too small');
        }
        while (count-- > 0) {
            const report = new receiverReport_1.ReceiverReport(buffer.slice(FIXED_HEADER_LENGTH + (this.reports.length * receiverReport_1.REPORT_LENGTH)));
            this.addReport(report);
        }
        // Store a buffer within the packet boundaries.
        this.buffer = buffer.slice(undefined, FIXED_HEADER_LENGTH + (this.reports.length * receiverReport_1.REPORT_LENGTH) + this.padding);
    }
    /**
     * @ignore
     */
    dump() {
        return {
            ...super.dump(),
            ssrc: this.getSsrc(),
            ntpSeq: this.getNtpSeconds(),
            ntpFraction: this.getNtpFraction(),
            rtpTimestamp: this.getRtpTimestamp(),
            packetCount: this.getPacketCount(),
            octectCount: this.getOctetCount(),
            reports: this.reports.map((report) => report.dump())
        };
    }
    /**
     * Get the internal buffer containing the serialized RTP binary packet.
     */
    getBuffer() {
        if (this.serializationNeeded) {
            this.serialize();
        }
        return this.buffer;
    }
    /**
     * Get sender SSRC.
     */
    getSsrc() {
        return this.buffer.readUInt32BE(4);
    }
    /**
     * Set sender SSRC.
     */
    setSsrc(ssrc) {
        this.buffer.writeUInt32BE(ssrc, 4);
    }
    /**
     * Get NTP seconds.
     */
    getNtpSeconds() {
        return this.buffer.readUInt32BE(8);
    }
    /**
     * Set NTP seconds.
     */
    setNtpSeconds(seconds) {
        this.buffer.writeUInt32BE(seconds, 8);
    }
    /**
     * Get NTP fraction.
     */
    getNtpFraction() {
        return this.buffer.readUInt32BE(12);
    }
    /**
     * Set NTP fraction.
     */
    setNtpFraction(fraction) {
        this.buffer.writeUInt32BE(fraction, 12);
    }
    /**
     * Get RTP Timestamp.
     */
    getRtpTimestamp() {
        return this.buffer.readUInt32BE(16);
    }
    /**
     * Set RTP Timestamp.
     */
    setRtpTimestamp(timestamp) {
        this.buffer.writeUInt32BE(timestamp, 16);
    }
    /**
     * Get RTP packet count.
     */
    getPacketCount() {
        return this.buffer.readUInt32BE(20);
    }
    /**
     * Set RTP packet count.
     */
    setPacketCount(timestamp) {
        this.buffer.writeUInt32BE(timestamp, 20);
    }
    /**
     * Get RTP octect count.
     */
    getOctetCount() {
        return this.buffer.readUInt32BE(24);
    }
    /**
     * Set RTP octect count.
     */
    setOctetCount(timestamp) {
        this.buffer.writeUInt32BE(timestamp, 24);
    }
    /**
     * Get Receiver Reports.
     */
    getReports() {
        return this.reports;
    }
    /**
     * Add a Receiver Report.
     */
    addReport(report) {
        this.reports.push(report);
        this.serializationNeeded = true;
    }
    /**
     * Apply pending changes into the packet and serialize it into a new internal
     * buffer (the one that [[getBuffer]] will later return).
     *
     * **NOTE:** In most cases there is no need to use this method. It must be
     * called only if the application retrieves information from the packet (by
     * calling [[getBuffer]], [[getReports]], etc) and modifies the obtained
     * buffers in place. However, it's recommended to use the existing setter
     * methods instead ([[addReport]], etc).
     *
     */
    serialize() {
        // Compute required buffer length.
        const length = FIXED_HEADER_LENGTH + (receiverReport_1.REPORT_LENGTH * this.reports.length);
        const ssrc = this.getSsrc();
        const ntpSec = this.getNtpSeconds();
        const ntpFraction = this.getNtpFraction();
        const rtpTimestamp = this.getRtpTimestamp();
        const packetCount = this.getPacketCount();
        const octetCount = this.getOctetCount();
        super.serialize(length);
        this.setCount(this.reports.length);
        this.setSsrc(ssrc);
        this.setNtpSeconds(ntpSec);
        this.setNtpFraction(ntpFraction);
        this.setRtpTimestamp(rtpTimestamp);
        this.setPacketCount(packetCount);
        this.setOctetCount(octetCount);
        for (let i = 0; i < this.reports.length; ++i) {
            const report = this.reports[i];
            report.getBuffer().copy(this.buffer, FIXED_HEADER_LENGTH + (receiverReport_1.REPORT_LENGTH * i));
        }
        this.serializationNeeded = false;
    }
}
exports.SenderReportPacket = SenderReportPacket;
// Packet Type.
SenderReportPacket.packetType = _1.RtcpPacketType.SR;
