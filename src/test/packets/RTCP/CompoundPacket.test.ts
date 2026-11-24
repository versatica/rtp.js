import { CompoundPacket } from '../../../packets/RTCP/CompoundPacket';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { ByePacket } from '../../../packets/RTCP/ByePacket';
import { UnknownPacket } from '../../../packets/RTCP/UnknownPacket';
import { SdesPacket, SdesItemType } from '../../../packets/RTCP/SdesPacket';
import { ReceiverReportPacket } from '../../../packets/RTCP/ReceiverReportPacket';
import { SenderReportPacket } from '../../../packets/RTCP/SenderReportPacket';
import { NackPacket } from '../../../packets/RTCP/NackPacket';
import { PliPacket } from '../../../packets/RTCP/PliPacket';
import { FirPacket } from '../../../packets/RTCP/FirPacket';
import { RembPacket } from '../../../packets/RTCP/RembPacket';
import { TransportWideCcPacket } from '../../../packets/RTCP/TransportWideCcPacket';
import { UnknownPayloadSpecificFeedbackPacket } from '../../../packets/RTCP/UnknownPayloadSpecificFeedbackPacket';
import { TransportLayerFeedbackMessageType } from '../../../packets/RTCP/AnyTransportLayerFeedbackPacket';
import { PayloadSpecificFeedbackMessageType } from '../../../packets/RTCP/AnyPayloadSpecificFeedbackPacket';
import { XrPacket } from '../../../packets/RTCP/XrPacket';
import { ExtendedReportBlockType } from '../../../packets/RTCP/ExtendedReport';
import { RrtExtendedReport } from '../../../packets/RTCP/extendedReports/RrtExtendedReport';
import { DlrrExtendedReport } from '../../../packets/RTCP/extendedReports/DlrrExtendedReport';
import type { Serializable } from '../../../packets/common/Serializable';
import { areBuffersEqual } from '../../../utils/buffers';
import { checkRtcpCompoundPacket, checkRtcpPacket } from './rtcpCommon';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers';

beforeEach(resetBuffers);

/**
 * Whether the given serializable lives at `offset` bytes from the start of the
 * given buffer.
 */
function isAtOffset(
	serializable: Serializable,
	buffer: Uint8Array,
	offset: number
): boolean {
	const serializableBuffer = serializable.getBuffer();

	return (
		serializableBuffer.buffer === buffer.buffer &&
		serializableBuffer.byteOffset === buffer.byteOffset + offset
	);
}

describe('RTCP Compound Packet', () => {
	test('CompoundPacket.parse() succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// Bye Packet
			// V=2, P=0, SC=3, PT:203, Length: 5
			0b10000011, 0xcb, 0x00, 0x05,
			// SSRC 1: 1111111
			0x00, 0x10, 0xf4, 0x47,
			// SSRC 2: 2222222
			0x00, 0x21, 0xe8, 0x8e,
			// SSRC 3: 12345678
			0x00, 0xbc, 0x61, 0x4e,
			// Reason length: 6, Reason: "foo"
			0x06, 0x66, 0x6f, 0x6f,
			// Reason: "bar", 1 byte of padding
			0x62, 0x61, 0x72, 0x00,
			// Unknown Packet
			// V=2, P=0, Count=5, PT:222, Length: 2
			0b10000101, 0xde, 0x00, 0x02,
			// 8 bytes of value
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
			// APP Packet (not implemented so it must be parsed as Unknown Packet)
			// V=2, P=0, Subtype=1, PT:204, Length: 3
			0b10000001, 0xcc, 0x00, 0x03,
			// SSRC: 0x11223344
			0x11, 0x22, 0x33, 0x44,
			// Name: "abcd"
			0x61, 0x62, 0x63, 0x64,
			// 4 bytes of application-dependent data
			0xaa, 0xbb, 0xcc, 0xdd,
		]);
		const compoundPacket = CompoundPacket.parse(buffer);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 52,
			packetsCount: 3,
		});

		const packets = compoundPacket.getPackets();
		const packet1 = packets[0] as ByePacket;

		expect(compoundPacket.getFirstPacketOfType(ByePacket)).toBe(packet1);

		checkRtcpPacket(packet1, {
			buffer: buffer,
			bufferLength: 24,
			length: 24,
			packetType: RtcpPacketType.BYE,
			hasPadding: false,
			padding: 0,
		});

		expect(packet1.getSsrcs()).toEqual([1111111, 2222222, 12345678]);
		expect(packet1.getReason()).toBe('foobar');
		// Check padding bytes.
		expect(packet1.getBuffer()[packet1.getLength() - 1]).toBe(0);
		expect(packet1.getBuffer()[packet1.getLength() - 2]).toBe(0x72);

		const packet2 = packets[1] as UnknownPacket;

		expect(compoundPacket.getFirstPacketOfType(UnknownPacket)).toBe(packet2);

		checkRtcpPacket(packet2, {
			buffer: buffer.subarray(24),
			bufferLength: 12,
			length: 12,
			packetType: 222 as RtcpPacketType,
			hasPadding: false,
			padding: 0,
		});

		expect(packet2.getUnknownValue().byteLength).toBe(8);
		expect(packet2.getUnknownValue()[0]).toBe(0x11);
		expect(packet2.getUnknownValue()[1]).toBe(0x22);
		expect(packet2.getUnknownValue()[7]).toBe(0x88);

		const packet3 = packets[2] as UnknownPacket;

		checkRtcpPacket(packet3, {
			buffer: buffer.subarray(36),
			bufferLength: 16,
			length: 16,
			packetType: 204 as RtcpPacketType,
			hasPadding: false,
			padding: 0,
		});

		expect(packet3.getUnknownValue().byteLength).toBe(12);
		expect(packet3.getUnknownValue()[0]).toBe(0x11);
		expect(packet3.getUnknownValue()[11]).toBe(0xdd);
	});

	test('CompoundPacket.parse() fails', () => {
		// A valid packet followed by a malformed BYE packet, whose SC field
		// announces 2 SSRCs that don't fit in its length, so the whole compound
		// packet is rejected.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// Unknown Packet
			// V=2, P=0, Count=5, PT:222, Length: 2
			0b10000101, 0xde, 0x00, 0x02,
			// 8 bytes of value
			0x11, 0x22, 0x33, 0x44,
			0x55, 0x66, 0x77, 0x88,
			// Bye Packet
			// V=2, P=0, SC=2, PT:203, Length: 1
			0b10000010, 0xcb, 0x00, 0x01,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
		]);

		expect(() => CompoundPacket.parse(buffer1)).toThrow(TypeError);

		// A valid BYE packet followed by 2 bytes that don't form a packet.
		// prettier-ignore
		const buffer2 = new Uint8Array([
			// Bye Packet
			// V=2, P=0, SC=1, PT:203, Length: 1
			0b10000001, 0xcb, 0x00, 0x01,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
			// 2 extra bytes
			0x11, 0x22,
		]);

		expect(() => CompoundPacket.parse(buffer2)).toThrow(TypeError);

		// A BYE packet whose Length field announces more bytes than the remaining
		// ones.
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// Bye Packet
			// V=2, P=0, SC=1, PT:203, Length: 2
			0b10000001, 0xcb, 0x00, 0x02,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
		]);

		expect(() => CompoundPacket.parse(buffer3)).toThrow(TypeError);

		// The first byte is not RTCP (V=0).
		// prettier-ignore
		const buffer4 = new Uint8Array([
			// V=0, P=0, SC=1, PT:203, Length: 1
			0b00000001, 0xcb, 0x00, 0x01,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
		]);

		expect(() => CompoundPacket.parse(buffer4)).toThrow(TypeError);

		// Less bytes than the RTCP Common Header.
		// prettier-ignore
		const buffer5 = new Uint8Array([
			0b10000001, 0xcb, 0x00,
		]);

		expect(() => CompoundPacket.parse(buffer5)).toThrow(TypeError);

		// The packet type is not in the RTCP range (192-223).
		// prettier-ignore
		const buffer6 = new Uint8Array([
			// V=2, P=0, Count=1, PT:0, Length: 1
			0b10000001, 0x00, 0x00, 0x01,
			0x00, 0x00, 0x04, 0x57,
		]);

		expect(() => CompoundPacket.parse(buffer6)).toThrow(TypeError);

		// The Padding bit is set and the last byte announces more padding bytes
		// (87) than the packet has after the Common Header (4).
		// prettier-ignore
		const buffer7 = new Uint8Array([
			// Bye Packet
			// V=2, P=1, SC=1, PT:203, Length: 1
			0b10100001, 0xcb, 0x00, 0x01,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
		]);

		expect(() => CompoundPacket.parse(buffer7)).toThrow(TypeError);

		// The Padding bit is set but the last byte announces 0 padding bytes.
		// prettier-ignore
		const buffer8 = new Uint8Array([
			// Bye Packet
			// V=2, P=1, SC=1, PT:203, Length: 2
			0b10100001, 0xcb, 0x00, 0x02,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
			// Padding: 4 bytes, the last one being 0
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => CompoundPacket.parse(buffer8)).toThrow(TypeError);

		// The Padding bit is set and the padding bytes (8) would eat the SSRC
		// that the SC field announces.
		// prettier-ignore
		const buffer9 = new Uint8Array([
			// Bye Packet
			// V=2, P=1, SC=1, PT:203, Length: 2
			0b10100001, 0xcb, 0x00, 0x02,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
			// Padding: 4 bytes, the last one announcing 8
			0x00, 0x00, 0x00, 0x08,
		]);

		expect(() => CompoundPacket.parse(buffer9)).toThrow(TypeError);
	});

	test('CompoundPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// Bye Packet
			// V=2, P=1, SC=1, PT:203, Length: 2
			0b10100001, 0xcb, 0x00, 0x02,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
			// Padding: 4 bytes
			0x00, 0x00, 0x00, 0x04,
			// Unknown Packet
			// V=2, P=1, Count=5, PT:222, Length: 2
			0b10100101, 0xde, 0x00, 0x02,
			// 5 bytes of value
			0x11, 0x22, 0x33, 0x44,
			0x55,
			// Padding: 3 bytes
			0x00, 0x00, 0x03,
		]);
		const compoundPacket = CompoundPacket.parse(buffer);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 24,
			packetsCount: 2,
		});

		const packets = compoundPacket.getPackets();
		const packet1 = packets[0] as ByePacket;

		checkRtcpPacket(packet1, {
			buffer: buffer,
			bufferLength: 12,
			length: 12,
			packetType: RtcpPacketType.BYE,
			hasPadding: true,
			padding: 4,
		});

		expect(packet1.getSsrcs()).toEqual([1111]);
		expect(packet1.getReason()).toBeUndefined();

		const packet2 = packets[1] as UnknownPacket;

		checkRtcpPacket(packet2, {
			buffer: buffer.subarray(12),
			bufferLength: 12,
			length: 12,
			packetType: 222 as RtcpPacketType,
			hasPadding: true,
			padding: 3,
		});

		expect(packet2.getUnknownValue().byteLength).toBe(5);
		expect(packet2.getUnknownValue()[0]).toBe(0x11);
		expect(packet2.getUnknownValue()[4]).toBe(0x55);
	});

	test('CompoundPacket.factory() succeeds', () => {
		function checkPackets(
			compoundPacket: CompoundPacket,
			buffer: Uint8Array
		): void {
			const packets = compoundPacket.getPackets();
			const packet1 = packets[0] as ByePacket;
			const packet2 = packets[1] as SdesPacket;
			const packet3 = packets[2] as ReceiverReportPacket;
			const packet4 = packets[3] as SenderReportPacket;
			const packet5 = packets[4] as NackPacket;
			const packet6 = packets[5] as PliPacket;
			const packet7 = packets[6] as FirPacket;
			const packet8 = packets[7] as RembPacket;
			const packet9 = packets[8] as XrPacket;
			const extendedReports = packet9.getExtendedReports();
			const rrtExtendedReport = extendedReports[0] as RrtExtendedReport;
			const dlrrExtendedReport = extendedReports[1] as DlrrExtendedReport;

			expect(isAtOffset(packet1, buffer, 0)).toBe(true);
			expect(packet1.getLength()).toBe(12);
			expect(packet1.getSsrcs()).toEqual([1111]);
			expect(packet1.getReason()).toBe('foo');

			expect(isAtOffset(packet2, buffer, 12)).toBe(true);
			expect(packet2.getLength()).toBe(16);
			expect(packet2.getChunks()).toEqual([
				{ ssrc: 3333, items: [{ type: SdesItemType.CNAME, text: 'abc' }] },
			]);

			expect(isAtOffset(packet3, buffer, 28)).toBe(true);
			expect(packet3.getLength()).toBe(32);
			expect(packet3.getSsrc()).toBe(4444);
			expect(packet3.getReports()).toEqual([
				{
					ssrc: 5555,
					fractionLost: 10,
					totalLost: -3,
					highestSeq: 100,
					jitter: 20,
					lsr: 30,
					dlsr: 40,
				},
			]);

			expect(isAtOffset(packet4, buffer, 60)).toBe(true);
			expect(packet4.getLength()).toBe(28);
			expect(packet4.getSsrc()).toBe(6666);
			expect(packet4.getNtp()).toEqual({ seconds: 1, fractions: 2 });
			expect(packet4.getRtpTimestamp()).toBe(3);
			expect(packet4.getPacketCount()).toBe(4);
			expect(packet4.getOctetCount()).toBe(5);
			expect(packet4.getReports()).toEqual([]);

			expect(isAtOffset(packet5, buffer, 88)).toBe(true);
			expect(packet5.getLength()).toBe(16);
			expect(packet5.getMessageType()).toBe(
				TransportLayerFeedbackMessageType.NACK
			);
			expect(packet5.getSenderSsrc()).toBe(7777);
			expect(packet5.getMediaSsrc()).toBe(8888);
			expect(packet5.getItems()).toEqual([{ pid: 9999, bitmask: 0x0005 }]);

			expect(isAtOffset(packet6, buffer, 104)).toBe(true);
			expect(packet6.getLength()).toBe(12);
			expect(packet6.getMessageType()).toBe(
				PayloadSpecificFeedbackMessageType.PLI
			);
			expect(packet6.getSenderSsrc()).toBe(1001);
			expect(packet6.getMediaSsrc()).toBe(1002);

			expect(isAtOffset(packet7, buffer, 116)).toBe(true);
			expect(packet7.getLength()).toBe(20);
			expect(packet7.getMessageType()).toBe(
				PayloadSpecificFeedbackMessageType.FIR
			);
			expect(packet7.getSenderSsrc()).toBe(1003);
			expect(packet7.getMediaSsrc()).toBe(0);
			expect(packet7.getItems()).toEqual([{ ssrc: 1004, sequenceNumber: 7 }]);

			expect(isAtOffset(packet8, buffer, 136)).toBe(true);
			expect(packet8.getLength()).toBe(24);
			expect(packet8.getMessageType()).toBe(
				PayloadSpecificFeedbackMessageType.AFB
			);
			expect(packet8.getSenderSsrc()).toBe(1005);
			expect(packet8.getMediaSsrc()).toBe(0);
			expect(packet8.getBitrate()).toBe(522022);
			expect(packet8.getSsrcs()).toEqual([1006]);

			expect(isAtOffset(packet9, buffer, 160)).toBe(true);
			expect(packet9.getLength()).toBe(36);
			expect(packet9.getSsrc()).toBe(1007);
			expect(extendedReports.length).toBe(2);
			expect(isAtOffset(rrtExtendedReport, buffer, 168)).toBe(true);
			expect(rrtExtendedReport.getBlockType()).toBe(
				ExtendedReportBlockType.RRT
			);
			expect(rrtExtendedReport.getNtp()).toEqual({
				seconds: 1008,
				fractions: 1009,
			});
			expect(isAtOffset(dlrrExtendedReport, buffer, 180)).toBe(true);
			expect(dlrrExtendedReport.getBlockType()).toBe(
				ExtendedReportBlockType.DLRR
			);
			expect(dlrrExtendedReport.getSubBlocks()).toEqual([
				{
					ssrc: 1010,
					lastReceiverReport: 1011,
					delaySinceLastReceiverReport: 1012,
				},
			]);
		}

		const buffer = factoryBuffer.subarray(0, 1000);
		const compoundPacket = CompoundPacket.factory(buffer);

		expect(compoundPacket.getLength()).toBe(0);
		expect(compoundPacket.getPackets()).toEqual([]);
		expect(compoundPacket.needsConsolidation()).toBe(false);

		/* Clone it while empty. */

		const emptyClonedCompoundPacket = compoundPacket.clone(cloneBuffer);

		expect(emptyClonedCompoundPacket.getBuffer().buffer).toBe(
			cloneBuffer.buffer
		);
		expect(emptyClonedCompoundPacket.getLength()).toBe(0);
		expect(emptyClonedCompoundPacket.getPackets()).toEqual([]);

		/* Build a packet and consolidate it. */

		const packet1 = compoundPacket.buildPacketInPlace(ByePacket);

		packet1.addSsrc(1111);
		packet1.setReason('foo');

		// The compound packet length doesn't include the packet being built in
		// place.
		expect(compoundPacket.getLength()).toBe(0);
		expect(compoundPacket.needsConsolidation()).toBe(true);
		expect(packet1.getLength()).toBe(12);

		packet1.consolidate();

		expect(compoundPacket.getLength()).toBe(12);
		expect(compoundPacket.getPackets().length).toBe(1);
		expect(compoundPacket.needsConsolidation()).toBe(false);

		/* Build a packet and discard it. */

		const packet2 = compoundPacket.buildPacketInPlace(ByePacket);

		packet2.addSsrc(2222);
		packet2.addSsrc(2223);

		expect(compoundPacket.getLength()).toBe(12);
		expect(packet2.getLength()).toBe(12);

		packet2.discard();

		expect(compoundPacket.getLength()).toBe(12);
		expect(compoundPacket.getPackets().length).toBe(1);
		expect(compoundPacket.needsConsolidation()).toBe(false);

		/* Build another packet in the same place and consolidate it. */

		const packet3 = compoundPacket.buildPacketInPlace(SdesPacket);

		expect(isAtOffset(packet3, buffer, 12)).toBe(true);

		packet3.addChunk({
			ssrc: 3333,
			items: [{ type: SdesItemType.CNAME, text: 'abc' }],
		});
		packet3.consolidate();

		// consolidate() or discard() can only be called once.
		expect(() => packet3.consolidate()).toThrow(Error);
		expect(() => packet3.discard()).toThrow(Error);

		/* Build another packet and consolidate it. */

		const packet4 = compoundPacket.buildPacketInPlace(ReceiverReportPacket);

		expect(isAtOffset(packet4, buffer, 28)).toBe(true);

		packet4.setSsrc(4444);
		packet4.addReport({
			ssrc: 5555,
			fractionLost: 10,
			totalLost: -3,
			highestSeq: 100,
			jitter: 20,
			lsr: 30,
			dlsr: 40,
		});
		packet4.consolidate();

		/* Build another packet and consolidate it. */

		const packet5 = compoundPacket.buildPacketInPlace(SenderReportPacket);

		expect(isAtOffset(packet5, buffer, 60)).toBe(true);

		packet5.setSsrc(6666);
		packet5.setNtp({ seconds: 1, fractions: 2 });
		packet5.setRtpTimestamp(3);
		packet5.setPacketCount(4);
		packet5.setOctetCount(5);
		packet5.consolidate();

		/* Build another packet and consolidate it. */

		const packet6 = compoundPacket.buildPacketInPlace(NackPacket);

		expect(isAtOffset(packet6, buffer, 88)).toBe(true);

		packet6.setSenderSsrc(7777);
		packet6.setMediaSsrc(8888);
		packet6.addItem({ pid: 9999, bitmask: 0x0005 });
		packet6.consolidate();

		/* Build another packet and consolidate it. */

		const packet7 = compoundPacket.buildPacketInPlace(PliPacket);

		expect(isAtOffset(packet7, buffer, 104)).toBe(true);

		packet7.setSenderSsrc(1001);
		packet7.setMediaSsrc(1002);
		packet7.consolidate();

		/* Build another packet and consolidate it. */

		const packet8 = compoundPacket.buildPacketInPlace(FirPacket);

		expect(isAtOffset(packet8, buffer, 116)).toBe(true);

		packet8.setSenderSsrc(1003);
		packet8.addItem({ ssrc: 1004, sequenceNumber: 7 });
		packet8.consolidate();

		/* Build another packet and consolidate it. */

		const packet9 = compoundPacket.buildPacketInPlace(RembPacket);

		expect(isAtOffset(packet9, buffer, 136)).toBe(true);

		packet9.setSenderSsrc(1005);
		packet9.setBitrate(522022);
		packet9.addSsrc(1006);
		packet9.consolidate();

		/* Build another packet, with Extended Report blocks built in place, and
		 * consolidate it. */

		const packet10 = compoundPacket.buildPacketInPlace(XrPacket);

		expect(isAtOffset(packet10, buffer, 160)).toBe(true);

		packet10.setSsrc(1007);

		const rrtExtendedReport =
			packet10.buildExtendedReportInPlace(RrtExtendedReport);

		rrtExtendedReport.setNtp({ seconds: 1008, fractions: 1009 });
		rrtExtendedReport.consolidate();

		const dlrrExtendedReport =
			packet10.buildExtendedReportInPlace(DlrrExtendedReport);

		dlrrExtendedReport.addSubBlock({
			ssrc: 1010,
			lastReceiverReport: 1011,
			delaySinceLastReceiverReport: 1012,
		});
		dlrrExtendedReport.consolidate();

		packet10.consolidate();

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: buffer,
			bufferLength: 1000,
			length: 196,
			packetsCount: 9,
		});

		checkPackets(compoundPacket, buffer);

		/* Serialize it. */

		compoundPacket.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 196,
			packetsCount: 9,
		});

		checkPackets(compoundPacket, serializeBuffer);

		/* Clone it. */

		const clonedCompoundPacket = compoundPacket.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpCompoundPacket(clonedCompoundPacket, {
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 196,
			packetsCount: 9,
		});

		checkPackets(clonedCompoundPacket, cloneBuffer);
	});

	test('CompoundPacket.parse() dispatches AFB packets by application', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// REMB Packet
			// V=2, P=0, FMT=15, PT:206, Length: 4
			0b10001111, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Unique identifier: 'R' 'E' 'M' 'B'
			0x52, 0x45, 0x4d, 0x42,
			// Num SSRC: 0, BR Exp: 1, BR Mantissa: 0x3fb93
			0x00, 0x07, 0xfb, 0x93,
			// AFB Packet that is not REMB
			// V=2, P=0, FMT=15, PT:206, Length: 3
			0b10001111, 0xce, 0x00, 0x03,
			// SSRC of packet sender: 0xfa17fa17
			0xfa, 0x17, 0xfa, 0x17,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// 4 bytes of value
			0x00, 0x00, 0x00, 0x01,
		]);
		const compoundPacket = CompoundPacket.parse(buffer);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 36,
			packetsCount: 2,
		});

		const packets = compoundPacket.getPackets();
		const rembPacket = compoundPacket.getFirstPacketOfType(RembPacket);
		const unknownPacket = compoundPacket.getFirstPacketOfType(
			UnknownPayloadSpecificFeedbackPacket
		);

		expect(rembPacket).toBe(packets[0]);
		expect(rembPacket!.getBitrate()).toBe(522022);
		expect(unknownPacket).toBe(packets[1]);
		expect(unknownPacket!.getMessageType()).toBe(
			PayloadSpecificFeedbackMessageType.AFB
		);
	});

	test('CompoundPacket.parse() with a XR packet, compoundPacket.serialize() and compoundPacket.clone() succeed', () => {
		function checkPackets(
			compoundPacket: CompoundPacket,
			buffer: Uint8Array
		): void {
			const packets = compoundPacket.getPackets();
			const packet1 = packets[0] as ByePacket;
			const packet2 = packets[1] as XrPacket;
			const extendedReports = packet2.getExtendedReports();
			const rrtExtendedReport = extendedReports[0] as RrtExtendedReport;
			const dlrrExtendedReport = extendedReports[1] as DlrrExtendedReport;

			expect(isAtOffset(packet1, buffer, 0)).toBe(true);
			expect(packet1.getLength()).toBe(8);
			expect(packet1.getSsrcs()).toEqual([1111]);

			expect(isAtOffset(packet2, buffer, 8)).toBe(true);
			expect(packet2.getLength()).toBe(36);
			expect(packet2.getSsrc()).toBe(0x12345678);
			expect(extendedReports.length).toBe(2);

			expect(isAtOffset(rrtExtendedReport, buffer, 16)).toBe(true);
			expect(rrtExtendedReport.getLength()).toBe(12);
			expect(rrtExtendedReport.getBlockType()).toBe(
				ExtendedReportBlockType.RRT
			);
			expect(rrtExtendedReport.getNtp()).toEqual({
				seconds: 1111,
				fractions: 2222,
			});

			expect(isAtOffset(dlrrExtendedReport, buffer, 28)).toBe(true);
			expect(dlrrExtendedReport.getLength()).toBe(16);
			expect(dlrrExtendedReport.getBlockType()).toBe(
				ExtendedReportBlockType.DLRR
			);
			expect(dlrrExtendedReport.getSubBlocks()).toEqual([
				{
					ssrc: 3333,
					lastReceiverReport: 4444,
					delaySinceLastReceiverReport: 5555,
				},
			]);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// Bye Packet
			// V=2, P=0, SC=1, PT:203, Length: 1
			0b10000001, 0xcb, 0x00, 0x01,
			// SSRC 1: 1111
			0x00, 0x00, 0x04, 0x57,
			// XR Packet
			// V=2, P=0, Reserved=0, PT:207, Length: 8
			0b10000000, 0xcf, 0x00, 0x08,
			// SSRC: 0x12345678
			0x12, 0x34, 0x56, 0x78,
			// Extended Report block 1
			// BT: 4 (RRT), Reserved: 0, Block length: 2
			0x04, 0x00, 0x00, 0x02,
			// NTP timestamp, most significant word: 1111
			0x00, 0x00, 0x04, 0x57,
			// NTP timestamp, least significant word: 2222
			0x00, 0x00, 0x08, 0xae,
			// Extended Report block 2
			// BT: 5 (DLRR), Reserved: 0, Block length: 3
			0x05, 0x00, 0x00, 0x03,
			// SSRC: 3333
			0x00, 0x00, 0x0d, 0x05,
			// LRR: 4444
			0x00, 0x00, 0x11, 0x5c,
			// DLRR: 5555
			0x00, 0x00, 0x15, 0xb3,
		]);
		const compoundPacket = CompoundPacket.parse(buffer);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 44,
			packetsCount: 2,
		});

		checkPackets(compoundPacket, buffer);

		/* Serialize it. */

		compoundPacket.serialize(serializeBuffer);

		buffer.fill(0xff);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 44,
			packetsCount: 2,
		});

		checkPackets(compoundPacket, serializeBuffer);

		/* Clone it. */

		const clonedCompoundPacket = compoundPacket.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpCompoundPacket(clonedCompoundPacket, {
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 44,
			packetsCount: 2,
		});

		checkPackets(clonedCompoundPacket, cloneBuffer);
	});

	test('CompoundPacket.parse() with a Transport-wide CC packet, compoundPacket.serialize() and compoundPacket.clone() succeed', () => {
		function checkPackets(
			compoundPacket: CompoundPacket,
			buffer: Uint8Array
		): void {
			const packets = compoundPacket.getPackets();
			const packet1 = packets[0] as NackPacket;
			const packet2 = packets[1] as TransportWideCcPacket;

			expect(compoundPacket.getFirstPacketOfType(TransportWideCcPacket)).toBe(
				packet2
			);

			expect(isAtOffset(packet1, buffer, 0)).toBe(true);
			expect(packet1.getLength()).toBe(16);
			expect(packet1.getItems().length).toBe(1);
			expect(packet1.getItems()[0]!.pid).toBe(1000);

			expect(isAtOffset(packet2, buffer, 16)).toBe(true);
			expect(packet2.getLength()).toBe(24);
			expect(packet2.getPadding()).toBe(1);
			expect(packet2.getSenderSsrc()).toBe(0xfa17fa17);
			expect(packet2.getMediaSsrc()).toBe(1234);
			expect(packet2.getBaseSequenceNumber()).toBe(13);
			expect(packet2.getPacketStatusCount()).toBe(1);
			expect(packet2.getBaseTimeUs()).toBe(1076014080000);
			expect(packet2.hasDeltas()).toBe(true);
			expect(packet2.getReceivedRtpPackets()).toEqual([
				{ sequenceNumber: 13, deltaTicks: 228 },
			]);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// NACK Packet
			// V=2, P=0, FMT=1, PT:205, Length: 3
			0b10000001, 0xcd, 0x00, 0x03,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// PID: 1000, BLP: 0x0000
			0x03, 0xe8, 0x00, 0x00,
			// Transport-wide CC Packet
			// V=2, P=1, FMT=15, PT:205, Length: 5
			0xaf, 0xcd, 0x00, 0x05,
			// SSRC of packet sender: 0xfa17fa17
			0xfa, 0x17, 0xfa, 0x17,
			// SSRC of media source: 1234
			0x00, 0x00, 0x04, 0xd2,
			// Base sequence number: 13, Packet status count: 1
			0x00, 0x0d, 0x00, 0x01,
			// Reference time: 35504, Feedback packet count: 0
			0x00, 0x8a, 0xb0, 0x00,
			// Run Length Chunk: symbol 1, run length 1
			0x20, 0x01,
			// Receive delta: 228
			0xe4,
			// Padding: 1 byte
			0x01,
		]);
		const compoundPacket = CompoundPacket.parse(buffer);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 40,
			packetsCount: 2,
		});

		checkPackets(compoundPacket, buffer);

		/* Serialize it. */

		compoundPacket.serialize(serializeBuffer);

		buffer.fill(0xff);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 40,
			packetsCount: 2,
		});

		checkPackets(compoundPacket, serializeBuffer);

		/* Clone it. */

		const clonedCompoundPacket = compoundPacket.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpCompoundPacket(clonedCompoundPacket, {
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 40,
			packetsCount: 2,
		});

		checkPackets(clonedCompoundPacket, cloneBuffer);
	});

	test('CompoundPacket.parse() with a malformed Transport-wide CC packet fails', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// NACK Packet
			// V=2, P=0, FMT=1, PT:205, Length: 3
			0b10000001, 0xcd, 0x00, 0x03,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// PID: 1000, BLP: 0x0000
			0x03, 0xe8, 0x00, 0x00,
			// Transport-wide CC Packet whose packet chunks do not cover the packet
			// status count
			// V=2, P=0, FMT=15, PT:205, Length: 5
			0x8f, 0xcd, 0x00, 0x05,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// Base sequence number: 1, Packet status count: 20
			0x00, 0x01, 0x00, 0x14,
			// Reference time: 0, Feedback packet count: 0
			0x00, 0x00, 0x00, 0x00,
			// One Bit Status Vector Chunk: 14 x received
			0xbf, 0xff,
			// Run Length Chunk: symbol 0, run length 0
			0x00, 0x00,
		]);

		expect(() => CompoundPacket.parse(buffer)).toThrow(TypeError);
	});

	test('CompoundPacket.factory() using compoundPacket.addPacket() with a Transport-wide CC packet succeeds', () => {
		function checkPackets(
			compoundPacket: CompoundPacket,
			buffer: Uint8Array
		): void {
			const packet1 = compoundPacket.getPackets()[0] as TransportWideCcPacket;

			expect(isAtOffset(packet1, buffer, 0)).toBe(true);
			expect(packet1.getLength()).toBe(28);
			expect(packet1.getPadding()).toBe(3);
			expect(packet1.getSenderSsrc()).toBe(1111);
			expect(packet1.getMediaSsrc()).toBe(2222);
			expect(packet1.getBaseSequenceNumber()).toBe(1000);
			expect(packet1.getPacketStatusCount()).toBe(4);
			expect(packet1.getBaseTimeUs()).toBe(1000000000000);
			expect(packet1.getFeedbackPacketCount()).toBe(3);
			expect(packet1.getReceivedRtpPackets()).toEqual([
				{ sequenceNumber: 1000, deltaTicks: 4 },
				{ sequenceNumber: 1001, deltaTicks: 4 },
				{ sequenceNumber: 1003, deltaTicks: 4 },
			]);
		}

		const buffer = factoryBuffer.subarray(0, 1000);
		const compoundPacket = CompoundPacket.factory(buffer);

		// Transport-wide CC packet, length: 28 bytes (3 of them padding).
		const packet1 = TransportWideCcPacket.factory(
			factoryBuffer.subarray(1000, 2000),
			/* includeDeltas */ true
		);

		packet1.setSenderSsrc(1111);
		packet1.setMediaSsrc(2222);
		packet1.setFeedbackPacketCount(3);
		packet1.setBase(1000, 1000000000000);

		expect(packet1.addReceivedRtpPacket(1000, 1000000001000)).toBe(true);
		expect(packet1.addReceivedRtpPacket(1001, 1000000002000)).toBe(true);
		expect(packet1.addReceivedRtpPacket(1003, 1000000003000)).toBe(true);

		compoundPacket.addPacket(packet1);

		// NOTE: The stored packet is not the same than the given one since it is
		// internally cloned.
		expect(compoundPacket.getPackets()[0]).not.toBe(packet1);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: buffer,
			bufferLength: 1000,
			length: 28,
			packetsCount: 1,
		});

		checkPackets(compoundPacket, buffer);

		/* Parse it. */

		const parsedCompoundPacket = CompoundPacket.parse(
			compoundPacket.getBuffer()
		);

		checkRtcpCompoundPacket(parsedCompoundPacket, {
			buffer: buffer,
			bufferLength: 28,
			length: 28,
			packetsCount: 1,
		});

		checkPackets(parsedCompoundPacket, buffer);
	});

	test('CompoundPacket.factory() using compoundPacket.addPacket() succeeds', () => {
		function checkPackets(
			compoundPacket: CompoundPacket,
			buffer: Uint8Array
		): void {
			const packets = compoundPacket.getPackets();
			const packet1 = packets[0] as ByePacket;
			const packet2 = packets[1] as XrPacket;
			const rrtExtendedReport =
				packet2.getExtendedReports()[0] as RrtExtendedReport;

			expect(isAtOffset(packet1, buffer, 0)).toBe(true);
			expect(packet1.getLength()).toBe(12);
			expect(packet1.getSsrcs()).toEqual([1111]);
			expect(packet1.getReason()).toBe('foo');

			expect(isAtOffset(packet2, buffer, 12)).toBe(true);
			expect(packet2.getLength()).toBe(20);
			expect(packet2.getSsrc()).toBe(2222);
			expect(packet2.getExtendedReports().length).toBe(1);
			expect(isAtOffset(rrtExtendedReport, buffer, 20)).toBe(true);
			expect(rrtExtendedReport.getNtp()).toEqual({
				seconds: 3333,
				fractions: 4444,
			});
		}

		const buffer = factoryBuffer.subarray(0, 1000);
		const compoundPacket = CompoundPacket.factory(buffer);

		// BYE packet, length: 12 bytes.
		const packet1 = ByePacket.factory(factoryBuffer.subarray(1000, 2000));

		packet1.addSsrc(1111);
		packet1.setReason('foo');

		// XR packet with a RRT block, length: 20 bytes.
		const packet2 = XrPacket.factory(factoryBuffer.subarray(2000, 3000));

		packet2.setSsrc(2222);

		const rrtExtendedReport =
			packet2.buildExtendedReportInPlace(RrtExtendedReport);

		rrtExtendedReport.setNtp({ seconds: 3333, fractions: 4444 });
		rrtExtendedReport.consolidate();

		compoundPacket.addPacket(packet1);
		compoundPacket.addPacket(packet2);

		// NOTE: The stored packets are not the same than the given ones since they
		// are internally cloned.
		expect(compoundPacket.getPackets()[0]).not.toBe(packet1);
		expect(compoundPacket.getPackets()[1]).not.toBe(packet2);

		checkRtcpCompoundPacket(compoundPacket, {
			buffer: buffer,
			bufferLength: 1000,
			length: 32,
			packetsCount: 2,
		});

		checkPackets(compoundPacket, buffer);

		/* Parse it. */

		const parsedCompoundPacket = CompoundPacket.parse(
			compoundPacket.getBuffer()
		);

		checkRtcpCompoundPacket(parsedCompoundPacket, {
			buffer: buffer,
			bufferLength: 32,
			length: 32,
			packetsCount: 2,
		});

		checkPackets(parsedCompoundPacket, buffer);
	});

	test('compoundPacket.addPacket() throws and leaves the CompoundPacket as it was', () => {
		const compoundPacket = CompoundPacket.factory(
			factoryBuffer.subarray(0, 16)
		);

		// XR packet with a RRT block, length: 20 bytes, which exceeds the compound
		// packet buffer length.
		const packet1 = XrPacket.factory(factoryBuffer.subarray(1000, 2000));

		packet1.buildExtendedReportInPlace(RrtExtendedReport).consolidate();

		expect(packet1.getLength()).toBe(20);

		const originalBytes = factoryBuffer.slice(0, packet1.getLength());

		expect(() => compoundPacket.addPacket(packet1)).toThrow(TypeError);
		expect(compoundPacket.getLength()).toBe(0);
		expect(compoundPacket.getPackets()).toEqual([]);
		// Nothing was written into the compound packet buffer.
		expect(
			areBuffersEqual(
				factoryBuffer.subarray(0, originalBytes.byteLength),
				originalBytes
			)
		).toBe(true);

		// XR packet, length: 8 bytes, which fits in the compound packet buffer but
		// has an Extended Report block being built in place within it (so it
		// needs consolidation).
		const packet2 = XrPacket.factory(factoryBuffer.subarray(2000, 3000));
		const rrtExtendedReport =
			packet2.buildExtendedReportInPlace(RrtExtendedReport);

		expect(packet2.needsConsolidation()).toBe(true);
		expect(() => compoundPacket.addPacket(packet2)).toThrow(Error);
		expect(compoundPacket.getLength()).toBe(0);
		expect(compoundPacket.getPackets()).toEqual([]);

		rrtExtendedReport.discard();
	});

	test('compoundPacket.addPacket() throws if the packet lives where it would be cloned', () => {
		const compoundPacket = CompoundPacket.factory(
			factoryBuffer.subarray(0, 100)
		);
		// The packet lives in the free space of the buffer of the compound packet,
		// right where it would be cloned.
		const packet = PliPacket.factory(factoryBuffer.subarray(0, 12));

		expect(() => compoundPacket.addPacket(packet)).toThrow(TypeError);
		expect(compoundPacket.getLength()).toBe(0);
		expect(compoundPacket.getPackets()).toEqual([]);
	});

	test('compoundPacket.addPacket() throws if the buffer of the packet covers where it would be cloned', () => {
		// The packet would be cloned at [200, 212).
		const compoundPacket = CompoundPacket.factory(
			factoryBuffer.subarray(200, 1200)
		);
		// The bytes of the packet, [150, 162), don't overlap where it would be
		// cloned, but its buffer, [150, 2000), does.
		const packet = PliPacket.factory(factoryBuffer.subarray(150, 2000));

		expect(() => compoundPacket.addPacket(packet)).toThrow(TypeError);
		expect(compoundPacket.getLength()).toBe(0);
		expect(compoundPacket.getPackets()).toEqual([]);
	});

	test('compoundPacket.buildPacketInPlace() and compoundPacket.addPacket() throw if the CompoundPacket needs consolidation', () => {
		const compoundPacket = CompoundPacket.factory(
			factoryBuffer.subarray(0, 1000)
		);

		expect(compoundPacket.needsConsolidation()).toBe(false);

		const packet1 = compoundPacket.buildPacketInPlace(ByePacket);

		expect(compoundPacket.needsConsolidation()).toBe(true);

		// We didn't call packet1.consolidate() yet so this must throw.
		expect(() => compoundPacket.buildPacketInPlace(PliPacket)).toThrow(Error);

		const packet2 = PliPacket.factory(factoryBuffer.subarray(1000, 2000));

		// We didn't call packet1.consolidate() yet so this must throw.
		expect(() => compoundPacket.addPacket(packet2)).toThrow(Error);

		packet1.consolidate();

		expect(compoundPacket.needsConsolidation()).toBe(false);

		// This shouldn't throw now.
		compoundPacket.addPacket(packet2);

		expect(compoundPacket.needsConsolidation()).toBe(false);
		expect(compoundPacket.getLength()).toBe(16);
		expect(compoundPacket.getPackets().length).toBe(2);
	});

	test('CompoundPacket.factory() throws if the buffer is too small', () => {
		expect(() => CompoundPacket.factory(factoryBuffer.subarray(0, 3))).toThrow(
			TypeError
		);
	});
});
