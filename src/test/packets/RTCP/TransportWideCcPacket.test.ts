import {
	TransportWideCcPacket,
	DELTA_TICK_US,
} from '../../../packets/RTCP/TransportWideCcPacket';
import { TransportLayerFeedbackMessageType } from '../../../packets/RTCP/AnyTransportLayerFeedbackPacket';
import { RtcpPacketType } from '../../../packets/RTCP/RtcpPacket';
import { areBuffersEqual, padTo4Bytes } from '../../../utils/buffers';
import { checkRtcpPacket, type ExpectedRtcpPacket } from './rtcpCommon';
import {
	factoryBuffer,
	serializeBuffer,
	cloneBuffer,
	resetBuffers,
} from '../../testHelpers';

beforeEach(resetBuffers);

// Length (in bytes) of the fixed header of the packet.
const HEADER_SIZE = 20;

// Length (in bytes) of a packet chunk.
const STATUS_CHUNK_SIZE = 2;

// Length (in bytes) of a small receive delta.
const SMALL_DELTA_SIZE = 1;

// Length (in bytes) of a large receive delta.
const LARGE_DELTA_SIZE = 2;

// Largest receive delta (in microseconds) that fits in a small receive delta.
const DELTA_LIMIT_US = 0xff * DELTA_TICK_US;

// The reference time is expressed in multiples of this (in microseconds).
const BASE_TIME_TICK_US = DELTA_TICK_US * (1 << 8);

// Period (in microseconds) after which the reference time wraps around.
const BASE_TIME_WRAP_PERIOD_US = BASE_TIME_TICK_US * 2 ** 24;

/**
 * Status of an RTP packet as given by forAllRtpPackets().
 */
type RtpPacketStatus = {
	/**
	 * Transport-wide sequence number.
	 */
	sequenceNumber: number;
	/**
	 * Receive time relative to the reference time, or `undefined` if not
	 * received.
	 */
	deltaSinceBaseUs: number | undefined;
};

/**
 * Received RTP packet given to the packet.
 */
type Input = {
	/**
	 * Transport-wide sequence number.
	 */
	sequenceNumber: number;
	/**
	 * Receive time (in microseconds).
	 */
	timestampUs: number;
};

function getRtpPacketStatuses(
	packet: TransportWideCcPacket
): RtpPacketStatus[] {
	const rtpPacketStatuses: RtpPacketStatus[] = [];

	packet.forAllRtpPackets((sequenceNumber, deltaSinceBaseUs) => {
		rtpPacketStatuses.push({ sequenceNumber, deltaSinceBaseUs });
	});

	return rtpPacketStatuses;
}

function getNumberOfLostRtpPackets(packet: TransportWideCcPacket): number {
	let numberOfLostRtpPackets = 0;

	for (const rtpPacketStatus of getRtpPacketStatuses(packet)) {
		if (rtpPacketStatus.deltaSinceBaseUs === undefined) {
			++numberOfLostRtpPackets;
		}
	}

	return numberOfLostRtpPackets;
}

// Generate receive timestamps for the given sequence numbers, each one being
// `defaultDeltaUs` after the previous sequence number.
function generateReceiveTimestamps(
	sequenceNumbers: number[],
	defaultDeltaUs: number
): number[] {
	expect(sequenceNumbers.length).toBeGreaterThan(0);

	let lastSequenceNumber = sequenceNumbers[0]!;
	let timeUs = 0;
	const timestampsUs: number[] = [];

	for (const sequenceNumber of sequenceNumbers) {
		if (sequenceNumber < lastSequenceNumber) {
			timeUs += 0x10000 * defaultDeltaUs;
		}

		lastSequenceNumber = sequenceNumber;

		timestampsUs.push(timeUs + lastSequenceNumber * defaultDeltaUs);
	}

	return timestampsUs;
}

// Build a packet with the given received RTP packets and check its length, its
// sequence numbers and its receive deltas, before and after parsing it.
function checkRtcpFeedbackPacket(
	receivedSequenceNumbers: number[],
	receivedTimestampsUs: number[],
	includeDeltas: boolean,
	expectedSize: number | undefined
): void {
	expect(receivedSequenceNumbers.length).toBeGreaterThan(0);
	expect(receivedSequenceNumbers.length).toBe(receivedTimestampsUs.length);

	const packet = TransportWideCcPacket.factory(factoryBuffer, includeDeltas);
	const expectedDeltasUs: number[] = [];

	packet.setBase(receivedSequenceNumbers[0]!, receivedTimestampsUs[0]!);

	expect(
		packet.addReceivedRtpPacket(
			receivedSequenceNumbers[0]!,
			receivedTimestampsUs[0]!
		)
	).toBe(true);

	// The first delta is not the difference between two receive times but a
	// compensation for the lower precision of the reference time, so it is the
	// opposite of what getBaseDeltaUs() returns for the first receive time.
	// NOTE: `0 - x` rather than `-x` to get 0 instead of -0 when x is 0.
	expectedDeltasUs.push(0 - packet.getBaseDeltaUs(receivedTimestampsUs[0]!));

	for (let idx = 1; idx < receivedSequenceNumbers.length; ++idx) {
		expect(
			packet.addReceivedRtpPacket(
				receivedSequenceNumbers[idx]!,
				receivedTimestampsUs[idx]!
			)
		).toBe(true);

		expectedDeltasUs.push(
			receivedTimestampsUs[idx]! - receivedTimestampsUs[idx - 1]!
		);
	}

	function verify(packetToVerify: TransportWideCcPacket): void {
		if (expectedSize !== undefined) {
			expect(packetToVerify.getLength()).toBe(padTo4Bytes(expectedSize));
		}

		const receivedRtpPackets = packetToVerify.getReceivedRtpPackets();

		expect(receivedRtpPackets.length).toBe(receivedSequenceNumbers.length);

		for (let idx = 0; idx < receivedRtpPackets.length; ++idx) {
			expect(receivedRtpPackets[idx]!.sequenceNumber).toBe(
				receivedSequenceNumbers[idx]
			);

			if (includeDeltas) {
				expect(receivedRtpPackets[idx]!.deltaTicks * DELTA_TICK_US).toBe(
					expectedDeltasUs[idx]
				);
			}
		}
	}

	verify(packet);

	const parsedPacket = TransportWideCcPacket.parse(packet.getBuffer());

	expect(parsedPacket.hasDeltas()).toBe(includeDeltas);

	verify(parsedPacket);
}

// Build a packet whose base is set with the first input (one sequence number
// after it) and with the rest of the inputs as received RTP packets.
function buildPacket(
	inputs: Input[],
	feedbackPacketCount: number,
	buffer: Uint8Array
): TransportWideCcPacket {
	expect(inputs.length).toBeGreaterThan(0);

	const packet = TransportWideCcPacket.factory(buffer, true);

	packet.setSenderSsrc(1111);
	packet.setMediaSsrc(2222);
	packet.setFeedbackPacketCount(feedbackPacketCount);
	packet.setBase(
		(inputs[0]!.sequenceNumber + 1) & 0xffff,
		inputs[0]!.timestampUs
	);

	for (let idx = 1; idx < inputs.length; ++idx) {
		const input = inputs[idx]!;

		expect(
			packet.addReceivedRtpPacket(input.sequenceNumber, input.timestampUs)
		).toBe(true);
	}

	return packet;
}

// Check that every input is reported with its receive time and that every
// sequence number between them is reported as not received.
function verifyInputs(inputs: Input[], packet: TransportWideCcPacket): void {
	expect(inputs.length).toBeGreaterThan(0);

	// The reference time only carries whole base time ticks and wraps around,
	// so the reconstructed times sit in a frame shifted a constant amount from
	// the given ones. The shift comes from the timestamp the base was set with,
	// which is the first input.
	const baseTimeTicks = Math.trunc(inputs[0]!.timestampUs / BASE_TIME_TICK_US);
	// NOTE: Not using `& 0xffffff` since it operates on 32 bits.
	const maskedBaseTimeTicks = ((baseTimeTicks % 2 ** 24) + 2 ** 24) % 2 ** 24;

	// The reference time is a 24 bits signed integer.
	const referenceTime =
		maskedBaseTimeTicks >= 2 ** 23
			? maskedBaseTimeTicks - 2 ** 24
			: maskedBaseTimeTicks;

	const frameOffsetUs =
		BASE_TIME_WRAP_PERIOD_US +
		(referenceTime - baseTimeTicks) * BASE_TIME_TICK_US;
	const rtpPacketStatuses = getRtpPacketStatuses(packet);

	let statusIdx = 0;
	let lastInput = inputs[0]!;

	for (let inputIdx = 1; inputIdx < inputs.length; ++inputIdx) {
		const input = inputs[inputIdx]!;
		const missingRtpPackets =
			(input.sequenceNumber - lastInput.sequenceNumber - 1) & 0xffff;

		// All missing RTP packets must be reported as not received.
		for (let idx = 0; idx < missingRtpPackets; ++idx) {
			expect(statusIdx).toBeLessThan(rtpPacketStatuses.length);

			const rtpPacketStatus = rtpPacketStatuses[statusIdx]!;

			expect(rtpPacketStatus.sequenceNumber).toBe(
				(lastInput.sequenceNumber + idx + 1) & 0xffff
			);
			expect(rtpPacketStatus.deltaSinceBaseUs).toBeUndefined();

			++statusIdx;
		}

		expect(statusIdx).toBeLessThan(rtpPacketStatuses.length);

		const rtpPacketStatus = rtpPacketStatuses[statusIdx]!;

		expect(rtpPacketStatus.sequenceNumber).toBe(input.sequenceNumber);
		// Receive deltas carry the receive times with no loss as long as the
		// given ones are multiples of a delta tick.
		expect(rtpPacketStatus.deltaSinceBaseUs).toBe(
			input.timestampUs + frameOffsetUs - packet.getBaseTimeUs()
		);

		++statusIdx;

		lastInput = input;
	}

	expect(statusIdx).toBe(rtpPacketStatuses.length);
}

// Check that the packet parses into one that tells the same and that is
// serialized into the same bytes.
function verifyParsedPacket(
	inputs: Input[],
	packet: TransportWideCcPacket
): void {
	const parsedPacket = TransportWideCcPacket.parse(packet.getBuffer());

	expect(parsedPacket.getBaseSequenceNumber()).toBe(
		packet.getBaseSequenceNumber()
	);
	expect(parsedPacket.getPacketStatusCount()).toBe(
		packet.getPacketStatusCount()
	);
	expect(parsedPacket.getFeedbackPacketCount()).toBe(
		packet.getFeedbackPacketCount()
	);
	expect(getNumberOfLostRtpPackets(parsedPacket)).toBe(
		getNumberOfLostRtpPackets(packet)
	);
	// The reference time survives the round trip, so a parsed packet tells the
	// very same receive times as the one it was serialized from.
	expect(parsedPacket.getBaseTimeUs()).toBe(packet.getBaseTimeUs());

	verifyInputs(inputs, parsedPacket);

	parsedPacket.serialize(serializeBuffer);

	expect(areBuffersEqual(parsedPacket.getBuffer(), packet.getBuffer())).toBe(
		true
	);
}

describe('RTCP Transport-wide CC Feedback Packet', () => {
	test('TransportWideCcPacket.parse() succeeds', () => {
		function checkFields(packet: TransportWideCcPacket): void {
			expect(packet.getMessageType()).toBe(
				TransportLayerFeedbackMessageType.TCC
			);
			expect(packet.getSenderSsrc()).toBe(0xfa17fa17);
			expect(packet.getMediaSsrc()).toBe(0x09faff67);
			expect(packet.getBaseSequenceNumber()).toBe(39);
			expect(packet.getPacketStatusCount()).toBe(13);
			expect(packet.getBaseTimeUs()).toBe(
				BASE_TIME_WRAP_PERIOD_US + 6275825 * BASE_TIME_TICK_US
			);
			expect(packet.getFeedbackPacketCount()).toBe(3);
			expect(packet.hasDeltas()).toBe(true);
			expect(packet.getReceivedRtpPackets()).toEqual([
				{ sequenceNumber: 39, deltaTicks: 16 },
				{ sequenceNumber: 40, deltaTicks: 0 },
				{ sequenceNumber: 41, deltaTicks: 0 },
				{ sequenceNumber: 42, deltaTicks: 0 },
				{ sequenceNumber: 43, deltaTicks: 0 },
				{ sequenceNumber: 44, deltaTicks: 0 },
				{ sequenceNumber: 45, deltaTicks: 0 },
				{ sequenceNumber: 49, deltaTicks: 28 },
				{ sequenceNumber: 50, deltaTicks: 4 },
				{ sequenceNumber: 51, deltaTicks: 0 },
			]);
		}

		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, FMT=15, PT:205, Length: 7
			0x8f, 0xcd, 0x00, 0x07,
			// SSRC of packet sender: 0xfa17fa17
			0xfa, 0x17, 0xfa, 0x17,
			// SSRC of media source: 0x09faff67
			0x09, 0xfa, 0xff, 0x67,
			// Base sequence number: 39, Packet status count: 13
			0x00, 0x27, 0x00, 0x0d,
			// Reference time: 6275825, Feedback packet count: 3
			0x5f, 0xc2, 0xf1, 0x03,
			// One Bit Status Vector Chunk: 1111111000111(0)
			0xbf, 0x8e,
			// Receive deltas: 16, 0, 0, 0, 0, 0, 0, 28, 4, 0
			0x10, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x1c, 0x04, 0x00,
		]);
		const packet = TransportWideCcPacket.parse(buffer);
		const expected: ExpectedRtcpPacket = {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 32,
			packetType: RtcpPacketType.RTPFB,
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

		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			0x8f, 0xcd, 0x00, 0x07,
			0xfa, 0x17, 0xfa, 0x17,
			0x09, 0xfa, 0xff, 0x67,
			0x00, 0x27, 0x00, 0x0d,
			0x5f, 0xc2, 0xf1, 0x03,
			0xbf, 0x8e, 0x10, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x1c, 0x04, 0x00,
		]);

		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);

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

	test('TransportWideCcPacket.parse() with padding succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
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
		const packet = TransportWideCcPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 24,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: true,
			padding: 1,
		});

		expect(packet.getSenderSsrc()).toBe(0xfa17fa17);
		expect(packet.getMediaSsrc()).toBe(1234);
		expect(packet.getBaseSequenceNumber()).toBe(13);
		expect(packet.getPacketStatusCount()).toBe(1);
		expect(packet.getBaseTimeUs()).toBe(1076014080000);
		expect(packet.getFeedbackPacketCount()).toBe(0);
		expect(packet.hasDeltas()).toBe(true);
		expect(packet.getReceivedRtpPackets()).toEqual([
			{ sequenceNumber: 13, deltaTicks: 228 },
		]);
	});

	test('TransportWideCcPacket.parse() with zero padding and P bit not set succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, FMT=15, PT:205, Length: 5
			0x8f, 0xcd, 0x00, 0x05,
			// SSRC of packet sender: 0
			0x00, 0x00, 0x00, 0x00,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Base sequence number: 0, Packet status count: 1
			0x00, 0x00, 0x00, 0x01,
			// Reference time: 0, Feedback packet count: 0
			0x00, 0x00, 0x00, 0x00,
			// Run Length Chunk: symbol 1, run length 1
			0x20, 0x01,
			// Receive delta: 0
			0x00,
			// Zero padding (P bit not set)
			0x00,
		]);
		const packet = TransportWideCcPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 24,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.hasDeltas()).toBe(true);
		expect(packet.getReceivedRtpPackets()).toEqual([
			{ sequenceNumber: 0, deltaTicks: 0 },
		]);
	});

	test('TransportWideCcPacket.parse() with more padding than needed succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, FMT=15, PT:205, Length: 6
			0xaf, 0xcd, 0x00, 0x06,
			// SSRC of packet sender: 0
			0x00, 0x00, 0x00, 0x00,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Base sequence number: 0, Packet status count: 1
			0x00, 0x00, 0x00, 0x01,
			// Reference time: 0, Feedback packet count: 0
			0x00, 0x00, 0x00, 0x00,
			// Run Length Chunk: symbol 1, run length 1
			0x20, 0x01,
			// Receive delta: 0
			0x00,
			// Padding: 5 bytes
			0x00,
			0x00, 0x00, 0x00, 0x05,
		]);
		const packet = TransportWideCcPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 28,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: true,
			padding: 5,
		});

		expect(packet.hasDeltas()).toBe(true);
		expect(packet.getReceivedRtpPackets()).toEqual([
			{ sequenceNumber: 0, deltaTicks: 0 },
		]);
	});

	test('TransportWideCcPacket.parse() without receive deltas succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=1, FMT=15, PT:205, Length: 5
			0xaf, 0xcd, 0x00, 0x05,
			// SSRC of packet sender: 0
			0x00, 0x00, 0x00, 0x00,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Base sequence number: 1, Packet status count: 13
			0x00, 0x01, 0x00, 0x0d,
			// Reference time: 0, Feedback packet count: 0
			0x00, 0x00, 0x00, 0x00,
			// One Bit Status Vector Chunk: 1100001111001(0)
			0xb0, 0xf2,
			// Padding: 2 bytes
			0x00, 0x02,
		]);
		const packet = TransportWideCcPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 24,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: true,
			padding: 2,
		});

		const receivedRtpPackets = packet.getReceivedRtpPackets();

		expect(packet.getBaseSequenceNumber()).toBe(1);
		expect(packet.getPacketStatusCount()).toBe(13);
		expect(packet.hasDeltas()).toBe(false);
		expect(
			receivedRtpPackets.map(
				receivedRtpPacket => receivedRtpPacket.sequenceNumber
			)
		).toEqual([1, 2, 7, 8, 9, 10, 13]);

		for (const receivedRtpPacket of receivedRtpPackets) {
			expect(receivedRtpPacket.deltaTicks).toBe(0);
		}
	});

	test('TransportWideCcPacket.parse() with no packet status succeeds', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			// V=2, P=0, FMT=15, PT:205, Length: 4
			0x8f, 0xcd, 0x00, 0x04,
			// SSRC of packet sender: 0xfa17fa17
			0xfa, 0x17, 0xfa, 0x17,
			// SSRC of media source: 0x09faff67
			0x09, 0xfa, 0xff, 0x67,
			// Base sequence number: 39, Packet status count: 0
			0x00, 0x27, 0x00, 0x00,
			// Reference time: -2, Feedback packet count: 1
			0xff, 0xff, 0xfe, 0x01,
		]);
		const packet = TransportWideCcPacket.parse(buffer);

		checkRtcpPacket(packet, {
			buffer: buffer,
			bufferLength: buffer.byteLength,
			length: 20,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: false,
			padding: 0,
		});

		expect(packet.getBaseSequenceNumber()).toBe(39);
		expect(packet.getPacketStatusCount()).toBe(0);
		// The Reference time field is a 24 bits signed integer.
		expect(packet.getBaseTimeUs()).toBe(
			BASE_TIME_WRAP_PERIOD_US + -2 * BASE_TIME_TICK_US
		);
		expect(packet.getFeedbackPacketCount()).toBe(1);
		expect(packet.getReceivedRtpPackets()).toEqual([]);
		expect(getRtpPacketStatuses(packet)).toEqual([]);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			0x8f, 0xcd, 0x00, 0x04,
			0xfa, 0x17, 0xfa, 0x17,
			0x09, 0xfa, 0xff, 0x67,
			0x00, 0x27, 0x00, 0x00,
			0xff, 0xff, 0xfe, 0x01,
		]);

		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);
	});

	test('TransportWideCcPacket.parse() fails', () => {
		// No space for the fixed header.
		// prettier-ignore
		const buffer1 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:205, Length: 3
			0x8f, 0xcd, 0x00, 0x03,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// Base sequence number: 1, Packet status count: 0
			0x00, 0x01, 0x00, 0x00,
		]);

		expect(() => TransportWideCcPacket.parse(buffer1)).toThrow(TypeError);

		// Packet chunks do not cover the packet status count.
		// prettier-ignore
		const buffer2 = new Uint8Array([
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

		expect(() => TransportWideCcPacket.parse(buffer2)).toThrow(TypeError);

		// Invalid delta size (reserved symbol 3) with receive deltas included.
		// prettier-ignore
		const buffer3 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:205, Length: 6
			0x8f, 0xcd, 0x00, 0x06,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// Base sequence number: 1, Packet status count: 1
			0x00, 0x01, 0x00, 0x01,
			// Reference time: 0, Feedback packet count: 0
			0x00, 0x00, 0x00, 0x00,
			// Two Bit Status Vector Chunk: symbol 3
			0xf0, 0x00,
			// 3 bytes for the receive delta
			0x01, 0x02,
			0x03, 0x00, 0x00, 0x00,
		]);

		expect(() => TransportWideCcPacket.parse(buffer3)).toThrow(TypeError);

		// Wrong message type (FMT 1, NACK).
		// prettier-ignore
		const buffer4 = new Uint8Array([
			// V=2, P=0, FMT=1, PT:205, Length: 4
			0x81, 0xcd, 0x00, 0x04,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// Base sequence number: 1, Packet status count: 0
			0x00, 0x01, 0x00, 0x00,
			// Reference time: 0, Feedback packet count: 0
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => TransportWideCcPacket.parse(buffer4)).toThrow(TypeError);

		// Wrong packet type (PT 206, PSFB).
		// prettier-ignore
		const buffer5 = new Uint8Array([
			// V=2, P=0, FMT=15, PT:206, Length: 4
			0x8f, 0xce, 0x00, 0x04,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// Base sequence number: 1, Packet status count: 0
			0x00, 0x01, 0x00, 0x00,
			// Reference time: 0, Feedback packet count: 0
			0x00, 0x00, 0x00, 0x00,
		]);

		expect(() => TransportWideCcPacket.parse(buffer5)).toThrow(TypeError);
	});

	test('TransportWideCcPacket.factory() succeeds', () => {
		function checkFields(packet: TransportWideCcPacket): void {
			expect(packet.getMessageType()).toBe(
				TransportLayerFeedbackMessageType.TCC
			);
			expect(packet.getSenderSsrc()).toBe(1111);
			expect(packet.getMediaSsrc()).toBe(2222);
			expect(packet.getBaseSequenceNumber()).toBe(1000);
			expect(packet.getPacketStatusCount()).toBe(4);
			expect(packet.getBaseTimeUs()).toBe(1000000000000);
			expect(packet.getFeedbackPacketCount()).toBe(3);
			expect(packet.hasDeltas()).toBe(true);
			expect(packet.getReceivedRtpPackets()).toEqual([
				{ sequenceNumber: 1000, deltaTicks: 4 },
				{ sequenceNumber: 1001, deltaTicks: 4 },
				{ sequenceNumber: 1003, deltaTicks: 4 },
			]);
		}

		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			// V=2, P=1, FMT=15, PT:205, Length: 6
			0xaf, 0xcd, 0x00, 0x06,
			// SSRC of packet sender: 1111
			0x00, 0x00, 0x04, 0x57,
			// SSRC of media source: 2222
			0x00, 0x00, 0x08, 0xae,
			// Base sequence number: 1000, Packet status count: 4
			0x03, 0xe8, 0x00, 0x04,
			// Reference time: -1152216, Feedback packet count: 3
			0xee, 0x6b, 0x28, 0x03,
			// Two Bit Status Vector Chunk: 1, 1, 0, 1
			0xd4, 0x40,
			// Receive deltas: 4, 4, 4
			0x04, 0x04,
			0x04,
			// Padding: 3 bytes
			0x00, 0x00, 0x03,
		]);

		// Dirty the buffer to check that factory() writes zeros in the header.
		factoryBuffer.fill(0xff);

		const packet = TransportWideCcPacket.factory(factoryBuffer, true);
		const expected: ExpectedRtcpPacket = {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 20,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: false,
			padding: 0,
		};

		checkRtcpPacket(packet, expected);

		expect(packet.getMessageType()).toBe(TransportLayerFeedbackMessageType.TCC);
		expect(packet.getSenderSsrc()).toBe(0);
		expect(packet.getMediaSsrc()).toBe(0);
		expect(packet.getBaseSequenceNumber()).toBe(0);
		expect(packet.getPacketStatusCount()).toBe(0);
		expect(packet.getBaseTimeUs()).toBe(BASE_TIME_WRAP_PERIOD_US);
		expect(packet.getFeedbackPacketCount()).toBe(0);
		expect(packet.hasDeltas()).toBe(true);
		expect(packet.getReceivedRtpPackets()).toEqual([]);

		/* Modify it. */

		packet.setSenderSsrc(1111);
		packet.setMediaSsrc(2222);
		packet.setFeedbackPacketCount(3);
		packet.setBase(1000, 1000000000000);

		expect(packet.addReceivedRtpPacket(1000, 1000000001000)).toBe(true);
		expect(packet.addReceivedRtpPacket(1001, 1000000002000)).toBe(true);
		expect(packet.addReceivedRtpPacket(1003, 1000000003000)).toBe(true);

		checkRtcpPacket(packet, {
			...expected,
			length: 28,
			hasPadding: true,
			padding: 3,
		});

		checkFields(packet);

		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);

		/* Parse it. */

		const parsedPacket = TransportWideCcPacket.parse(expectedBuffer);

		checkFields(parsedPacket);

		/* Serialize it. */

		packet.serialize(serializeBuffer);

		factoryBuffer.fill(0xff);

		checkRtcpPacket(packet, {
			...expected,
			buffer: serializeBuffer,
			bufferLength: serializeBuffer.byteLength,
			length: 28,
			hasPadding: true,
			padding: 3,
		});

		checkFields(packet);

		/* Clone it. */

		const clonedPacket = packet.clone(cloneBuffer);

		serializeBuffer.fill(0xff);

		checkRtcpPacket(clonedPacket, {
			...expected,
			buffer: cloneBuffer,
			bufferLength: cloneBuffer.byteLength,
			length: 28,
			hasPadding: true,
			padding: 3,
		});

		checkFields(clonedPacket);

		/* Keep adding RTP packets to the cloned packet. */

		expect(clonedPacket.addReceivedRtpPacket(1004, 1000000004000)).toBe(true);

		const receivedRtpPackets = clonedPacket.getReceivedRtpPackets();

		expect(clonedPacket.getLength()).toBe(28);
		expect(clonedPacket.getPadding()).toBe(2);
		expect(clonedPacket.getPacketStatusCount()).toBe(5);
		expect(receivedRtpPackets.length).toBe(4);
		expect(receivedRtpPackets[3]).toEqual({
			sequenceNumber: 1004,
			deltaTicks: 4,
		});
	});

	test('TransportWideCcPacket.factory() without receive deltas succeeds', () => {
		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			// V=2, P=1, FMT=15, PT:205, Length: 5
			0xaf, 0xcd, 0x00, 0x05,
			// SSRC of packet sender: 0
			0x00, 0x00, 0x00, 0x00,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Base sequence number: 1, Packet status count: 13
			0x00, 0x01, 0x00, 0x0d,
			// Reference time: 0, Feedback packet count: 0
			0x00, 0x00, 0x00, 0x00,
			// One Bit Status Vector Chunk: 1100001111001(0)
			0xb0, 0xf2,
			// Padding: 2 bytes
			0x00, 0x02,
		]);

		const packet = TransportWideCcPacket.factory(factoryBuffer, false);

		packet.setBase(1, 1000);

		expect(packet.addReceivedRtpPacket(1, 1000)).toBe(true);
		expect(packet.addReceivedRtpPacket(2, 2000)).toBe(true);
		expect(packet.addReceivedRtpPacket(7, 7000)).toBe(true);
		expect(packet.addReceivedRtpPacket(8, 8000)).toBe(true);
		expect(packet.addReceivedRtpPacket(9, 9000)).toBe(true);
		expect(packet.addReceivedRtpPacket(10, 10000)).toBe(true);
		expect(packet.addReceivedRtpPacket(13, 13000)).toBe(true);

		checkRtcpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 24,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: true,
			padding: 2,
		});

		expect(packet.hasDeltas()).toBe(false);
		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);
	});

	test('transportWideCcPacket.addReceivedRtpPacket() returns false if there is no space in the buffer', () => {
		const packet = TransportWideCcPacket.factory(
			factoryBuffer.subarray(0, 24),
			true
		);

		packet.setBase(0, 0);

		// 20 bytes of fixed header, 2 bytes of packet chunk and 1 byte of receive
		// delta, padded to 24 bytes.
		expect(packet.addReceivedRtpPacket(0, 0)).toBe(true);
		// 20 bytes of fixed header, 2 bytes of packet chunk and 2 bytes of receive
		// deltas.
		expect(packet.addReceivedRtpPacket(1, 0)).toBe(true);
		// It would need 28 bytes.
		expect(packet.addReceivedRtpPacket(2, 0)).toBe(false);

		expect(packet.getLength()).toBe(24);
		expect(packet.getPacketStatusCount()).toBe(2);
		expect(packet.getReceivedRtpPackets().length).toBe(2);
	});

	test('transportWideCcPacket.addReceivedRtpPacket() does not add missing RTP packets if the received one does not fit', () => {
		const packet = TransportWideCcPacket.factory(
			factoryBuffer.subarray(0, 24),
			true
		);

		packet.setBase(0, 0);

		// 20 bytes of fixed header, 2 bytes of packet chunk and 1 byte of receive
		// delta, padded to 24 bytes.
		expect(packet.addReceivedRtpPacket(0, 0)).toBe(true);

		const buffer = packet.getBuffer().slice();

		// The missing RTP packet fits in the last packet chunk, but the large
		// receive delta (300 ticks) does not fit.
		expect(packet.addReceivedRtpPacket(2, 300 * DELTA_TICK_US)).toBe(false);

		expect(packet.getLength()).toBe(24);
		expect(packet.getPacketStatusCount()).toBe(1);
		expect(areBuffersEqual(packet.getBuffer(), buffer)).toBe(true);

		// The packet keeps building from where it was.
		expect(packet.addReceivedRtpPacket(1, DELTA_TICK_US)).toBe(true);
		expect(packet.getPacketStatusCount()).toBe(2);
		expect(packet.getReceivedRtpPackets()).toEqual([
			{ sequenceNumber: 0, deltaTicks: 0 },
			{ sequenceNumber: 1, deltaTicks: 1 },
		]);
	});

	test('transportWideCcPacket.addReceivedRtpPacket() does not add missing RTP packets if the received one does not fit after inserting packet chunks', () => {
		const packet = TransportWideCcPacket.factory(
			factoryBuffer.subarray(0, 28),
			true
		);

		packet.setBase(0, 0);

		// 20 bytes of fixed header, 2 bytes of packet chunk and 1 byte of receive
		// delta, padded to 24 bytes.
		expect(packet.addReceivedRtpPacket(0, 0)).toBe(true);

		const buffer = packet.getBuffer().slice();

		// 23 missing RTP packets: 13 fill the last packet chunk (One Bit Status
		// Vector Chunk) and 10 go into a new Run Length Chunk, which moves the
		// receive delta. Then the large receive delta (300 ticks) needs another
		// packet chunk, which does not fit.
		expect(packet.addReceivedRtpPacket(24, 300 * DELTA_TICK_US)).toBe(false);

		expect(packet.getLength()).toBe(24);
		expect(packet.getPadding()).toBe(1);
		expect(packet.getPacketStatusCount()).toBe(1);
		expect(areBuffersEqual(packet.getBuffer(), buffer)).toBe(true);

		// The packet keeps building from where it was.
		expect(packet.addReceivedRtpPacket(1, DELTA_TICK_US)).toBe(true);
		expect(packet.getPacketStatusCount()).toBe(2);
		expect(packet.getReceivedRtpPackets()).toEqual([
			{ sequenceNumber: 0, deltaTicks: 0 },
			{ sequenceNumber: 1, deltaTicks: 1 },
		]);
	});

	test('TransportWideCcPacket.factory() throws if the buffer is too small', () => {
		expect(() =>
			TransportWideCcPacket.factory(factoryBuffer.subarray(0, 19), true)
		).toThrow(TypeError);
	});

	test('transportWideCcPacket.setBase() and transportWideCcPacket.addReceivedRtpPacket() throw if timestamps are not safe integers', () => {
		const packet = TransportWideCcPacket.factory(factoryBuffer, true);

		expect(() => packet.setBase(0, 2 ** 53)).toThrow(TypeError);
		expect(() => packet.setBase(0, -(2 ** 53))).toThrow(TypeError);

		packet.setBase(0, 0);

		expect(() => packet.addReceivedRtpPacket(0, 2 ** 53)).toThrow(TypeError);
		expect(() => packet.addReceivedRtpPacket(0, -(2 ** 53))).toThrow(TypeError);
		expect(packet.getPacketStatusCount()).toBe(0);
	});

	/* Feedback packets built from received RTP packets. */

	test('one bit vector', () => {
		const receivedSequenceNumbers = [1, 2, 7, 8, 9, 10, 13];

		checkRtcpFeedbackPacket(
			receivedSequenceNumbers,
			generateReceiveTimestamps(receivedSequenceNumbers, DELTA_TICK_US * 4),
			true,
			HEADER_SIZE +
				STATUS_CHUNK_SIZE +
				receivedSequenceNumbers.length * SMALL_DELTA_SIZE
		);
	});

	test('one bit vector without receive deltas', () => {
		const receivedSequenceNumbers = [1, 2, 7, 8, 9, 10, 13];

		checkRtcpFeedbackPacket(
			receivedSequenceNumbers,
			generateReceiveTimestamps(receivedSequenceNumbers, DELTA_TICK_US * 4),
			false,
			HEADER_SIZE + STATUS_CHUNK_SIZE
		);
	});

	test('full one bit vector', () => {
		const receivedSequenceNumbers = [1, 2, 7, 8, 9, 10, 13, 14];

		checkRtcpFeedbackPacket(
			receivedSequenceNumbers,
			generateReceiveTimestamps(receivedSequenceNumbers, DELTA_TICK_US * 4),
			true,
			HEADER_SIZE +
				STATUS_CHUNK_SIZE +
				receivedSequenceNumbers.length * SMALL_DELTA_SIZE
		);
	});

	test('one bit vector with wrap around of received sequence numbers', () => {
		const receivedSequenceNumbers = [0xfffd, 0xfffe, 0xffff, 0, 1, 2];

		checkRtcpFeedbackPacket(
			receivedSequenceNumbers,
			generateReceiveTimestamps(receivedSequenceNumbers, DELTA_TICK_US * 4),
			true,
			HEADER_SIZE +
				STATUS_CHUNK_SIZE +
				receivedSequenceNumbers.length * SMALL_DELTA_SIZE
		);
	});

	test('one bit vector with wrap around of missing sequence numbers', () => {
		const receivedSequenceNumbers = [0xfffd, 0xfffe, 1, 2];

		checkRtcpFeedbackPacket(
			receivedSequenceNumbers,
			generateReceiveTimestamps(receivedSequenceNumbers, DELTA_TICK_US * 4),
			true,
			HEADER_SIZE +
				STATUS_CHUNK_SIZE +
				receivedSequenceNumbers.length * SMALL_DELTA_SIZE
		);
	});

	test('two bit vector', () => {
		const receivedSequenceNumbers = [1, 2, 6, 7];

		checkRtcpFeedbackPacket(
			receivedSequenceNumbers,
			generateReceiveTimestamps(
				receivedSequenceNumbers,
				DELTA_LIMIT_US + DELTA_TICK_US
			),
			true,
			HEADER_SIZE +
				STATUS_CHUNK_SIZE +
				receivedSequenceNumbers.length * LARGE_DELTA_SIZE
		);
	});

	test('full two bit vector', () => {
		const receivedSequenceNumbers = [1, 2, 6, 7, 8];

		checkRtcpFeedbackPacket(
			receivedSequenceNumbers,
			generateReceiveTimestamps(
				receivedSequenceNumbers,
				DELTA_LIMIT_US + DELTA_TICK_US
			),
			true,
			HEADER_SIZE +
				2 * STATUS_CHUNK_SIZE +
				receivedSequenceNumbers.length * LARGE_DELTA_SIZE
		);
	});

	test('large and negative deltas', () => {
		checkRtcpFeedbackPacket(
			[1, 2, 6, 7, 8],
			[2000, 1000, 4000, 3000, 3000 + DELTA_TICK_US * (1 << 8)],
			true,
			HEADER_SIZE + STATUS_CHUNK_SIZE + 3 * LARGE_DELTA_SIZE + SMALL_DELTA_SIZE
		);
	});

	test('max run length', () => {
		// Expected chunks created:
		// - One Bit Status Vector Chunk (1 x received + 13 x not received).
		// - Run Length Chunk of max length for not received symbol.
		// - Run Length Chunk of length 1 for received symbol.
		const packetCount = (1 << 13) - 1 + 14;

		checkRtcpFeedbackPacket(
			[0, packetCount],
			[1000, 2000],
			true,
			HEADER_SIZE + 3 * STATUS_CHUNK_SIZE + 2 * SMALL_DELTA_SIZE
		);
	});

	test('min run length', () => {
		// Expected chunks created:
		// - One Bit Status Vector Chunk (1 x received + 13 x not received).
		// - Run Length Chunk of length 15 for not received symbol.
		// - Run Length Chunk of length 1 for received symbol.
		checkRtcpFeedbackPacket(
			[0, 14 * 2 + 1],
			[1000, 2000],
			true,
			HEADER_SIZE + 3 * STATUS_CHUNK_SIZE + 2 * SMALL_DELTA_SIZE
		);
	});

	test('one bit vector to two bit vector', () => {
		const twoBitVectorCapacity = 7;

		checkRtcpFeedbackPacket(
			[0, twoBitVectorCapacity - 1],
			[0, DELTA_LIMIT_US + DELTA_TICK_US],
			true,
			HEADER_SIZE + STATUS_CHUNK_SIZE + SMALL_DELTA_SIZE + LARGE_DELTA_SIZE
		);
	});

	test('one bit vector to two bit vector, simple split', () => {
		const twoBitVectorCapacity = 7;

		checkRtcpFeedbackPacket(
			[0, twoBitVectorCapacity],
			[0, DELTA_LIMIT_US + DELTA_TICK_US],
			true,
			HEADER_SIZE + 2 * STATUS_CHUNK_SIZE + SMALL_DELTA_SIZE + LARGE_DELTA_SIZE
		);
	});

	test('one bit vector to two bit vector, split', () => {
		// With received small delta = S, received large delta = L, use input
		// SSSSSSSSLSSSSSSSSSSSS. This will cause a 1:2 split at the L. After the
		// split there will be two symbols in the symbol vector: SL.
		const largeDeltaUs = DELTA_TICK_US * (1 << 8);
		const numPackets = 3 * 7 + 1;
		const receivedSequenceNumbers: number[] = [];
		const receivedTimestampsUs: number[] = [];

		for (let idx = 0; idx < numPackets; ++idx) {
			receivedSequenceNumbers.push(idx);
		}

		receivedTimestampsUs.push(1000);

		for (let idx = 1; idx < numPackets; ++idx) {
			const deltaUs = idx === 8 ? largeDeltaUs : 1000;

			receivedTimestampsUs.push(receivedTimestampsUs.at(-1)! + deltaUs);
		}

		checkRtcpFeedbackPacket(
			receivedSequenceNumbers,
			receivedTimestampsUs,
			true,
			HEADER_SIZE +
				STATUS_CHUNK_SIZE * 3 +
				SMALL_DELTA_SIZE * (numPackets - 1) +
				LARGE_DELTA_SIZE
		);
	});

	test('large base time', () => {
		const timestampUs = 0x7fffffff * DELTA_TICK_US;

		checkRtcpFeedbackPacket([0], [timestampUs], true, undefined);
	});

	test('aliasing', () => {
		const samples = 100;
		const tooSmallDeltaUs = Math.trunc(DELTA_TICK_US / 3);
		const packet = TransportWideCcPacket.factory(factoryBuffer, true);

		packet.setBase(0, 0);

		for (let idx = 0; idx < samples; ++idx) {
			expect(packet.addReceivedRtpPacket(idx, idx * tooSmallDeltaUs)).toBe(
				true
			);
		}

		let accumulatedDeltaUs = 0;
		let numSamples = 0;

		for (const receivedRtpPacket of packet.getReceivedRtpPackets()) {
			accumulatedDeltaUs += receivedRtpPacket.deltaTicks * DELTA_TICK_US;

			const expectedTimeUs = numSamples * tooSmallDeltaUs;

			++numSamples;

			expect(Math.abs(accumulatedDeltaUs - expectedTimeUs)).toBeLessThanOrEqual(
				DELTA_TICK_US / 2
			);
		}

		expect(numSamples).toBe(samples);
	});

	test('limits', () => {
		// A sequence number exactly half the sequence number space after the last
		// added one is not considered higher than it.
		let packet = TransportWideCcPacket.factory(factoryBuffer, true);

		packet.setBase(0, 0);

		expect(packet.addReceivedRtpPacket(0x0, 0)).toBe(true);
		expect(packet.addReceivedRtpPacket(0x8000, 1000)).toBe(false);

		// Sequence number more than half the sequence number space after the last
		// added one.
		packet = TransportWideCcPacket.factory(factoryBuffer, true);

		packet.setBase(0, 0);

		expect(packet.addReceivedRtpPacket(0x0, 0)).toBe(true);
		expect(packet.addReceivedRtpPacket(0x8000 + 1, 1000)).toBe(false);

		// Packet status count max 0xffff. Each RTP packet is less than half the
		// sequence number space after the previous one.
		packet = TransportWideCcPacket.factory(factoryBuffer, true);

		packet.setBase(0, 0);

		expect(packet.addReceivedRtpPacket(0x0, 0)).toBe(true);
		expect(packet.addReceivedRtpPacket(0x7fff, 1000)).toBe(true);
		expect(packet.addReceivedRtpPacket(0xfffe, 2000)).toBe(true);
		expect(packet.addReceivedRtpPacket(0xffff, 3000)).toBe(false);

		// Too large delta.
		const maxPositiveTimeDeltaUs = 0x7fff * DELTA_TICK_US;

		packet = TransportWideCcPacket.factory(factoryBuffer, true);

		packet.setBase(0, 0);

		expect(
			packet.addReceivedRtpPacket(1, maxPositiveTimeDeltaUs + DELTA_TICK_US)
		).toBe(false);
		expect(packet.addReceivedRtpPacket(1, maxPositiveTimeDeltaUs)).toBe(true);

		// Too large negative delta.
		const maxNegativeTimeDeltaUs = -0x8000 * DELTA_TICK_US;

		// Use a larger base time to avoid the base time plus the negative delta to
		// be negative.
		const baseTimeUs = 1000000000000;

		packet = TransportWideCcPacket.factory(factoryBuffer, true);

		packet.setBase(0, baseTimeUs);

		expect(
			packet.addReceivedRtpPacket(
				1,
				baseTimeUs + maxNegativeTimeDeltaUs - DELTA_TICK_US
			)
		).toBe(false);
		expect(
			packet.addReceivedRtpPacket(1, baseTimeUs + maxNegativeTimeDeltaUs)
		).toBe(true);
	});

	test('base time is consistent across multiple packets', () => {
		const maxBaseTimeUs = BASE_TIME_WRAP_PERIOD_US - BASE_TIME_TICK_US;
		const packet1 = TransportWideCcPacket.factory(factoryBuffer, true);

		packet1.setBase(0, maxBaseTimeUs);

		expect(packet1.addReceivedRtpPacket(0, maxBaseTimeUs)).toBe(true);

		// Parse it to simulate sending it over the wire.
		const parsedPacket1 = TransportWideCcPacket.parse(packet1.getBuffer());
		const packet2 = TransportWideCcPacket.factory(serializeBuffer, true);

		packet2.setBase(1, maxBaseTimeUs + BASE_TIME_TICK_US);

		expect(
			packet2.addReceivedRtpPacket(1, maxBaseTimeUs + BASE_TIME_TICK_US)
		).toBe(true);

		const parsedPacket2 = TransportWideCcPacket.parse(packet2.getBuffer());

		expect(parsedPacket2.getBaseDeltaUs(parsedPacket1.getBaseTimeUs())).toBe(
			BASE_TIME_TICK_US
		);
	});

	test('supports maximum number of negative deltas', () => {
		const minDeltaUs = DELTA_TICK_US * -0x8000;
		// Buffer with space for the maximum packet length.
		const buffer = new Uint8Array((1 << 16) * 4);
		const packet = TransportWideCcPacket.factory(buffer, true);

		// Use a large base time to avoid hitting zero while filling the packet,
		// but a multiple of the wrap period so the Reference time field is 0.
		let timestampUs = 1000 * BASE_TIME_WRAP_PERIOD_US;
		// NOTE: It's an uint16 in the original test, so it wraps around.
		let numReceivedRtpPackets = 0;

		packet.setBase(0, timestampUs);

		timestampUs += minDeltaUs;

		while (
			packet.addReceivedRtpPacket(
				(numReceivedRtpPackets = (numReceivedRtpPackets + 1) & 0xffff),
				timestampUs
			)
		) {
			expect(timestampUs).toBeGreaterThanOrEqual(-minDeltaUs);

			timestampUs += minDeltaUs;
		}

		// Subtract the last RTP packet, which failed to be added.
		numReceivedRtpPackets = (numReceivedRtpPackets - 1) & 0xffff;

		const parsedPacket = TransportWideCcPacket.parse(packet.getBuffer());
		const receivedRtpPackets = parsedPacket.getReceivedRtpPackets();

		expect(receivedRtpPackets.length).toBe(numReceivedRtpPackets);

		for (const receivedRtpPacket of receivedRtpPackets) {
			expect(receivedRtpPacket.deltaTicks * DELTA_TICK_US).toBe(minDeltaUs);
		}

		expect(parsedPacket.getBaseTimeUs()).toBeGreaterThanOrEqual(
			-minDeltaUs * numReceivedRtpPackets
		);
	});

	test('padding', () => {
		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			// V=2, P=1, FMT=15, PT:205, Length: 5
			0xaf, 0xcd, 0x00, 0x05,
			// SSRC of packet sender: 0
			0x00, 0x00, 0x00, 0x00,
			// SSRC of media source: 0
			0x00, 0x00, 0x00, 0x00,
			// Base sequence number: 0, Packet status count: 1
			0x00, 0x00, 0x00, 0x01,
			// Reference time: 0, Feedback packet count: 0
			0x00, 0x00, 0x00, 0x00,
			// Run Length Chunk: symbol 1, run length 1
			0x20, 0x01,
			// Receive delta: 0
			0x00,
			// Padding: 1 byte
			0x01,
		]);

		const packet = TransportWideCcPacket.factory(factoryBuffer, true);

		packet.setBase(0, 0);

		expect(packet.addReceivedRtpPacket(0, 0)).toBe(true);

		checkRtcpPacket(packet, {
			buffer: factoryBuffer,
			bufferLength: factoryBuffer.byteLength,
			length: 24,
			packetType: RtcpPacketType.RTPFB,
			hasPadding: true,
			padding: 1,
		});

		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);
	});

	test('correctly splits vector chunks', () => {
		const oneBitVectorCapacity = 14;
		const largeTimeDeltaUs = DELTA_TICK_US * (1 << 8);

		// A number of small deltas followed by a large delta must result in a
		// correct split into multiple chunks.
		for (let deltas = 0; deltas <= oneBitVectorCapacity + 1; ++deltas) {
			const packet = TransportWideCcPacket.factory(factoryBuffer, true);

			packet.setBase(0, 0);

			for (let idx = 0; idx < deltas; ++idx) {
				expect(packet.addReceivedRtpPacket(idx, idx * 1000)).toBe(true);
			}

			expect(
				packet.addReceivedRtpPacket(deltas, deltas * 1000 + largeTimeDeltaUs)
			).toBe(true);

			const parsedPacket = TransportWideCcPacket.parse(packet.getBuffer());

			expect(parsedPacket.getReceivedRtpPackets().length).toBe(deltas + 1);
		}
	});

	test('cloned packet is equal to the original one', () => {
		const samples = 100;
		const baseSequenceNumber = 7531;
		const baseTimestampUs = 123456789;
		const feedbackPacketCount = 90;
		const packet = TransportWideCcPacket.factory(factoryBuffer, true);

		packet.setBase(baseSequenceNumber, baseTimestampUs);
		packet.setFeedbackPacketCount(feedbackPacketCount);

		for (let idx = 0; idx < samples; ++idx) {
			expect(
				packet.addReceivedRtpPacket(
					(baseSequenceNumber + idx) & 0xffff,
					baseTimestampUs + idx * DELTA_TICK_US
				)
			).toBe(true);
		}

		const clonedPacket = packet.clone(cloneBuffer);

		expect(areBuffersEqual(clonedPacket.getBuffer(), packet.getBuffer())).toBe(
			true
		);

		// Both packets keep building the same way.
		expect(
			packet.addReceivedRtpPacket(
				baseSequenceNumber + samples + 10,
				baseTimestampUs + 1000000
			)
		).toBe(true);
		expect(
			clonedPacket.addReceivedRtpPacket(
				baseSequenceNumber + samples + 10,
				baseTimestampUs + 1000000
			)
		).toBe(true);

		expect(areBuffersEqual(clonedPacket.getBuffer(), packet.getBuffer())).toBe(
			true
		);
	});

	test('reports missing RTP packets', () => {
		const baseSequenceNumber = 1000;
		const baseTimestampUs = 10000;
		const feedbackPacketCount = 90;
		const packet = TransportWideCcPacket.factory(factoryBuffer, true);

		packet.setBase(baseSequenceNumber, baseTimestampUs);
		packet.setFeedbackPacketCount(feedbackPacketCount);

		expect(
			packet.addReceivedRtpPacket(baseSequenceNumber + 0, baseTimestampUs)
		).toBe(true);
		// RTP packet losses indicated by a jump in the sequence number.
		expect(
			packet.addReceivedRtpPacket(
				baseSequenceNumber + 3,
				baseTimestampUs + 2000
			)
		).toBe(true);

		const parsedPacket = TransportWideCcPacket.parse(packet.getBuffer());
		const rtpPacketStatuses = getRtpPacketStatuses(parsedPacket);

		expect(rtpPacketStatuses.length).toBe(4);

		expect(rtpPacketStatuses[0]!.sequenceNumber).toBe(baseSequenceNumber + 0);
		expect(rtpPacketStatuses[0]!.deltaSinceBaseUs).toBeDefined();

		expect(rtpPacketStatuses[1]!.sequenceNumber).toBe(baseSequenceNumber + 1);
		expect(rtpPacketStatuses[1]!.deltaSinceBaseUs).toBeUndefined();

		expect(rtpPacketStatuses[2]!.sequenceNumber).toBe(baseSequenceNumber + 2);
		expect(rtpPacketStatuses[2]!.deltaSinceBaseUs).toBeUndefined();

		expect(rtpPacketStatuses[3]!.sequenceNumber).toBe(baseSequenceNumber + 3);
		expect(rtpPacketStatuses[3]!.deltaSinceBaseUs).toBeDefined();
	});

	test('reports missing RTP packets without receive deltas', () => {
		const baseSequenceNumber = 1000;
		const feedbackPacketCount = 90;
		const packet = TransportWideCcPacket.factory(factoryBuffer, false);

		packet.setBase(baseSequenceNumber, 10000);
		packet.setFeedbackPacketCount(feedbackPacketCount);

		expect(packet.addReceivedRtpPacket(baseSequenceNumber + 0, 0)).toBe(true);
		// RTP packet losses indicated by a jump in the sequence number.
		expect(packet.addReceivedRtpPacket(baseSequenceNumber + 3, 0)).toBe(true);

		const parsedPacket = TransportWideCcPacket.parse(packet.getBuffer());

		expect(parsedPacket.hasDeltas()).toBe(false);

		const rtpPacketStatuses = getRtpPacketStatuses(parsedPacket);

		expect(rtpPacketStatuses.length).toBe(4);

		expect(rtpPacketStatuses[0]!.sequenceNumber).toBe(baseSequenceNumber + 0);
		expect(rtpPacketStatuses[0]!.deltaSinceBaseUs).toBeDefined();

		expect(rtpPacketStatuses[1]!.sequenceNumber).toBe(baseSequenceNumber + 1);
		expect(rtpPacketStatuses[1]!.deltaSinceBaseUs).toBeUndefined();

		expect(rtpPacketStatuses[2]!.sequenceNumber).toBe(baseSequenceNumber + 2);
		expect(rtpPacketStatuses[2]!.deltaSinceBaseUs).toBeUndefined();

		expect(rtpPacketStatuses[3]!.sequenceNumber).toBe(baseSequenceNumber + 3);
		expect(rtpPacketStatuses[3]!.deltaSinceBaseUs).toBeDefined();
	});

	/* Feedback packets built from a list of inputs whose first one sets the base. */

	test('small delta run length chunk and single large delta status packet', () => {
		const inputs: Input[] = [
			{ sequenceNumber: 999, timestampUs: 1000000000000 }, // Pre base.
			{ sequenceNumber: 1000, timestampUs: 1000000000000 }, // Base.
			{ sequenceNumber: 1001, timestampUs: 1000000001000 },
			{ sequenceNumber: 1002, timestampUs: 1000000012000 },
			{ sequenceNumber: 1003, timestampUs: 1000000015000 },
			{ sequenceNumber: 1004, timestampUs: 1000000017000 },
			{ sequenceNumber: 1005, timestampUs: 1000000018000 },
			{ sequenceNumber: 1006, timestampUs: 1000000018000 },
			{ sequenceNumber: 1007, timestampUs: 1000000018000 },
			{ sequenceNumber: 1008, timestampUs: 1000000018000 },
			{ sequenceNumber: 1009, timestampUs: 1000000019000 },
			{ sequenceNumber: 1010, timestampUs: 1000000010000 },
			{ sequenceNumber: 1011, timestampUs: 1000000011000 },
			{ sequenceNumber: 1012, timestampUs: 1000000011000 },
			{ sequenceNumber: 1013, timestampUs: 1000000013000 },
			// Greater sequence number but older timestamp.
			{ sequenceNumber: 1014, timestampUs: 1000000013000 - 128000 },
			{ sequenceNumber: 1015, timestampUs: 1000000015000 },
		];

		const packet = buildPacket(inputs, 1, factoryBuffer);

		verifyInputs(inputs, packet);

		expect(packet.getBaseSequenceNumber()).toBe(1000);
		expect(packet.getPacketStatusCount()).toBe(16);
		expect(packet.getFeedbackPacketCount()).toBe(1);
		expect(getNumberOfLostRtpPackets(packet)).toBe(0);
		expect(packet.getReceivedRtpPackets().at(-1)!.sequenceNumber).toBe(1015);

		verifyParsedPacket(inputs, packet);
	});

	test('not received run length chunk and large delta', () => {
		const inputs: Input[] = [
			{ sequenceNumber: 999, timestampUs: 1000000000000 }, // Pre base.
			{ sequenceNumber: 1000, timestampUs: 1000000000000 }, // Base.
			{ sequenceNumber: 1050, timestampUs: 1000000216000 },
		];

		const packet = buildPacket(inputs, 10, factoryBuffer);

		verifyInputs(inputs, packet);

		expect(packet.getBaseSequenceNumber()).toBe(1000);
		expect(packet.getPacketStatusCount()).toBe(51);
		expect(packet.getFeedbackPacketCount()).toBe(10);
		expect(getNumberOfLostRtpPackets(packet)).toBeGreaterThan(0);
		expect(packet.getReceivedRtpPackets().at(-1)!.sequenceNumber).toBe(1050);

		verifyParsedPacket(inputs, packet);
	});

	test('mixed chunks', () => {
		const inputs: Input[] = [
			{ sequenceNumber: 999, timestampUs: 1000000000000 }, // Pre base.
			{ sequenceNumber: 1000, timestampUs: 1000000000000 }, // Base.
			{ sequenceNumber: 1001, timestampUs: 1000000100000 },
			{ sequenceNumber: 1002, timestampUs: 1000000200000 },
			{ sequenceNumber: 1015, timestampUs: 1000000300000 },
			{ sequenceNumber: 1016, timestampUs: 1000000400000 },
			{ sequenceNumber: 1017, timestampUs: 1000000500000 },
		];

		const packet = buildPacket(inputs, 1, factoryBuffer);

		verifyInputs(inputs, packet);

		expect(packet.getBaseSequenceNumber()).toBe(1000);
		expect(packet.getPacketStatusCount()).toBe(18);
		expect(packet.getFeedbackPacketCount()).toBe(1);
		expect(getNumberOfLostRtpPackets(packet)).toBeGreaterThan(0);
		expect(packet.getReceivedRtpPackets().at(-1)!.sequenceNumber).toBe(1017);

		verifyParsedPacket(inputs, packet);
	});

	test('incomplete two bit vector chunk', () => {
		const inputs: Input[] = [
			{ sequenceNumber: 999, timestampUs: 1000000000000 }, // Pre base.
			{ sequenceNumber: 1000, timestampUs: 1000000100000 }, // Base.
			{ sequenceNumber: 1001, timestampUs: 1000000700000 },
		];

		const packet = buildPacket(inputs, 1, factoryBuffer);

		verifyInputs(inputs, packet);

		expect(packet.getBaseSequenceNumber()).toBe(1000);
		expect(packet.getPacketStatusCount()).toBe(2);
		expect(packet.getFeedbackPacketCount()).toBe(1);
		expect(getNumberOfLostRtpPackets(packet)).toBe(0);
		expect(packet.getReceivedRtpPackets().at(-1)!.sequenceNumber).toBe(1001);

		verifyParsedPacket(inputs, packet);
	});

	test('two sequential packets', () => {
		const inputs: Input[] = [
			{ sequenceNumber: 999, timestampUs: 1000000000000 }, // Pre base.
			{ sequenceNumber: 1000, timestampUs: 1000000000000 }, // Base.
			{ sequenceNumber: 1001, timestampUs: 1000000003000 },
			{ sequenceNumber: 1002, timestampUs: 1000000003000 },
			{ sequenceNumber: 1003, timestampUs: 1000000003000 },
			{ sequenceNumber: 1004, timestampUs: 1000000004000 },
			{ sequenceNumber: 1005, timestampUs: 1000000005000 },
			{ sequenceNumber: 1006, timestampUs: 1000000005000 },
			{ sequenceNumber: 1007, timestampUs: 1000000007000 },
		];

		const packet = buildPacket(inputs, 1, factoryBuffer);

		verifyInputs(inputs, packet);

		expect(packet.getBaseSequenceNumber()).toBe(1000);
		expect(packet.getPacketStatusCount()).toBe(8);
		expect(packet.getFeedbackPacketCount()).toBe(1);
		expect(getNumberOfLostRtpPackets(packet)).toBe(0);
		expect(packet.getReceivedRtpPackets().at(-1)!.sequenceNumber).toBe(1007);

		verifyParsedPacket(inputs, packet);

		// The second packet starts right after the last RTP packet of the first
		// one.
		const inputs2: Input[] = [
			inputs.at(-1)!,
			{ sequenceNumber: 1008, timestampUs: 1000000008000 },
			{ sequenceNumber: 1009, timestampUs: 1000000009000 },
			{ sequenceNumber: 1010, timestampUs: 1000000010000 },
			{ sequenceNumber: 1011, timestampUs: 1000000010000 },
			{ sequenceNumber: 1012, timestampUs: 1000000010000 },
			{ sequenceNumber: 1013, timestampUs: 1000000014000 },
			{ sequenceNumber: 1014, timestampUs: 1000000014000 },
		];

		const packet2 = buildPacket(inputs2, 2, cloneBuffer);

		verifyInputs(inputs2, packet2);

		expect(packet2.getBaseSequenceNumber()).toBe(1008);
		expect(packet2.getPacketStatusCount()).toBe(7);
		expect(packet2.getFeedbackPacketCount()).toBe(2);
		expect(getNumberOfLostRtpPackets(packet2)).toBe(0);
		expect(packet2.getReceivedRtpPackets().at(-1)!.sequenceNumber).toBe(1014);

		verifyParsedPacket(inputs2, packet2);
	});

	test('parse packet generated by Chrome', () => {
		// prettier-ignore
		const buffer = new Uint8Array([
			0x8f, 0xcd, 0x00, 0x05,
			0xfa, 0x17, 0xfa, 0x17,
			0x39, 0xe9, 0x42, 0x38,
			0x00, 0x01, 0x00, 0x02,
			0xbd, 0x57, 0xaa, 0x00,
			0x20, 0x02, 0x8c, 0x44,
		]);
		const packet = TransportWideCcPacket.parse(buffer);

		expect(packet.getLength()).toBe(buffer.byteLength);
		expect(packet.getBaseSequenceNumber()).toBe(1);
		expect(packet.getPacketStatusCount()).toBe(2);
		// The Reference time field is a 24 bits signed integer.
		expect(packet.getBaseTimeUs()).toBe(
			BASE_TIME_WRAP_PERIOD_US + -4368470 * BASE_TIME_TICK_US
		);
		expect(packet.getFeedbackPacketCount()).toBe(0);

		packet.serialize(serializeBuffer);

		buffer.fill(0xff);

		// prettier-ignore
		const expectedBuffer = new Uint8Array([
			0x8f, 0xcd, 0x00, 0x05,
			0xfa, 0x17, 0xfa, 0x17,
			0x39, 0xe9, 0x42, 0x38,
			0x00, 0x01, 0x00, 0x02,
			0xbd, 0x57, 0xaa, 0x00,
			0x20, 0x02, 0x8c, 0x44,
		]);

		expect(areBuffersEqual(packet.getBuffer(), expectedBuffer)).toBe(true);
	});

	test('parse packets generated by Chrome with libwebrtc as a reference', () => {
		/**
		 * Values of a packet parsed with libwebrtc, and the packet.
		 */
		type FeedbackPacketMeta = {
			/**
			 * Reference time (in microseconds).
			 */
			baseTimeUs: number;
			/**
			 * Base sequence number.
			 */
			baseSequence: number;
			/**
			 * Packet status count.
			 */
			packetStatusCount: number;
			/**
			 * Receive deltas (in multiples of the delta tick).
			 */
			deltas: number[];
			/**
			 * Packet.
			 */
			buffer: number[];
		};

		// prettier-ignore
		const feedbackPacketsMeta: FeedbackPacketMeta[] = [
			{
				baseTimeUs: 1076014080000,
				baseSequence: 13,
				packetStatusCount: 1,
				deltas: [ 228 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x05, 0xfa, 0x17, 0xfa, 0x17,
				          0x00, 0x00, 0x04, 0xd2, 0x00, 0x0d, 0x00, 0x01,
				          0x00, 0x8a, 0xb0, 0x00, 0x20, 0x01, 0xe4, 0x01 ],
			},
			{
				baseTimeUs: 1076014080000,
				baseSequence: 14,
				packetStatusCount: 4,
				deltas: [ 232, 8, 12, 220 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x06, 0xfa, 0x17, 0xfa, 0x17, 0x1c, 0xb7,
				          0xda, 0xf3, 0x00, 0x0e, 0x00, 0x04, 0x00, 0x8a, 0xb0, 0x01,
				          0x20, 0x04, 0xe8, 0x08, 0x0c, 0xdc, 0x00, 0x02 ],
			},
			{
				baseTimeUs: 1076014144000,
				baseSequence: 18,
				packetStatusCount: 5,
				deltas: [ 240, 24, 20, 36, 88 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x06, 0xfa, 0x17, 0xfa, 0x17, 0x1c, 0xb7,
				          0xda, 0xf3, 0x00, 0x12, 0x00, 0x05, 0x00, 0x8a, 0xb1, 0x02,
				          0x20, 0x05, 0xf0, 0x18, 0x14, 0x24, 0x58, 0x01 ],
			},
			{
				baseTimeUs: 1113285696000,
				baseSequence: 2924,
				packetStatusCount: 22,
				deltas: [ 12, 20, 20, 0, 40, 0, 0, 16, 0, 4, 0,
				          8,  0,  8,  0, 8,  0, 8, 0,  4, 0, 16 ],
				buffer: [ 0x8f, 0xcd, 0x00, 0x0a, 0xfa, 0x17, 0xfa, 0x17, 0x06,
				          0xf5, 0x11, 0x4c, 0x0b, 0x6c, 0x00, 0x16, 0x09, 0x6d,
				          0x91, 0xee, 0x20, 0x16, 0x0c, 0x14, 0x14, 0x00, 0x28,
				          0x00, 0x00, 0x10, 0x00, 0x04, 0x00, 0x08, 0x00, 0x08,
				          0x00, 0x08, 0x00, 0x08, 0x00, 0x04, 0x00, 0x10 ],
			},
			{
				baseTimeUs: 794159744000,
				baseSequence: 1,
				packetStatusCount: 2,
				deltas: [ 140, 68 ],
				buffer: [ 0x8f, 0xcd, 0x00, 0x05, 0xfa, 0x17, 0xfa, 0x17,
				          0x39, 0xe9, 0x42, 0x38, 0x00, 0x01, 0x00, 0x02,
				          0xbd, 0x57, 0xaa, 0x00, 0x20, 0x02, 0x8c, 0x44 ],
			},
			{
				baseTimeUs: 1126157504000,
				baseSequence: 930,
				packetStatusCount: 5,
				deltas: [ 248, 72, 20, 24, 76 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x06, 0xfa, 0x17, 0xfa, 0x17, 0x26, 0x9e,
				          0x8e, 0x50, 0x03, 0xa2, 0x00, 0x05, 0x0c, 0x7f, 0x33, 0x9f,
				          0x20, 0x05, 0xf8, 0x48, 0x14, 0x18, 0x4c, 0x01 ],
			},
			{
				baseTimeUs: 1126157568000,
				baseSequence: 921,
				packetStatusCount: 7,
				deltas: [ 56, 20, 24, 24, 28, 56, 20 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x07, 0xfa, 0x17, 0xfa, 0x17, 0x33, 0xb0, 0x4a,
				          0xe8, 0x03, 0x99, 0x00, 0x07, 0x0c, 0x7f, 0x34, 0x9f, 0x20, 0x07,
				          0x38, 0x14, 0x18, 0x18, 0x1c, 0x38, 0x14, 0x00, 0x00, 0x03 ],
			},
			{
				baseTimeUs: 1126157568000,
				baseSequence: 935,
				packetStatusCount: 7,
				deltas: [ 228, 0, 24, 20, 20, 96, 0 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x07, 0xfa, 0x17, 0xfa, 0x17, 0x26, 0x9e, 0x8e,
				          0x50, 0x03, 0xa7, 0x00, 0x07, 0x0c, 0x7f, 0x34, 0xa0, 0x20, 0x07,
				          0xe4, 0x00, 0x18, 0x14, 0x14, 0x60, 0x00, 0x00, 0x00, 0x03 ],
			},
			{
				baseTimeUs: 1126157568000,
				baseSequence: 928,
				packetStatusCount: 5,
				deltas: [ 252, 44, 84, 24, 0 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x06, 0xfa, 0x17, 0xfa, 0x17, 0x33, 0xb0,
				          0x4a, 0xe8, 0x03, 0xa0, 0x00, 0x05, 0x0c, 0x7f, 0x34, 0xa0,
				          0x20, 0x05, 0xfc, 0x2c, 0x54, 0x18, 0x00, 0x01 ],
			},
			{
				baseTimeUs: 1126157632000,
				baseSequence: 942,
				packetStatusCount: 6,
				deltas: [ 156, 52, 36, 20, 16, 52 ],
				buffer: [ 0x8f, 0xcd, 0x00, 0x06, 0xfa, 0x17, 0xfa, 0x17, 0x26, 0x9e,
				          0x8e, 0x50, 0x03, 0xae, 0x00, 0x06, 0x0c, 0x7f, 0x35, 0xa1,
				          0x20, 0x06, 0x9c, 0x34, 0x24, 0x14, 0x10, 0x34 ],
			},
			{
				baseTimeUs: 1126319296000,
				baseSequence: 10,
				packetStatusCount: 7,
				deltas: [ 100, 8, 8, 12, 4, 4, 12 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x07, 0xfa, 0x17, 0xfa, 0x17, 0x00, 0x00, 0x04,
				          0xd2, 0x00, 0x0a, 0x00, 0x07, 0x0c, 0x89, 0x13, 0x00, 0x20, 0x07,
				          0x64, 0x08, 0x08, 0x0c, 0x04, 0x04, 0x0c, 0x00, 0x00, 0x03 ],
			},
			{
				baseTimeUs: 1126319360000,
				baseSequence: 17,
				packetStatusCount: 2,
				deltas: [ 176, 72 ],
				buffer: [ 0x8f, 0xcd, 0x00, 0x05, 0xfa, 0x17, 0xfa, 0x17,
				          0x08, 0xeb, 0x06, 0xd7, 0x00, 0x11, 0x00, 0x02,
				          0x0c, 0x89, 0x14, 0x01, 0x20, 0x02, 0xb0, 0x48 ],
			},
			{
				baseTimeUs: 1126319360000,
				baseSequence: 17,
				packetStatusCount: 1,
				deltas: [ 248 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x05, 0xfa, 0x17, 0xfa, 0x17,
				          0x20, 0x92, 0x5e, 0xb7, 0x00, 0x11, 0x00, 0x01,
				          0x0c, 0x89, 0x14, 0x00, 0x20, 0x01, 0xf8, 0x01 ],
			},
			{
				baseTimeUs: 1126319488000,
				baseSequence: 19,
				packetStatusCount: 4,
				deltas: [ 16, 0, 16, 0 ],
				buffer: [ 0xaf, 0xcd, 0x00, 0x06, 0xfa, 0x17, 0xfa, 0x17, 0x08, 0xeb,
				          0x06, 0xd7, 0x00, 0x13, 0x00, 0x04, 0x0c, 0x89, 0x16, 0x02,
				          0x20, 0x04, 0x10, 0x00, 0x10, 0x00, 0x00, 0x02 ],
			},
		];

		for (const feedbackPacketMeta of feedbackPacketsMeta) {
			const packet = TransportWideCcPacket.parse(
				new Uint8Array(feedbackPacketMeta.buffer)
			);

			expect(packet.getBaseTimeUs()).toBe(feedbackPacketMeta.baseTimeUs);
			expect(packet.getBaseSequenceNumber()).toBe(
				feedbackPacketMeta.baseSequence
			);
			expect(packet.getPacketStatusCount()).toBe(
				feedbackPacketMeta.packetStatusCount
			);

			const receivedRtpPackets = packet.getReceivedRtpPackets();

			expect(receivedRtpPackets.length).toBe(feedbackPacketMeta.deltas.length);

			for (let idx = 0; idx < feedbackPacketMeta.deltas.length; ++idx) {
				expect(receivedRtpPackets[idx]!.deltaTicks).toBe(
					feedbackPacketMeta.deltas[idx]
				);
			}
		}
	});

	test('transportWideCcPacket.getBaseDeltaUs() compensates the wrap around', () => {
		const maxBaseTimeUs = BASE_TIME_WRAP_PERIOD_US - BASE_TIME_TICK_US;
		const packet1 = TransportWideCcPacket.factory(factoryBuffer, true);
		const packet2 = TransportWideCcPacket.factory(serializeBuffer, true);
		const packet3 = TransportWideCcPacket.factory(cloneBuffer, true);

		packet1.setBase(0, maxBaseTimeUs);
		packet2.setBase(0, maxBaseTimeUs + BASE_TIME_TICK_US);
		packet3.setBase(0, maxBaseTimeUs + BASE_TIME_TICK_US + BASE_TIME_TICK_US);

		// Reference time fields are -1, 0 and 1.
		expect(packet1.getBaseTimeUs()).toBe(1073741760000);
		expect(packet2.getBaseTimeUs()).toBe(1073741824000);
		expect(packet3.getBaseTimeUs()).toBe(1073741888000);

		expect(packet1.getBaseDeltaUs(packet1.getBaseTimeUs())).toBe(0);
		expect(packet2.getBaseDeltaUs(packet1.getBaseTimeUs())).toBe(64000);
		expect(packet3.getBaseDeltaUs(packet2.getBaseTimeUs())).toBe(64000);
		expect(packet3.getBaseDeltaUs(packet1.getBaseTimeUs())).toBe(128000);
	});

	test('transportWideCcPacket.setBase() wraps the reference time over the whole period transportWideCcPacket.getBaseDeltaUs() compensates for', () => {
		// Timestamp sitting on the last whole base time tick before the reference
		// time wraps around.
		const lastTickUs = BASE_TIME_WRAP_PERIOD_US - BASE_TIME_TICK_US;
		const packet1 = TransportWideCcPacket.factory(factoryBuffer, true);
		const packet2 = TransportWideCcPacket.factory(serializeBuffer, true);

		packet1.setBase(1000, lastTickUs);
		packet2.setBase(1001, lastTickUs + BASE_TIME_TICK_US);

		// Reference time fields are -1 and 0.
		expect(packet1.getBaseTimeUs()).toBe(
			BASE_TIME_WRAP_PERIOD_US - BASE_TIME_TICK_US
		);
		expect(packet2.getBaseTimeUs()).toBe(BASE_TIME_WRAP_PERIOD_US);

		// Both packets are a single tick apart, so the wrap around must be
		// compensated. It would not be if the reference time wrapped sooner than
		// the period getBaseDeltaUs() knows about.
		expect(packet2.getBaseDeltaUs(packet1.getBaseTimeUs())).toBe(
			BASE_TIME_TICK_US
		);
	});
});
