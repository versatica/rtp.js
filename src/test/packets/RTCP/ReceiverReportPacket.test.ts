import { ReceiverReportPacket } from '../../../packets/RTCP/ReceiverReportPacket';
import {
	MAX_REPORTS,
	type ReceptionReport,
} from '../../../packets/RTCP/AnyReportPacket';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { checkPacket, type ExpectedPacket } from './rtcpCommon';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers';

beforeEach(resetBuffers);

describe('RTCP Receiver Report Packet', () => {
	test('ReceiverReportPacket.parse() succeeds', () => {
		const checkReports = (packet: ReceiverReportPacket): void => {
			const reports = packet.getReports();

			expect(packet.getSsrc()).toBe(0x5d931534);
			expect(packet.getReportsCount()).toBe(2);
			expect(reports.length).toBe(2);

			expect(reports[0]).toEqual({
				ssrc: 0x01932db4,
				fractionLost: 80,
				totalLost: 8,
				highestSeq: 65541,
				jitter: 32,
				lsr: 0x12345678,
				dlsr: 65536,
			});

			expect(reports[1]).toEqual({
				ssrc: 1234,
				fractionLost: 0,
				totalLost: -1,
				highestSeq: 0xffffffff,
				jitter: 0,
				lsr: 0,
				dlsr: 0,
			});
		};

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, RC=2, PT:201, Length: 14
			0b10000010, 0xc9, 0x00, 0x0e,
			// SSRC of packet sender: 0x5d931534
			0x5d, 0x93, 0x15, 0x34,
			// Report block 1
			// SSRC: 0x01932db4
			0x01, 0x93, 0x2d, 0xb4,
			// Fraction lost: 80, Total lost: 8
			0x50, 0x00, 0x00, 0x08,
			// Extended highest seq: 65541
			0x00, 0x01, 0x00, 0x05,
			// Jitter: 32
			0x00, 0x00, 0x00, 0x20,
			// LSR: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// DLSR: 65536
			0x00, 0x01, 0x00, 0x00,
			// Report block 2
			// SSRC: 1234
			0x00, 0x00, 0x04, 0xd2,
			// Fraction lost: 0, Total lost: -1
			0x00, 0xff, 0xff, 0xff,
			// Extended highest seq: 4294967295
			0xff, 0xff, 0xff, 0xff,
			// Jitter: 0
			0x00, 0x00, 0x00, 0x00,
			// LSR: 0
			0x00, 0x00, 0x00, 0x00,
			// DLSR: 0
			0x00, 0x00, 0x00, 0x00,
			// Profile-specific extensions
			0xaa, 0xbb, 0xcc, 0xdd,
		]);
		const packet = ReceiverReportPacket.parse(buffer);
		const expected: ExpectedPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 60,
			packetType: RtcpPacketType.RR,
			hasPadding: false,
			padding: 0,
		};

		checkPacket(packet, expected);

		checkReports(packet);

		// Cannot add report blocks to a packet with profile-specific extensions.
		expect(() =>
			packet.addReport({
				ssrc: 3333,
				fractionLost: 0,
				totalLost: 0,
				highestSeq: 0,
				jitter: 0,
				lsr: 0,
				dlsr: 0,
			})
		).toThrow(TypeError);

		expect(packet.getLength()).toBe(60);

		checkReports(packet);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		buffer.fill(0xff);

		checkPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
		});

		checkReports(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
		});

		checkReports(clonedPacket);
	});

	test('ReceiverReportPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, RC=0, PT:201, Length: 2
			0b10100000, 0xc9, 0x00, 0x02,
			// SSRC of packet sender: 0x5d931534
			0x5d, 0x93, 0x15, 0x34,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
			// Extra space in the buffer
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
		]);
		const packet = ReceiverReportPacket.parse(buffer);
		const expected: ExpectedPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 12,
			packetType: RtcpPacketType.RR,
			hasPadding: true,
			padding: 4,
		};

		checkPacket(packet, expected);

		expect(packet.getSsrc()).toBe(0x5d931534);
		expect(packet.getReportsCount()).toBe(0);

		/* Modify it (it removes the padding). */

		// Padding is not a profile-specific extension, so addReport() does not
		// throw.
		packet.addReport({
			ssrc: 3333,
			fractionLost: 1,
			totalLost: 2,
			highestSeq: 3,
			jitter: 4,
			lsr: 5,
			dlsr: 6,
		});

		checkPacket(packet, {
			...expected,
			length: 32,
			hasPadding: false,
			padding: 0,
		});

		const reports = packet.getReports();

		expect(packet.getReportsCount()).toBe(1);
		expect(reports.length).toBe(1);
		expect(reports[0]!.ssrc).toBe(3333);
		expect(reports[0]!.dlsr).toBe(6);
	});

	test('ReceiverReportPacket.parse() fails', () => {
		// No space for the SSRC of packet sender.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, RC=0, PT:201, Length: 0
			0b10000000, 0xc9, 0x00, 0x00,
		]);

		expect(() => ReceiverReportPacket.parse(buffer1)).toThrow(TypeError);

		// RC field announces 1 report block but there is none.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// V=2, P=0, RC=1, PT:201, Length: 1
			0b10000001, 0xc9, 0x00, 0x01,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
		]);

		expect(() => ReceiverReportPacket.parse(buffer2)).toThrow(TypeError);

		// RC field announces 2 report blocks but there is only 1.
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, RC=2, PT:201, Length: 7
			0b10000010, 0xc9, 0x00, 0x07,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// Report block 1
			0x00, 0x00, 0x08, 0xae,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => ReceiverReportPacket.parse(buffer3)).toThrow(TypeError);
	});

	test('ReceiverReportPacket.factory() succeeds', () => {
		const checkReports = (packet: ReceiverReportPacket): void => {
			const reports = packet.getReports();

			expect(packet.getSsrc()).toBe(1111);
			expect(packet.getReportsCount()).toBe(2);
			expect(reports.length).toBe(2);

			expect(reports[0]).toEqual({
				ssrc: 2222,
				fractionLost: 1,
				totalLost: 2,
				highestSeq: 3,
				jitter: 4,
				lsr: 5,
				dlsr: 6,
			});

			expect(reports[1]).toEqual({
				ssrc: 3333,
				fractionLost: 255,
				totalLost: -2,
				highestSeq: 0xffffffff,
				jitter: 0xffffffff,
				lsr: 0xffffffff,
				dlsr: 0xffffffff,
			});
		};

		const packet = ReceiverReportPacket.factory(factoryBuffer);
		const expected: ExpectedPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 8,
			packetType: RtcpPacketType.RR,
			hasPadding: false,
			padding: 0,
		};

		checkPacket(packet, expected);

		expect(packet.getSsrc()).toBe(0);
		expect(packet.getReportsCount()).toBe(0);
		expect(packet.getReports()).toEqual([]);

		/* Modify it. */

		packet.setSsrc(1111);
		packet.addReport({
			ssrc: 2222,
			fractionLost: 1,
			totalLost: 2,
			highestSeq: 3,
			jitter: 4,
			lsr: 5,
			dlsr: 6,
		});
		packet.addReport({
			ssrc: 3333,
			fractionLost: 255,
			totalLost: -2,
			highestSeq: 0xffffffff,
			jitter: 0xffffffff,
			lsr: 0xffffffff,
			dlsr: 0xffffffff,
		});

		checkPacket(packet, { ...expected, length: 56 });

		checkReports(packet);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		checkPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 56,
		});

		checkReports(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 56,
		});

		checkReports(clonedPacket);
	});

	test('ReceiverReportPacket.addReport() throws if totalLost is out of range', () => {
		const packet = ReceiverReportPacket.factory(factoryBuffer);
		const report: ReceptionReport = {
			ssrc: 1111,
			fractionLost: 0,
			totalLost: 0,
			highestSeq: 0,
			jitter: 0,
			lsr: 0,
			dlsr: 0,
		};

		packet.addReport({ ...report, totalLost: 8388607 });

		expect(() => packet.addReport({ ...report, totalLost: 8388608 })).toThrow(
			TypeError
		);

		packet.addReport({ ...report, totalLost: -8388608 });

		expect(() => packet.addReport({ ...report, totalLost: -8388609 })).toThrow(
			TypeError
		);

		const reports = packet.getReports();

		expect(reports.length).toBe(2);
		expect(reports[0]!.totalLost).toBe(8388607);
		expect(reports[1]!.totalLost).toBe(-8388608);
	});

	test('ReceiverReportPacket.addReport() throws', () => {
		const report: ReceptionReport = {
			ssrc: 1111,
			fractionLost: 0,
			totalLost: 0,
			highestSeq: 0,
			jitter: 0,
			lsr: 0,
			dlsr: 0,
		};
		const packet = ReceiverReportPacket.factory(factoryBuffer);

		for (let idx = 0; idx < MAX_REPORTS; ++idx) {
			packet.addReport(report);
		}

		expect(packet.getReportsCount()).toBe(31);
		expect(packet.getLength()).toBe(8 + 31 * 24);

		// No more than 31 report blocks.
		expect(() => packet.addReport(report)).toThrow(TypeError);

		expect(packet.getReportsCount()).toBe(31);
		expect(packet.getLength()).toBe(8 + 31 * 24);
	});

	test('ReceiverReportPacket.addReport() throws if there is no space in the buffer', () => {
		const report: ReceptionReport = {
			ssrc: 1111,
			fractionLost: 0,
			totalLost: 0,
			highestSeq: 0,
			jitter: 0,
			lsr: 0,
			dlsr: 0,
		};
		const packet = ReceiverReportPacket.factory(factoryBuffer.subarray(0, 31));

		expect(packet.getLength()).toBe(8);

		// The report block would need 32 bytes in total.
		expect(() => packet.addReport(report)).toThrow(TypeError);

		expect(packet.getLength()).toBe(8);
		expect(packet.getReportsCount()).toBe(0);
		expect(packet.getReports()).toEqual([]);
	});

	test('ReceiverReportPacket.factory() throws if the buffer is too small', () => {
		expect(() =>
			ReceiverReportPacket.factory(factoryBuffer.subarray(0, 7))
		).toThrow(TypeError);
	});

	test('ReceiverReportPacket.computeLengthFor() succeeds', () => {
		const report: ReceptionReport = {
			ssrc: 0,
			fractionLost: 0,
			totalLost: 0,
			highestSeq: 0,
			jitter: 0,
			lsr: 0,
			dlsr: 0,
		};

		expect(ReceiverReportPacket.computeLengthFor(0)).toBe(8);

		const packet = ReceiverReportPacket.factory(factoryBuffer);

		packet.addReport({ ...report, ssrc: 7777 });
		packet.addReport({ ...report, ssrc: 8888 });

		expect(ReceiverReportPacket.computeLengthFor(2)).toBe(56);
		expect(packet.getLength()).toBe(ReceiverReportPacket.computeLengthFor(2));
	});
});
