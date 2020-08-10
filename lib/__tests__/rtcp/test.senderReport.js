"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const senderReport_1 = require("../../rtcp/senderReport");
const rtcp_1 = require("../../rtcp");
// Sender info.
const ssrc = 0x5d931534;
const ntpSeconds = 3711615412;
const ntpFraction = 1985245553;
const rtpTimestamp = 577280;
const packetCount = 3608;
const octetCount = 577280;
// Receiver report.
const ssrc2 = 0x01932db4;
const fractionLost = 80;
const totalLost = 216;
const highestSeqNumber = 342342;
const jitter = 0;
const lastSenderReport = 8234;
const delaySinceLastSenderReport = 5;
const buffer = Buffer.from([
    0x81, 0xc8, 0x00, 0x0c,
    0x5d, 0x93, 0x15, 0x34,
    0xdd, 0x3a, 0xc1, 0xb4,
    0x76, 0x54, 0x71, 0x71,
    0x00, 0x08, 0xcf, 0x00,
    0x00, 0x00, 0x0e, 0x18,
    0x00, 0x08, 0xcf, 0x00,
    // Receiver Report
    0x01, 0x93, 0x2d, 0xb4,
    0x50, 0x00, 0x00, 0xd8,
    0x00, 0x05, 0x39, 0x46,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x20, 0x2a,
    0x00, 0x00, 0x00, 0x05 // DLSR: 5
]);
describe('parse RTCP Sender Report packet', () => {
    test('buffer is RTCP', () => {
        expect(rtcp_1.isRtcp(buffer)).toBe(true);
    });
    test('packet processing succeeds', () => {
        const packet = new senderReport_1.SenderReportPacket(buffer);
        const report = packet.getReports()[0];
        expect(packet.getVersion()).toBe(2);
        expect(packet.getPadding()).toBe(0);
        expect(packet.getPacketType()).toBe(200);
        expect(packet.getCount()).toBe(1);
        expect(packet.getSsrc()).toBe(ssrc);
        checkReport(report);
    });
    test('packet processing succeeds for a buffer with padding', () => {
        const padding = 4;
        const bufferWithPadding = Buffer.from([
            0xa0, 0xc8, 0x00, 0x07,
            0x5d, 0x93, 0x15, 0x34,
            0xdd, 0x3a, 0xc1, 0xb4,
            0x76, 0x54, 0x71, 0x71,
            0x00, 0x08, 0xcf, 0x00,
            0x00, 0x00, 0x0e, 0x18,
            0x00, 0x08, 0xcf, 0x00,
            0x00, 0x00, 0x00, 0x04 // Padding (4 bytes)
        ]);
        const packet = new senderReport_1.SenderReportPacket(bufferWithPadding);
        expect(packet.getVersion()).toBe(2);
        expect(packet.getPadding()).toBe(padding);
        expect(packet.getPacketType()).toBe(200);
        expect(packet.getCount()).toBe(0);
        expect(packet.getSsrc()).toBe(ssrc);
        expect(packet.getBuffer().compare(bufferWithPadding)).toBe(0);
    });
    test('parsing a buffer which length does not fit the indicated count throws', () => {
        // Parse the first 8 bytes of buffer, indicating 1 Receiver Report and
        // holding no report at all.
        expect(() => (new senderReport_1.SenderReportPacket(buffer.slice(undefined, 8))))
            .toThrowError(TypeError);
    });
});
describe('serialize RTCP Sender Report packet', () => {
    test('serialized buffer equals original one', () => {
        const packet = new senderReport_1.SenderReportPacket(buffer);
        expect(packet.getBuffer().compare(buffer)).toBe(0);
    });
});
describe('create RTCP Sender Report packet', () => {
    test('creating a Receiver Report packet succeeds', () => {
        const packet = new senderReport_1.SenderReportPacket();
        expect(packet).toBeDefined();
        expect(rtcp_1.isRtcp(packet.getBuffer())).toBe(true);
    });
    test('creating a Sender Report packet with padding succeeds', () => {
        const padding = 8;
        const bufferWithPadding = Buffer.from([
            0xa0, 0xc8, 0x00, 0x08,
            0x5d, 0x93, 0x15, 0x34,
            0xdd, 0x3a, 0xc1, 0xb4,
            0x76, 0x54, 0x71, 0x71,
            0x00, 0x08, 0xcf, 0x00,
            0x00, 0x00, 0x0e, 0x18,
            0x00, 0x08, 0xcf, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x08
        ]);
        const packet = new senderReport_1.SenderReportPacket();
        expect(packet).toBeDefined();
        expect(rtcp_1.isRtcp(packet.getBuffer())).toBe(true);
        expect(packet.getPadding()).toBe(0);
        packet.setPadding(padding);
        packet.setSsrc(ssrc);
        packet.setNtpSeconds(ntpSeconds);
        packet.setNtpFraction(ntpFraction);
        packet.setRtpTimestamp(rtpTimestamp);
        packet.setPacketCount(packetCount);
        packet.setOctetCount(octetCount);
        expect(packet.getPadding()).toBe(8);
        expect(packet.getBuffer().compare(bufferWithPadding)).toBe(0);
    });
});
function checkReport(report) {
    expect(report.getSsrc()).toBe(ssrc2);
    expect(report.getFractionLost()).toBe(fractionLost);
    expect(report.getTotalLost()).toBe(totalLost);
    expect(report.getHighestSeqNumber()).toBe(highestSeqNumber);
    expect(report.getJitter()).toBe(jitter);
    expect(report.getLastSRTimestamp()).toBe(lastSenderReport);
    expect(report.getDelaySinceLastSR()).toBe(delaySinceLastSenderReport);
}
