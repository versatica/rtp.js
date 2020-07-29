"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const receiverReport_1 = require("../../rtcp/receiverReport");
const packet_1 = require("../../rtcp/packet");
const ssrc = 26422708;
const fractionLost = 80;
const totalLost = 216;
const highestSeqNumber = 342342;
const jitter = 0;
const lastSenderReport = 8234;
const delaySinceLastSenderReport = 5;
const buffer = Buffer.from([
    0x81, 0xc9, 0x00, 0x07,
    0x5d, 0x93, 0x15, 0x34,
    // Receiver Report
    0x01, 0x93, 0x2d, 0xb4,
    0x50, 0x00, 0x00, 0xd8,
    0x00, 0x05, 0x39, 0x46,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x20, 0x2a,
    0x00, 0x00, 0x00, 0x05 // DLSR: 0
]);
describe('parse RTCP Receiver Report packet', () => {
    test('packet processing succeeds', () => {
        const packet = new receiverReport_1.ReceiverReportPacket(buffer);
        const report = packet.getReports()[0];
        expect(packet.getVersion()).toBe(2);
        expect(packet.getPadding()).toBe(false);
        expect(packet.getPacketType()).toBe(201);
        expect(packet.getCount()).toBe(1);
        expect(packet.getSsrc()).toBe(0x5d931534);
        checkReport(report);
    });
    test('report processing succeeds', () => {
        const report = new receiverReport_1.ReceiverReport(buffer.slice(8));
        expect(report).toBeDefined();
        checkReport(report);
    });
});
describe('serialize RTCP Receiver Report packet', () => {
    test('serialized buffer equals original one', () => {
        const packet = new receiverReport_1.ReceiverReportPacket(buffer);
        packet.getBuffer();
        expect(packet.getBuffer().compare(buffer)).toBe(0);
    });
});
describe('create RTCP Receiver Report packet', () => {
    test('creating a Receiver Report packet succeeds', () => {
        const packet = new receiverReport_1.ReceiverReportPacket();
        expect(packet).toBeDefined();
        expect(packet_1.isRtcp(packet.getBuffer())).toBe(true);
    });
});
describe('create RTCP Receiver Report', () => {
    test('creating a Receiver Report succeeds', () => {
        const report = new receiverReport_1.ReceiverReport();
        expect(report).toBeDefined();
        report.setSsrc(ssrc);
        report.setFractionLost(fractionLost);
        report.setTotalLost(totalLost);
        report.setHighestSeqNumber(highestSeqNumber);
        report.setJitter(jitter);
        report.setLastSRTimestamp(lastSenderReport);
        report.setDelaySinceLastSR(delaySinceLastSenderReport);
        checkReport(report);
    });
});
function checkReport(report) {
    expect(report.getSsrc()).toBe(ssrc);
    expect(report.getFractionLost()).toBe(fractionLost);
    expect(report.getTotalLost()).toBe(totalLost);
    expect(report.getHighestSeqNumber()).toBe(highestSeqNumber);
    expect(report.getJitter()).toBe(jitter);
    expect(report.getLastSRTimestamp()).toBe(lastSenderReport);
    expect(report.getDelaySinceLastSR()).toBe(delaySinceLastSenderReport);
}
