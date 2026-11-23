import { SenderReportPacket } from '../../../packets/RTCP/SenderReportPacket';
import type { ReceptionReport } from '../../../packets/RTCP/AnyReportPacket';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { checkRtcpPacket, type ExpectedRtcpPacket } from './rtcpCommon';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers';

beforeEach(resetBuffers);

describe('RTCP Sender Report Packet', () => {
	test('SenderReportPacket.parse() succeeds', () => {
		const checkFields = (packet: SenderReportPacket): void => {
			const reports = packet.getReports();

			expect(packet.getSsrc()).toBe(0x5d931534);
			expect(packet.getNtp()).toEqual({
				seconds: 0xe7a1b2c3,
				fractions: 0x12345678,
			});
			expect(packet.getRtpTimestamp()).toBe(0x0a0b0c0d);
			expect(packet.getPacketCount()).toBe(1000);
			expect(packet.getOctetCount()).toBe(123456);
			expect(packet.getReportsCount()).toBe(1);
			expect(reports.length).toBe(1);

			expect(reports[0]).toEqual({
				ssrc: 0x01932db4,
				fractionLost: 5,
				totalLost: 258,
				highestSeq: 131088,
				jitter: 15,
				lsr: 0xb2c31234,
				dlsr: 32768,
			});
		};

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, RC=1, PT:200, Length: 12
			0b10000001, 0xc8, 0x00, 0x0c,
			// SSRC of sender: 0x5d931534
			0x5d, 0x93, 0x15, 0x34,
			// NTP timestamp, most significant word: 0xe7a1b2c3
			0xe7, 0xa1, 0xb2, 0xc3,
			// NTP timestamp, least significant word: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// RTP timestamp: 0x0a0b0c0d
			0x0a, 0x0b, 0x0c, 0x0d,
			// Sender's packet count: 1000
			0x00, 0x00, 0x03, 0xe8,
			// Sender's octet count: 123456
			0x00, 0x01, 0xe2, 0x40,
			// Report block 1
			// SSRC: 0x01932db4
			0x01, 0x93, 0x2d, 0xb4,
			// Fraction lost: 5, Total lost: 258
			0x05, 0x00, 0x01, 0x02,
			// Extended highest seq: 131088
			0x00, 0x02, 0x00, 0x10,
			// Jitter: 15
			0x00, 0x00, 0x00, 0x0f,
			// LSR: 0xb2c31234
			0xb2, 0xc3, 0x12, 0x34,
			// DLSR: 32768
			0x00, 0x00, 0x80, 0x00,
		]);
		const packet = SenderReportPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 52,
			packetType: RtcpPacketType.SR,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		checkFields(packet);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xff);

		checkRtcpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		checkFields(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		checkFields(clonedPacket);
	});

	test('SenderReportPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, RC=0, PT:200, Length: 7
			0b10100000, 0xc8, 0x00, 0x07,
			// SSRC of packet sender: 0x5d931534
			0x5d, 0x93, 0x15, 0x34,
			// NTP timestamp (most significant word): 1111
			0x00, 0x00, 0x04, 0x57,
			// NTP timestamp (least significant word): 2222
			0x00, 0x00, 0x08, 0xae,
			// RTP timestamp: 3333
			0x00, 0x00, 0x0d, 0x05,
			// Sender's packet count: 4444
			0x00, 0x00, 0x11, 0x5c,
			// Sender's octet count: 5555
			0x00, 0x00, 0x15, 0xb3,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
		]);
		const packet = SenderReportPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 32,
			packetType: RtcpPacketType.SR,
			hasPadding: true,
			padding: 4,
		});

		expect(packet.getSsrc()).toBe(0x5d931534);
		expect(packet.getNtp()).toEqual({ seconds: 1111, fractions: 2222 });
		expect(packet.getRtpTimestamp()).toBe(3333);
		expect(packet.getPacketCount()).toBe(4444);
		expect(packet.getOctetCount()).toBe(5555);
		expect(packet.getReportsCount()).toBe(0);
		expect(packet.getReports()).toEqual([]);
	});

	test('SenderReportPacket.parse() fails', () => {
		// No space for the sender info.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, RC=0, PT:200, Length: 1
			0b10000000, 0xc8, 0x00, 0x01,
			// SSRC of sender: 1111
			0x00, 0x00, 0x04, 0x57,
		]);

		expect(() => SenderReportPacket.parse(buffer1)).toThrow(TypeError);

		// RC field announces 1 report block but there is none.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, RC=1, PT:200, Length: 6
			0b10000001, 0xc8, 0x00, 0x06,
			// SSRC of sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// Sender info
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => SenderReportPacket.parse(buffer2)).toThrow(TypeError);
	});

	test('SenderReportPacket.factory() succeeds', () => {
		const checkFields = (packet: SenderReportPacket): void => {
			const reports = packet.getReports();

			expect(packet.getSsrc()).toBe(1111);
			expect(packet.getNtp()).toEqual({ seconds: 2222, fractions: 3333 });
			expect(packet.getRtpTimestamp()).toBe(4444);
			expect(packet.getPacketCount()).toBe(5555);
			expect(packet.getOctetCount()).toBe(6666);
			expect(packet.getReportsCount()).toBe(2);
			expect(reports.length).toBe(2);

			expect(reports[0]).toEqual({
				ssrc: 7777,
				fractionLost: 1,
				totalLost: 2,
				highestSeq: 3,
				jitter: 4,
				lsr: 5,
				dlsr: 6,
			});

			expect(reports[1]).toEqual({
				ssrc: 8888,
				fractionLost: 255,
				totalLost: -2,
				highestSeq: 0xffffffff,
				jitter: 0xffffffff,
				lsr: 0xffffffff,
				dlsr: 0xffffffff,
			});
		};

		// Dirty the buffer to check that factory() writes zeros in the fixed
		// header.
		factoryBuffer.fill(0xff);

		const packet = SenderReportPacket.factory(factoryBuffer);
		const expected: ExpectedRtcpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 28,
			packetType: RtcpPacketType.SR,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getSsrc()).toBe(0);
		expect(packet.getNtp()).toEqual({ seconds: 0, fractions: 0 });
		expect(packet.getRtpTimestamp()).toBe(0);
		expect(packet.getPacketCount()).toBe(0);
		expect(packet.getOctetCount()).toBe(0);
		expect(packet.getReportsCount()).toBe(0);
		expect(packet.getReports()).toEqual([]);

		/* Modify it. */

		packet.setSsrc(1111);
		packet.setNtp({ seconds: 2222, fractions: 3333 });
		packet.setRtpTimestamp(4444);
		packet.setPacketCount(5555);
		packet.setOctetCount(6666);
		packet.addReport({
			ssrc: 7777,
			fractionLost: 1,
			totalLost: 2,
			highestSeq: 3,
			jitter: 4,
			lsr: 5,
			dlsr: 6,
		});
		packet.addReport({
			ssrc: 8888,
			fractionLost: 255,
			totalLost: -2,
			highestSeq: 0xffffffff,
			jitter: 0xffffffff,
			lsr: 0xffffffff,
			dlsr: 0xffffffff,
		});

		checkRtcpPacket(packet, { ...expected, length: 76 });

		checkFields(packet);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		checkRtcpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 76,
		});

		checkFields(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 76,
		});

		checkFields(clonedPacket);
	});

	test('SenderReportPacket.addReport() throws if there is no space in the buffer', () => {
		const report: ReceptionReport = {
			ssrc: 1111,
			fractionLost: 0,
			totalLost: 0,
			highestSeq: 0,
			jitter: 0,
			lsr: 0,
			dlsr: 0,
		};
		const packet = SenderReportPacket.factory(factoryBuffer.subarray(0, 51));

		expect(packet.getLength()).toBe(28);

		// The report block would need 52 bytes in total.
		expect(() => packet.addReport(report)).toThrow(TypeError);

		expect(packet.getLength()).toBe(28);
		expect(packet.getReportsCount()).toBe(0);
		expect(packet.getReports()).toEqual([]);
	});

	test('SenderReportPacket.factory() throws if the buffer is too small', () => {
		expect(() =>
			SenderReportPacket.factory(factoryBuffer.subarray(0, 27))
		).toThrow(TypeError);
	});

	test('SenderReportPacket.computeLengthFor() succeeds', () => {
		const report: ReceptionReport = {
			ssrc: 0,
			fractionLost: 0,
			totalLost: 0,
			highestSeq: 0,
			jitter: 0,
			lsr: 0,
			dlsr: 0,
		};

		expect(SenderReportPacket.computeLengthFor(0)).toBe(28);

		const packet = SenderReportPacket.factory(factoryBuffer);

		packet.addReport({ ...report, ssrc: 7777 });
		packet.addReport({ ...report, ssrc: 8888 });

		expect(SenderReportPacket.computeLengthFor(2)).toBe(76);
		expect(packet.getLength()).toBe(SenderReportPacket.computeLengthFor(2));
	});
});
