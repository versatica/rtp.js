"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const packet_1 = require("./packet");
/**
        0                   1                   2                   3
        0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
header |V=2|P|    RC   |   PT=RR=201   |             length            |
       +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
       |                     SSRC of packet sender                     |
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
const REPORT_LENGTH = 24;
/** @ignore */
const FIXED_HEADER_LENGTH = 4 + 4; // Common RTCP header length + 4.
class ReceiverReport {
    /**
     * @param buffer - If given it will be parsed. Otherwise an empty RTCP Receiver
     *   Report will be created.
     */
    constructor(buffer) {
        // If no buffer is given, create an empty one.
        if (!buffer) {
            this.buffer = Buffer.alloc(REPORT_LENGTH);
        }
        else {
            this.buffer = buffer;
        }
    }
    /**
     * @ignore
     */
    dump() {
        return {
            ssrc: this.getSsrc(),
            fractionLost: this.getFractionLost(),
            totaLlost: this.getTotalLost(),
            lastSeq: this.getHighestSeqNumber(),
            jitter: this.getJitter(),
            lsr: this.getLastSRTimestamp(),
            dlsr: this.getDelaySinceLastSR()
        };
    }
    /**
     * Get the internal buffer containing the RTCP Receiver Report binary.
     */
    getBuffer() {
        return this.buffer;
    }
    /*
     * Get receiver SSRC.
     */
    getSsrc() {
        return this.buffer.readUInt32BE(0);
    }
    /*
     * Set receiver SSRC.
     */
    setSsrc(ssrc) {
        this.buffer.writeUInt32BE(ssrc, 0);
    }
    /*
     * Get fraction lost.
     */
    getFractionLost() {
        return this.buffer.readUInt8(4);
    }
    /*
     * Set fraction lost.
     */
    setFractionLost(fractionLost) {
        this.buffer.writeUInt8(fractionLost, 4);
    }
    /*
     * Get total lost.
     */
    getTotalLost() {
        let value = this.buffer.readUIntBE(5, 3);
        // Possitive value.
        if (((value >> 23) & 1) == 0) {
            return value;
        }
        // Negative value.
        if (value != 0x0800000) {
            value &= ~(1 << 23);
        }
        return -value;
    }
    /*
     * Set total lost.
     */
    setTotalLost(totalLost) {
        // Get the limit value for possitive and negative totalLost.
        const clamp = (totalLost >= 0) ? totalLost > 0x07FFFFF ? 0x07FFFFF : totalLost
            : -totalLost > 0x0800000 ? 0x0800000 : -totalLost;
        const value = (totalLost >= 0) ? (clamp & 0x07FFFFF) : (clamp | 0x0800000);
        this.buffer.writeUIntBE(value, 5, 3);
    }
    /*
     * Get highest RTP sequence number.
     */
    getHighestSeqNumber() {
        return this.buffer.readUIntBE(8, 4);
    }
    /*
     * Set highest RTP sequence number.
     */
    setHighestSeqNumber(lastSeq) {
        this.buffer.writeUIntBE(lastSeq, 8, 4);
    }
    /*
     * Get interarrival jitter.
     */
    getJitter() {
        return this.buffer.readUIntBE(12, 4);
    }
    /*
     * Set interarrival jitter.
     */
    setJitter(jitter) {
        this.buffer.writeUIntBE(jitter, 12, 4);
    }
    /*
     * Set last Sender Report timestamp.
     */
    getLastSRTimestamp() {
        return this.buffer.readUIntBE(16, 4);
    }
    /*
     * Set last Sender Report timestamp.
     */
    setLastSRTimestamp(lsr) {
        this.buffer.writeUIntBE(lsr, 16, 4);
    }
    /*
     * Get delay since last Sender Report.
     */
    getDelaySinceLastSR() {
        return this.buffer.readUIntBE(20, 4);
    }
    /*
     * Set delay since last Sender Report.
     */
    setDelaySinceLastSR(dlsr) {
        this.buffer.writeUIntBE(dlsr, 20, 4);
    }
}
exports.ReceiverReport = ReceiverReport;
class ReceiverReportPacket extends packet_1.RtcpPacket {
    /**
     * @param buffer - If given it will be parsed. Otherwise an empty RTP packet
     *   will be created.
     */
    constructor(buffer) {
        super(ReceiverReportPacket.packetType);
        // Receiver Reports.
        this.reports = [];
        // Whether serialization is needed due to modifications.
        this.serializationNeeded = false;
        // If no buffer is given, create an empty one with minimum required length.
        if (!buffer) {
            this.buffer = Buffer.alloc(FIXED_HEADER_LENGTH);
            return;
        }
        if (!packet_1.isRtcp(buffer)) {
            throw new TypeError('invalid RTCP packet');
        }
        this.buffer = buffer;
        let count = this.getCount();
        while (count-- > 0) {
            const report = new ReceiverReport(this.buffer.slice(FIXED_HEADER_LENGTH + (this.reports.length * REPORT_LENGTH)));
            this.addReport(report);
        }
    }
    /**
     * @ignore
     */
    dump() {
        return {
            ...super.dump(),
            ssrc: this.getSsrc(),
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
    /*
     * Get sender SSRC.
     */
    getSsrc() {
        return this.buffer.readUInt32BE(4);
    }
    /*
     * Set sender SSRC.
     */
    setSsrc(ssrc) {
        this.buffer.writeUInt32BE(ssrc, 4);
    }
    /*
     * Get Receiver Reports.
     */
    getReports() {
        return this.reports;
    }
    /*
     * Add a Receiver Report.
     */
    addReport(report) {
        this.reports.push(report);
        this.serializationNeeded = true;
    }
    /**
     * Serialize RTCP packet into a new buffer.
     */
    serialize() {
        // Compute required buffer length.
        const length = FIXED_HEADER_LENGTH + (REPORT_LENGTH * this.reports.length);
        const ssrc = this.getSsrc();
        super.serialize(length);
        this.setCount(this.reports.length);
        this.setSsrc(ssrc);
        for (let i = 0; i < this.reports.length; ++i) {
            const report = this.reports[i];
            report.getBuffer().copy(this.buffer, FIXED_HEADER_LENGTH + (REPORT_LENGTH * i));
        }
        this.serializationNeeded = false;
    }
}
exports.ReceiverReportPacket = ReceiverReportPacket;
// Packet Type.
ReceiverReportPacket.packetType = packet_1.PacketType.RR;
