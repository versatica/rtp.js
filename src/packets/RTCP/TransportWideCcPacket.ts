import {
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacketDump,
} from './RtcpPacket';
import {
	AnyTransportLayerFeedbackPacket,
	TransportLayerFeedbackMessageType,
} from './AnyTransportLayerFeedbackPacket';
import { isUnsignedInteger } from '../../utils/numbers';
import { padTo4Bytes } from '../../utils/buffers';
import {
	readSigned3BytesInDataView,
	write3BytesInDataView,
} from '../../utils/bytes';

/**
 * Receive deltas are expressed in multiples of this (in microseconds).
 *
 * @internal
 */
export const DELTA_TICK_US = 250;

/**
 * The reference time is expressed in multiples of this (in microseconds).
 */
const BASE_TIME_TICK_US = DELTA_TICK_US * (1 << 8);

/**
 * Period (in microseconds) after which the reference time wraps around.
 */
const TIME_WRAP_PERIOD_US = BASE_TIME_TICK_US * 2 ** 24;

/**
 * Maximum number of RTP packets a feedback packet can contain status for.
 */
const MAX_REPORTED_RTP_PACKETS = 0xffff;

/**
 * Length (in bytes) of the fixed header that precedes the packet chunks, RTCP
 * Common Header included.
 */
const TRANSPORT_WIDE_CC_HEADER_LENGTH = 20;

/**
 * Length (in bytes) of a packet chunk.
 */
const CHUNK_LENGTH = 2;

/**
 * Maximum length (in bytes) of the packet.
 */
const MAX_LENGTH = (1 << 16) * 4;

/**
 * Maximum number of RTP packet statuses in a Run Length Chunk.
 */
const MAX_RUN_LENGTH_CAPACITY = 0x1fff;

/**
 * Maximum number of RTP packet statuses in a One Bit Status Vector Chunk.
 */
const MAX_ONE_BIT_CAPACITY = 14;

/**
 * Maximum number of RTP packet statuses in a Two Bit Status Vector Chunk.
 */
const MAX_TWO_BIT_CAPACITY = 7;

/**
 * Maximum number of RTP packet statuses in a Status Vector Chunk.
 */
const MAX_VECTOR_CAPACITY = MAX_ONE_BIT_CAPACITY;

/**
 * Delta size of an RTP packet received with a large or negative delta.
 */
const LARGE_DELTA_SIZE = 2;

/**
 * Received RTP packet.
 */
export type ReceivedRtpPacket = {
	/**
	 * Transport-wide sequence number.
	 */
	sequenceNumber: number;
	/**
	 * Receive delta in multiples of 250 microseconds. It is 0 if the packet has
	 * no receive deltas.
	 */
	deltaTicks: number;
};

/**
 * RTCP Transport-wide Congestion Control packet info dump.
 */
export type TransportWideCcPacketDump = RtcpPacketDump & {
	/**
	 * Feedback message type.
	 */
	messageType: TransportLayerFeedbackMessageType;
	/**
	 * SSRC of the packet sender.
	 */
	senderSsrc: number;
	/**
	 * SSRC of the media source.
	 */
	mediaSsrc: number;
	/**
	 * Transport-wide sequence number of the first RTP packet in the feedback.
	 */
	baseSequenceNumber: number;
	/**
	 * Number of RTP packets the feedback contains status for.
	 */
	packetStatusCount: number;
	/**
	 * Reference time (in microseconds).
	 */
	baseTimeUs: number;
	/**
	 * Feedback packet count.
	 */
	feedbackPacketCount: number;
	/**
	 * Whether the packet includes receive deltas.
	 */
	hasDeltas: boolean;
	/**
	 * Received RTP packets.
	 */
	receivedRtpPackets: ReceivedRtpPacket[];
};

/**
 * Whether `lhs` is higher than `rhs` in the 16 bits sequence number space.
 */
function isSeqHigherThan(lhs: number, rhs: number): boolean {
	return (
		(lhs > rhs && lhs - rhs <= 0x7fff) || (rhs > lhs && rhs - lhs > 0x7fff)
	);
}

/**
 * Last packet chunk of the packet, which is the one where new RTP packet
 * statuses are added.
 *
 * Each RTP packet status is represented by its delta size: 0 (RTP packet not
 * received), 1 (RTP packet received, small delta) or 2 (RTP packet received,
 * large or negative delta).
 */
class LastChunk {
	readonly #deltaSizes = new Uint8Array(MAX_VECTOR_CAPACITY);
	#size = 0;
	#allSame = true;
	#hasLargeDelta = false;

	clone(): LastChunk {
		const clonedLastChunk = new LastChunk();

		clonedLastChunk.#deltaSizes.set(this.#deltaSizes);
		clonedLastChunk.#size = this.#size;
		clonedLastChunk.#allSame = this.#allSame;
		clonedLastChunk.#hasLargeDelta = this.#hasLargeDelta;

		return clonedLastChunk;
	}

	/**
	 * Make this last chunk equal to the given one without creating a new one.
	 */
	copyFrom(lastChunk: LastChunk): void {
		this.#deltaSizes.set(lastChunk.#deltaSizes);
		this.#size = lastChunk.#size;
		this.#allSame = lastChunk.#allSame;
		this.#hasLargeDelta = lastChunk.#hasLargeDelta;
	}

	isEmpty(): boolean {
		return this.#size === 0;
	}

	clear(): void {
		this.#size = 0;
		this.#allSame = true;
		this.#hasLargeDelta = false;
	}

	canAdd(deltaSize: number): boolean {
		if (this.#size < MAX_TWO_BIT_CAPACITY) {
			return true;
		}

		if (
			this.#size < MAX_ONE_BIT_CAPACITY &&
			!this.#hasLargeDelta &&
			deltaSize !== LARGE_DELTA_SIZE
		) {
			return true;
		}

		if (
			this.#size < MAX_RUN_LENGTH_CAPACITY &&
			this.#allSame &&
			this.#deltaSizes[0] === deltaSize
		) {
			return true;
		}

		return false;
	}

	add(deltaSize: number): void {
		if (this.#size < MAX_VECTOR_CAPACITY) {
			this.#deltaSizes[this.#size] = deltaSize;
		}

		++this.#size;

		this.#allSame = this.#allSame && deltaSize === this.#deltaSizes[0];
		this.#hasLargeDelta = this.#hasLargeDelta || deltaSize === LARGE_DELTA_SIZE;
	}

	addMissingRtpPackets(numMissing: number): void {
		this.#deltaSizes.fill(0);
		this.#size = numMissing;
	}

	/**
	 * Encode as many RTP packet statuses as fit in a packet chunk, remove them
	 * from this last chunk and return the encoded packet chunk.
	 */
	emit(): number {
		if (this.#allSame) {
			const chunk = this.#encodeRunLength();

			this.clear();

			return chunk;
		}

		if (this.#size === MAX_ONE_BIT_CAPACITY) {
			const chunk = this.#encodeOneBit();

			this.clear();

			return chunk;
		}

		const chunk = this.#encodeTwoBit(MAX_TWO_BIT_CAPACITY);

		// Remove MAX_TWO_BIT_CAPACITY encoded delta sizes. Shift remaining delta
		// sizes and recalculate allSame and hasLargeDelta.
		this.#size -= MAX_TWO_BIT_CAPACITY;
		this.#allSame = true;
		this.#hasLargeDelta = false;

		for (let idx = 0; idx < this.#size; ++idx) {
			const deltaSize = this.#deltaSizes[MAX_TWO_BIT_CAPACITY + idx]!;

			this.#deltaSizes[idx] = deltaSize;
			this.#allSame = this.#allSame && deltaSize === this.#deltaSizes[0];
			this.#hasLargeDelta =
				this.#hasLargeDelta || deltaSize === LARGE_DELTA_SIZE;
		}

		return chunk;
	}

	/**
	 * Encode all RTP packet statuses into a packet chunk without removing them
	 * from this last chunk.
	 */
	encodeLast(): number {
		if (this.#allSame) {
			return this.#encodeRunLength();
		}

		if (this.#size <= MAX_TWO_BIT_CAPACITY) {
			return this.#encodeTwoBit(this.#size);
		}

		return this.#encodeOneBit();
	}

	decode(chunk: number, maxSize: number): void {
		if ((chunk & 0x8000) === 0) {
			this.#decodeRunLength(chunk, maxSize);
		} else if ((chunk & 0x4000) === 0) {
			this.#decodeOneBit(chunk, maxSize);
		} else {
			this.#decodeTwoBit(chunk, maxSize);
		}
	}

	/**
	 * Write the delta sizes of the RTP packet statuses of this last chunk into
	 * `deltaSizes` starting at `offset`.
	 *
	 * @returns The offset after the last written delta size.
	 */
	appendTo(deltaSizes: Uint8Array, offset: number): number {
		if (this.#allSame) {
			deltaSizes.fill(this.#deltaSizes[0]!, offset, offset + this.#size);
		} else {
			deltaSizes.set(this.#deltaSizes.subarray(0, this.#size), offset);
		}

		return offset + this.#size;
	}

	/**
	 * One Bit Status Vector Chunk.
	 *
	 * ```text
	 *  0                   1
	 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5
	 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 * |T|S|       symbol list         |
	 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 * ```
	 *
	 * - T = 1.
	 * - S = 0.
	 * - Symbol list = 14 entries where 0 = not received, 1 = received with
	 *   1-byte delta.
	 */
	#encodeOneBit(): number {
		let chunk = 0x8000;

		for (let idx = 0; idx < this.#size; ++idx) {
			chunk |= this.#deltaSizes[idx]! << (MAX_ONE_BIT_CAPACITY - 1 - idx);
		}

		return chunk;
	}

	#decodeOneBit(chunk: number, maxSize: number): void {
		this.#size = Math.min(MAX_ONE_BIT_CAPACITY, maxSize);
		this.#hasLargeDelta = false;
		this.#allSame = false;

		for (let idx = 0; idx < this.#size; ++idx) {
			this.#deltaSizes[idx] =
				(chunk >> (MAX_ONE_BIT_CAPACITY - 1 - idx)) & 0x01;
		}
	}

	/**
	 * Two Bit Status Vector Chunk.
	 *
	 * ```text
	 *  0                   1
	 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5
	 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 * |T|S|       symbol list         |
	 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 * ```
	 *
	 * - T = 1.
	 * - S = 1.
	 * - Symbol list = 7 entries of two bits each.
	 */
	#encodeTwoBit(count: number): number {
		let chunk = 0xc000;

		for (let idx = 0; idx < count; ++idx) {
			chunk |= this.#deltaSizes[idx]! << (2 * (MAX_TWO_BIT_CAPACITY - 1 - idx));
		}

		return chunk;
	}

	#decodeTwoBit(chunk: number, maxSize: number): void {
		this.#size = Math.min(MAX_TWO_BIT_CAPACITY, maxSize);
		this.#hasLargeDelta = true;
		this.#allSame = false;

		for (let idx = 0; idx < this.#size; ++idx) {
			this.#deltaSizes[idx] =
				(chunk >> (2 * (MAX_TWO_BIT_CAPACITY - 1 - idx))) & 0x03;
		}
	}

	/**
	 * Run Length Chunk.
	 *
	 * ```text
	 *  0                   1
	 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5
	 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 * |T| S |       Run Length        |
	 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 * ```
	 *
	 * - T = 0.
	 * - S = symbol.
	 * - Run Length = Unsigned integer denoting the run length of the symbol.
	 */
	#encodeRunLength(): number {
		return (this.#deltaSizes[0]! << 13) | this.#size;
	}

	#decodeRunLength(chunk: number, maxSize: number): void {
		this.#size = Math.min(chunk & 0x1fff, maxSize);

		const deltaSize = (chunk >> 13) & 0x03;

		this.#hasLargeDelta = deltaSize >= LARGE_DELTA_SIZE;
		this.#allSame = true;

		// To make it consistent with add(), populate delta sizes beyond the first
		// one.
		this.#deltaSizes.fill(
			deltaSize,
			0,
			Math.min(this.#size, MAX_VECTOR_CAPACITY)
		);
	}
}

/**
 * RTCP Transport-wide Congestion Control (TWCC) feedback packet (RTPFB 205,
 * FMT 15).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|  FMT=15 |  PT=RTPFB=205 |             Length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                     SSRC of packet sender                     |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                      SSRC of media source                     |
 * +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 * |      base sequence number     |      packet status count      |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                 reference time                | fb pkt. count |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |          packet chunk         |         packet chunk          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |         packet chunk          |  recv delta   |  recv delta   |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * - Base sequence number (16 bits): The transport-wide sequence number of the
 *   first RTP packet in this feedback.
 * - Packet status count (16 bits): The number of RTP packets this feedback
 *   contains status for, starting with the RTP packet identified by the base
 *   sequence number.
 * - Reference time (24 bits): Signed integer indicating an absolute reference
 *   time in some (unknown) time base chosen by the sender of the feedback, in
 *   multiples of 64 ms.
 * - Feedback packet count (8 bits): A counter incremented by one for each
 *   feedback packet sent.
 * - Packet chunk (16 bits each): Run Length Chunk, One Bit Status Vector Chunk
 *   or Two Bit Status Vector Chunk, with the status of the RTP packets.
 * - Receive delta (8 or 16 bits each): For each received RTP packet, the delta
 *   to the previous received RTP packet (or to the reference time for the
 *   first one), in multiples of 250 us.
 *
 * @remarks
 * - Receive deltas may be omitted (when the media sender requests feedback
 *   without timing information). See {@link hasDeltas}.
 * - Every modification is applied in place within the buffer of the packet,
 *   so it's always serialized.
 *
 * @see
 * - [draft-holmer-rmcat-transport-wide-cc-extensions-01](https://datatracker.ietf.org/doc/html/draft-holmer-rmcat-transport-wide-cc-extensions-01)
 */
export class TransportWideCcPacket extends AnyTransportLayerFeedbackPacket {
	// Whether the packet includes receive deltas.
	#hasDeltas: boolean;
	// Length (in bytes) of the packet chunks in the buffer.
	#chunksLength = 0;
	// Length (in bytes) of the receive deltas in the buffer.
	#deltasLength = 0;
	// Time (in microseconds) of the last added RTP packet.
	#lastTimestampUs = 0;
	// Last packet chunk, also encoded in the buffer.
	#lastChunk = new LastChunk();
	// Copy of the last packet chunk to restore it if adding a received RTP
	// packet fails, kept to not create one on each addition.
	#savedLastChunk = new LastChunk();

	/**
	 * Parse a RTCP Transport-wide Congestion Control packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP Transport-wide
	 *   Congestion Control packet.
	 */
	static parse(buffer: Uint8Array): TransportWideCcPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new TransportWideCcPacket(buffer, false);

		packet.parseCommonHeader(RtcpPacketType.RTPFB);
		packet.#validate();

		return packet;
	}

	/**
	 * Create a RTCP Transport-wide Congestion Control packet with all fields set
	 * to 0 and no RTP packet statuses.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 * @param includeDeltas - Whether receive deltas are included in the packet.
	 *
	 * @remarks
	 * - {@link setBase} must be called before adding RTP packets with
	 *   {@link addReceivedRtpPacket}.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than 20 bytes.
	 */
	static factory(
		buffer: Uint8Array,
		includeDeltas: boolean
	): TransportWideCcPacket {
		const packet = new TransportWideCcPacket(buffer, includeDeltas);

		packet.initializeHeader(
			RtcpPacketType.RTPFB,
			TransportLayerFeedbackMessageType.TCC,
			TRANSPORT_WIDE_CC_HEADER_LENGTH
		);

		// Set SSRC of packet sender, SSRC of media source, base sequence number,
		// packet status count, reference time and feedback packet count to 0.
		buffer.fill(0, COMMON_HEADER_LENGTH, TRANSPORT_WIDE_CC_HEADER_LENGTH);

		return packet;
	}

	private constructor(buffer: Uint8Array, hasDeltas: boolean) {
		super(buffer);

		this.#hasDeltas = hasDeltas;
	}

	/**
	 * Dump RTCP Transport-wide Congestion Control packet info.
	 */
	override dump(): TransportWideCcPacketDump {
		return {
			...super.dump(),
			messageType: this.getMessageType(),
			senderSsrc: this.getSenderSsrc(),
			mediaSsrc: this.getMediaSsrc(),
			baseSequenceNumber: this.getBaseSequenceNumber(),
			packetStatusCount: this.getPacketStatusCount(),
			baseTimeUs: this.getBaseTimeUs(),
			feedbackPacketCount: this.getFeedbackPacketCount(),
			hasDeltas: this.#hasDeltas,
			receivedRtpPackets: this.getReceivedRtpPackets(),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): TransportWideCcPacket {
		const clonedPacket = new TransportWideCcPacket(buffer, this.#hasDeltas);

		this.cloneInto(clonedPacket);

		clonedPacket.#chunksLength = this.#chunksLength;
		clonedPacket.#deltasLength = this.#deltasLength;
		clonedPacket.#lastTimestampUs = this.#lastTimestampUs;
		clonedPacket.#lastChunk = this.#lastChunk.clone();

		return clonedPacket;
	}

	/**
	 * Whether the packet includes receive deltas.
	 */
	hasDeltas(): boolean {
		return this.#hasDeltas;
	}

	/**
	 * Get the value of the Base sequence number field.
	 */
	getBaseSequenceNumber(): number {
		return this.getView().getUint16(12);
	}

	/**
	 * Get the value of the Packet status count field.
	 */
	getPacketStatusCount(): number {
		return this.getView().getUint16(14);
	}

	/**
	 * Get the value of the Feedback packet count field.
	 */
	getFeedbackPacketCount(): number {
		return this.getView().getUint8(19);
	}

	/**
	 * Set the value of the Feedback packet count field.
	 *
	 * @throws
	 * - `TypeError` if `count` is not an integer between 0 and 255.
	 */
	setFeedbackPacketCount(count: number): void {
		if (!isUnsignedInteger(count, 0xff)) {
			throw new TypeError(
				`count (${count}) must be an integer between 0 and 255`
			);
		}

		this.getView().setUint8(19, count);
	}

	/**
	 * Set the base sequence number and the reference time.
	 *
	 * @param baseSequenceNumber - Transport-wide sequence number of the first
	 *   RTP packet in this feedback.
	 * @param referenceTimestampUs - Reference time (in microseconds).
	 *
	 * @throws
	 * - `TypeError` if `baseSequenceNumber` is not an integer between 0 and
	 *   65535 or if `referenceTimestampUs` is not a safe integer.
	 * - `Error` if RTP packets have already been added.
	 */
	setBase(baseSequenceNumber: number, referenceTimestampUs: number): void {
		if (!isUnsignedInteger(baseSequenceNumber, 0xffff)) {
			throw new TypeError(
				`baseSequenceNumber (${baseSequenceNumber}) must be an integer between 0 and 65535`
			);
		} else if (!Number.isSafeInteger(referenceTimestampUs)) {
			throw new TypeError(
				`referenceTimestampUs (${referenceTimestampUs}) must be a safe integer`
			);
		}

		if (this.getPacketStatusCount() !== 0) {
			throw new Error('cannot set base once RTP packets have been added');
		}

		const view = this.getView();

		view.setUint16(12, baseSequenceNumber);

		// NOTE: write3BytesInDataView() writes the lowest 24 bits, so a negative
		// value is written in two's complement.
		write3BytesInDataView(
			view,
			16,
			Math.trunc(
				(referenceTimestampUs % TIME_WRAP_PERIOD_US) / BASE_TIME_TICK_US
			)
		);

		this.#lastTimestampUs = this.getBaseTimeUs();
	}

	/**
	 * Add the status of a received RTP packet, and of the RTP packets not
	 * received since the last added one.
	 *
	 * @param sequenceNumber - Transport-wide sequence number of the received RTP
	 *   packet.
	 * @param timestampUs - Time (in microseconds) at which the RTP packet was
	 *   received.
	 *
	 * @returns `false` if the RTP packet cannot be added (its sequence number is
	 *   not higher than the last added one, its receive delta cannot be
	 *   represented or there is no space for it). In that case a new feedback
	 *   packet is needed.
	 *
	 * @throws
	 * - `TypeError` if `sequenceNumber` is not an integer between 0 and 65535
	 *   or if `timestampUs` is not a safe integer.
	 */
	addReceivedRtpPacket(sequenceNumber: number, timestampUs: number): boolean {
		if (!isUnsignedInteger(sequenceNumber, 0xffff)) {
			throw new TypeError(
				`sequenceNumber (${sequenceNumber}) must be an integer between 0 and 65535`
			);
		} else if (!Number.isSafeInteger(timestampUs)) {
			throw new TypeError(
				`timestampUs (${timestampUs}) must be a safe integer`
			);
		}

		// Set delta to zero if receive deltas are not included, this simplifies
		// the encoding process.
		let delta = 0;

		if (this.#hasDeltas) {
			let timestamp = timestampUs;

			// Convert to ticks and round.
			if (this.#lastTimestampUs > timestamp) {
				const diff = this.#lastTimestampUs - timestamp;

				// Round up to a multiple of the wrap period.
				timestamp +=
					Math.trunc((diff + TIME_WRAP_PERIOD_US - 1) / TIME_WRAP_PERIOD_US) *
					TIME_WRAP_PERIOD_US;
			}

			let deltaFull = (timestamp - this.#lastTimestampUs) % TIME_WRAP_PERIOD_US;

			if (deltaFull > TIME_WRAP_PERIOD_US / 2) {
				deltaFull -= TIME_WRAP_PERIOD_US;
				deltaFull -= DELTA_TICK_US / 2;
			} else {
				deltaFull += DELTA_TICK_US / 2;
			}

			deltaFull = Math.trunc(deltaFull / DELTA_TICK_US);

			// If larger than 16 bits signed, it cannot be represented, so a new
			// feedback packet is needed.
			if (deltaFull < -0x8000 || deltaFull > 0x7fff) {
				return false;
			}

			delta = deltaFull;
		}

		const deltaSize = delta >= 0 && delta <= 0xff ? 1 : 2;
		const nextSequenceNumber =
			(this.getBaseSequenceNumber() + this.getPacketStatusCount()) & 0xffff;

		if (sequenceNumber !== nextSequenceNumber) {
			const lastSequenceNumber = (nextSequenceNumber - 1) & 0xffff;

			if (!isSeqHigherThan(sequenceNumber, lastSequenceNumber)) {
				return false;
			}

			const numMissingRtpPackets =
				(sequenceNumber - nextSequenceNumber) & 0xffff;

			if (
				!this.#addMissingRtpPacketsAndDeltaSize(numMissingRtpPackets, deltaSize)
			) {
				return false;
			}
		} else if (!this.#addDeltaSize(deltaSize)) {
			return false;
		}

		if (this.#hasDeltas) {
			const view = this.getView();
			// The receive delta goes right after the last one.
			const pos =
				TRANSPORT_WIDE_CC_HEADER_LENGTH +
				this.#chunksLength +
				this.#deltasLength;

			if (deltaSize === 1) {
				view.setUint8(pos, delta);
			} else {
				view.setInt16(pos, delta);
			}

			this.#deltasLength += deltaSize;

			this.setBodyLength(
				TRANSPORT_WIDE_CC_HEADER_LENGTH -
					COMMON_HEADER_LENGTH +
					this.#chunksLength +
					this.#deltasLength
			);
		}

		this.#lastTimestampUs += delta * DELTA_TICK_US;

		return true;
	}

	/**
	 * Get the received RTP packets, in transport-wide sequence number order.
	 */
	getReceivedRtpPackets(): ReceivedRtpPacket[] {
		const receivedRtpPackets: ReceivedRtpPacket[] = [];

		this.#walkRtpPackets((sequenceNumber, deltaTicks) => {
			if (deltaTicks !== undefined) {
				receivedRtpPackets.push({ sequenceNumber, deltaTicks });
			}
		});

		return receivedRtpPackets;
	}

	/**
	 * Call the given `handler` for every RTP packet status in the packet, in
	 * transport-wide sequence number order, with the transport-wide sequence
	 * number and the receive time (in microseconds) relative to the reference
	 * time, or `undefined` if the RTP packet was not received.
	 *
	 * @remarks
	 * - No object is created per RTP packet status.
	 * - The `handler` must not modify the packet, since receive deltas are read
	 *   from the buffer while the packet is being walked.
	 */
	forAllRtpPackets(
		handler: (
			sequenceNumber: number,
			deltaSinceBaseUs: number | undefined
		) => void
	): void {
		let deltaSinceBaseUs = 0;

		this.#walkRtpPackets((sequenceNumber, deltaTicks) => {
			if (deltaTicks === undefined) {
				handler(sequenceNumber, undefined);

				return;
			}

			deltaSinceBaseUs += deltaTicks * DELTA_TICK_US;

			handler(sequenceNumber, deltaSinceBaseUs);
		});
	}

	/**
	 * Get the reference time (in microseconds).
	 *
	 * @remarks
	 * - It includes an extra wrap period so that RTP packets received earlier
	 *   than the reference time can be represented even if the value of the
	 *   Reference time field is 0.
	 */
	getBaseTimeUs(): number {
		// The Reference time field is a 24 bits signed integer.
		return (
			TIME_WRAP_PERIOD_US +
			readSigned3BytesInDataView(this.getView(), 16) * BASE_TIME_TICK_US
		);
	}

	/**
	 * Get the difference (in microseconds) between the reference time of this
	 * packet and the given `previousTimestampUs`, compensating for the wrap
	 * around of the Reference time field.
	 */
	getBaseDeltaUs(previousTimestampUs: number): number {
		let delta = this.getBaseTimeUs() - previousTimestampUs;

		// Compensate for wrap around.
		if (Math.abs(delta - TIME_WRAP_PERIOD_US) < Math.abs(delta)) {
			// Wrap backwards.
			delta -= TIME_WRAP_PERIOD_US;
		} else if (Math.abs(delta + TIME_WRAP_PERIOD_US) < Math.abs(delta)) {
			// Wrap forwards.
			delta += TIME_WRAP_PERIOD_US;
		}

		return delta;
	}

	#validate(): void {
		if (this.getMessageType() !== TransportLayerFeedbackMessageType.TCC) {
			throw new TypeError(
				'not a RTCP Transport-wide Congestion Control packet'
			);
		}

		const view = this.getView();
		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();

		if (contentLength < TRANSPORT_WIDE_CC_HEADER_LENGTH) {
			throw new TypeError(
				`packet length (${contentLength} bytes, excluding padding) is lower than ${TRANSPORT_WIDE_CC_HEADER_LENGTH} bytes`
			);
		}

		const packetStatusCount = this.getPacketStatusCount();
		const deltaSizes = new Uint8Array(packetStatusCount);
		const lastChunk = new LastChunk();
		let numDeltaSizes = 0;
		let pos = TRANSPORT_WIDE_CC_HEADER_LENGTH;

		while (numDeltaSizes < packetStatusCount) {
			if (pos + CHUNK_LENGTH > contentLength) {
				throw new TypeError('no space for packet chunks');
			}

			const chunk = view.getUint16(pos);

			pos += CHUNK_LENGTH;

			lastChunk.decode(chunk, packetStatusCount - numDeltaSizes);
			numDeltaSizes = lastChunk.appendTo(deltaSizes, numDeltaSizes);
		}

		const chunksLength = pos - TRANSPORT_WIDE_CC_HEADER_LENGTH;
		let deltasLength = 0;

		for (const deltaSize of deltaSizes) {
			deltasLength += deltaSize;
		}

		// Receive deltas are included if there is space for all of them.
		const hasDeltas = contentLength >= pos + deltasLength;
		let deltaTicksSum = 0;

		if (hasDeltas) {
			for (const deltaSize of deltaSizes) {
				switch (deltaSize) {
					case 0: {
						break;
					}

					case 1: {
						deltaTicksSum += view.getUint8(pos);
						pos += deltaSize;

						break;
					}

					case 2: {
						deltaTicksSum += view.getInt16(pos);
						pos += deltaSize;

						break;
					}

					default: {
						throw new TypeError(`invalid delta size ${deltaSize}`);
					}
				}
			}
		}

		this.#hasDeltas = hasDeltas;
		this.#chunksLength = chunksLength;
		this.#deltasLength = hasDeltas ? deltasLength : 0;
		this.#lastTimestampUs =
			this.getBaseTimeUs() + deltaTicksSum * DELTA_TICK_US;
		this.#lastChunk = lastChunk;
	}

	/**
	 * Call the given `handler` for every RTP packet status in the packet with
	 * its transport-wide sequence number and its receive delta (in ticks), or
	 * `undefined` if the RTP packet was not received.
	 */
	#walkRtpPackets(
		handler: (sequenceNumber: number, deltaTicks: number | undefined) => void
	): void {
		const view = this.getView();
		const deltaSizes = this.#decodeChunks();
		let sequenceNumber = this.getBaseSequenceNumber();
		// The receive deltas go right after the packet chunks.
		let pos = TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength;

		for (const deltaSize of deltaSizes) {
			if (deltaSize === 0) {
				handler(sequenceNumber, undefined);
			} else {
				let deltaTicks = 0;

				if (this.#hasDeltas) {
					deltaTicks =
						deltaSize === 1 ? view.getUint8(pos) : view.getInt16(pos);

					pos += deltaSize;
				}

				handler(sequenceNumber, deltaTicks);
			}

			sequenceNumber = (sequenceNumber + 1) & 0xffff;
		}
	}

	#setPacketStatusCount(count: number): void {
		this.getView().setUint16(14, count);
	}

	/**
	 * Decode the packet chunks into the delta size of each RTP packet status.
	 */
	#decodeChunks(): Uint8Array {
		const view = this.getView();
		const packetStatusCount = this.getPacketStatusCount();
		const deltaSizes = new Uint8Array(packetStatusCount);
		const decoder = new LastChunk();
		let numDeltaSizes = 0;
		let pos = TRANSPORT_WIDE_CC_HEADER_LENGTH;

		while (numDeltaSizes < packetStatusCount) {
			const chunk = view.getUint16(pos);

			pos += CHUNK_LENGTH;

			decoder.decode(chunk, packetStatusCount - numDeltaSizes);
			numDeltaSizes = decoder.appendTo(deltaSizes, numDeltaSizes);
		}

		return deltaSizes;
	}

	/**
	 * Whether a packet with given `contentLength` (excluding padding) fits in
	 * the maximum packet length and in the buffer.
	 */
	#hasSpaceFor(contentLength: number): boolean {
		return (
			contentLength <= MAX_LENGTH &&
			padTo4Bytes(contentLength) <= this.getBufferLength()
		);
	}

	/**
	 * Make room for `numberOfChunks` packet chunks right after the existing ones
	 * by moving the receive deltas forward, and update the length of the
	 * packet.
	 *
	 * @remarks
	 * - The new packet chunks are not written, the caller must write them.
	 * - The caller must check that there is space for them.
	 */
	#insertChunks(numberOfChunks: number): void {
		const insertedLength = numberOfChunks * CHUNK_LENGTH;
		const deltasPos = TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength;

		this.#chunksLength += insertedLength;

		// NOTE: The length of the packet is updated before moving the receive
		// deltas since getBuffer() only covers the current length. Padding bytes
		// (if any) are written after the moved receive deltas, so they don't
		// overwrite them.
		this.setBodyLength(
			TRANSPORT_WIDE_CC_HEADER_LENGTH -
				COMMON_HEADER_LENGTH +
				this.#chunksLength +
				this.#deltasLength
		);

		// Move the receive deltas forward.
		this.getBuffer().copyWithin(
			deltasPos + insertedLength,
			deltasPos,
			deltasPos + this.#deltasLength
		);
	}

	#addDeltaSize(deltaSize: number): boolean {
		const packetStatusCount = this.getPacketStatusCount();

		if (packetStatusCount === MAX_REPORTED_RTP_PACKETS) {
			return false;
		}

		const view = this.getView();
		const contentLength =
			TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength + this.#deltasLength;
		const addChunkLength = this.#lastChunk.isEmpty() ? CHUNK_LENGTH : 0;

		if (!this.#hasSpaceFor(contentLength + deltaSize + addChunkLength)) {
			return false;
		}

		if (this.#lastChunk.canAdd(deltaSize)) {
			// Open a slot for the last chunk if it was empty.
			if (addChunkLength > 0) {
				this.#insertChunks(1);
			}

			this.#lastChunk.add(deltaSize);

			view.setUint16(
				TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength - CHUNK_LENGTH,
				this.#lastChunk.encodeLast()
			);

			this.#setPacketStatusCount(packetStatusCount + 1);

			return true;
		}

		if (!this.#hasSpaceFor(contentLength + deltaSize + CHUNK_LENGTH)) {
			return false;
		}

		// The last chunk is full, so emit it into its slot and open a slot for a
		// new one.
		view.setUint16(
			TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength - CHUNK_LENGTH,
			this.#lastChunk.emit()
		);

		this.#insertChunks(1);
		this.#lastChunk.add(deltaSize);

		view.setUint16(
			TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength - CHUNK_LENGTH,
			this.#lastChunk.encodeLast()
		);

		this.#setPacketStatusCount(packetStatusCount + 1);

		return true;
	}

	#addMissingRtpPackets(numMissingRtpPackets: number): boolean {
		const newPacketStatusCount =
			this.getPacketStatusCount() + numMissingRtpPackets;

		if (newPacketStatusCount > MAX_REPORTED_RTP_PACKETS) {
			return false;
		}

		const view = this.getView();
		const contentLength =
			TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength + this.#deltasLength;
		let numMissing = numMissingRtpPackets;

		if (!this.#lastChunk.isEmpty()) {
			while (numMissing > 0 && this.#lastChunk.canAdd(0)) {
				this.#lastChunk.add(0);
				--numMissing;
			}

			if (numMissing === 0) {
				view.setUint16(
					TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength - CHUNK_LENGTH,
					this.#lastChunk.encodeLast()
				);

				this.#setPacketStatusCount(newPacketStatusCount);

				return true;
			}

			view.setUint16(
				TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength - CHUNK_LENGTH,
				this.#lastChunk.emit()
			);
		}

		const fullChunks = Math.floor(numMissing / MAX_RUN_LENGTH_CAPACITY);
		const partialChunk = numMissing % MAX_RUN_LENGTH_CAPACITY;
		const numChunks = fullChunks + (partialChunk > 0 ? 1 : 0);

		if (!this.#hasSpaceFor(contentLength + CHUNK_LENGTH * numChunks)) {
			this.#setPacketStatusCount(newPacketStatusCount - numMissing);

			return false;
		}

		// Position of the first new chunk.
		const pos = TRANSPORT_WIDE_CC_HEADER_LENGTH + this.#chunksLength;

		this.#insertChunks(numChunks);

		// T = 0, S = 0, run length = MAX_RUN_LENGTH_CAPACITY.
		for (let idx = 0; idx < fullChunks; ++idx) {
			view.setUint16(pos + idx * CHUNK_LENGTH, MAX_RUN_LENGTH_CAPACITY);
		}

		this.#lastChunk.addMissingRtpPackets(partialChunk);

		if (partialChunk > 0) {
			view.setUint16(
				pos + fullChunks * CHUNK_LENGTH,
				this.#lastChunk.encodeLast()
			);
		}

		this.#setPacketStatusCount(newPacketStatusCount);

		return true;
	}

	/**
	 * Add the status of `numMissingRtpPackets` RTP packets not received and the
	 * delta size of the received RTP packet that follows them. If any of them
	 * cannot be added, the packet is left as it was.
	 *
	 * @remarks
	 * - Missing RTP packets must not be reported without the received RTP
	 *   packet that follows them. Otherwise, when the received RTP packet does
	 *   not fit and goes into the next feedback packet, both feedback packets
	 *   would report them as not received.
	 */
	#addMissingRtpPacketsAndDeltaSize(
		numMissingRtpPackets: number,
		deltaSize: number
	): boolean {
		const view = this.getView();
		const packetStatusCount = this.getPacketStatusCount();
		const chunksLength = this.#chunksLength;
		const bodyLength = this.getBodyLength();
		// The last packet chunk is overwritten while adding.
		const lastChunkPos =
			TRANSPORT_WIDE_CC_HEADER_LENGTH + chunksLength - CHUNK_LENGTH;
		const lastChunkValue = chunksLength > 0 ? view.getUint16(lastChunkPos) : 0;

		this.#savedLastChunk.copyFrom(this.#lastChunk);

		if (
			this.#addMissingRtpPackets(numMissingRtpPackets) &&
			this.#addDeltaSize(deltaSize)
		) {
			return true;
		}

		// Remove the inserted packet chunks (if any).
		if (this.#chunksLength !== chunksLength) {
			const deltasPos = TRANSPORT_WIDE_CC_HEADER_LENGTH + chunksLength;
			const insertedLength = this.#chunksLength - chunksLength;

			// NOTE: The receive deltas are moved back before restoring the length of
			// the packet since getBuffer() only covers the current length.
			this.getBuffer().copyWithin(
				deltasPos,
				deltasPos + insertedLength,
				deltasPos + insertedLength + this.#deltasLength
			);

			this.#chunksLength = chunksLength;

			this.setBodyLength(bodyLength);
		}

		if (chunksLength > 0) {
			view.setUint16(lastChunkPos, lastChunkValue);
		}

		this.#setPacketStatusCount(packetStatusCount);
		this.#lastChunk.copyFrom(this.#savedLastChunk);

		return false;
	}
}
