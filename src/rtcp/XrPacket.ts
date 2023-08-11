import {
	RtcpPacket,
	RtcpPacketType,
	RtcpPacketDump,
	getRtcpLength,
	COMMON_HEADER_LENGTH
} from './RtcpPacket';
import { Serializable } from '../Serializable';
import { padTo4Bytes, assertUnreachable } from '../utils';
import { readBit, writeBit, readBits, writeBits } from '../bitOps';

/*
 * https://tools.ietf.org/html/rfc3611
 *
 *         0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * header |V=2|P|reserved |   PT=XR=207   |             length            |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *        |                              SSRC                             |
 *        +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * report :                         report blocks                         :
 * blocks +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 */

// Common RTCP header length + 4 (SSRC of packet sender).
const FIXED_HEADER_LENGTH = COMMON_HEADER_LENGTH + 4;

const EXTENDED_REPORT_COMMON_HEADER_LENGTH = 4;

/**
 * Extended Report types.
 */
// ESLint absurdly complains about "'ExtendedReportType' is already declared in
// the upper scope".
// eslint-disable-next-line no-shadow
export enum ExtendedReportType
{
	/**
	 * Loss RLE Report.
	 */
	LRLE = 1,
	/**
	 * Duplicate RLE Report.
	 */
	DRLE = 2,
	/**
	 * Packet Receipt Times Report.
	 */
	PRT = 3,
	/**
	 * Receiver Reference Time Report.
	 */
	RRT = 4,
	/**
	 * DLRR Report.
	 */
	DLRR = 5,
	/**
	 * Statistics Summary Report.
	 */
	SS = 6,
	/**
	 * VoIP Metrics Report.
	 */
	VM = 7
}

/**
 * RTCP XR packet info dump.
 */
export type XrPacketDump = RtcpPacketDump &
{
	ssrc: number;
	reports: ExtendedReportDump[];
};

/**
 * Extended Report dump.
 */
export type ExtendedReportDump =
{
	blockType: ExtendedReportType;
};

/**
 * Loss RLE Extended Report dump.
 */
export type ExtendedReportLRLEDump = ExtendedReportDump &
{
	thinning: number;
	ssrc: number;
	beginSeq: number;
	endSeq: number;
	chunks: number[];
};

/**
 * Unknown Extended Report dump.
 */
export type UnknownExtendedReportDump = ExtendedReportDump;

/**
 * Loss RLE and Duplicate RLE Extended Report chunk info.
 */
export type ExtendedReportChunk =
{
	/**
	 * Chunk type (Run Length Chunk, Bit Vector Chunk or Terminating Null Chunk).
	 */
	chunkType: 'run-length' | 'bit-vector' | 'terminating-null';
	/**
	 * Chunk run type (only set if `chunkType` is 'run-length').
	 */
	runType?: 'zeros' | 'ones';
	/**
	 * Chunk run length (only set if `chunkType` is 'run-length').
	 */
	runLength?: number;
	/**
	 * Chunk bit vector (only set if `chunkType` is 'bit-vector').
	 */
	bitVector?: number;
};

/**
 * Get the RTCP packet type.
 *
 * @hidden
 */
function getExtendedReportType(view: DataView): ExtendedReportType
{
	return view.getUint8(0);
}

/**
 * Read the block length value of an Extended Report and compute its size in
 * bytes (including first octet).
 *
 * @hidden
 */
function getExtendedReportLength(view: DataView): number
{
	// As per RFC 3611, this is the length of this Extended Report in 32-bit words
	// minus one, including the header and any padding.
	const length = view.getUint16(2);
	const byteLength = (length + 1) * 4;

	return byteLength;
}

/**
 * Writes given length (in bytes) in the block length field of an Extended
 * Report.
 *
 * @hidden
 */
function setExtendedReportLength(view: DataView, byteLength: number): void
{
	// Report byte length must be multiple of 4.
	if (byteLength % 4 !== 0)
	{
		throw new RangeError(
			`Extended Report byte length must be multiple of 4 but given byte length is ${byteLength} bytes`
		);
	}

	const length = (byteLength / 4) - 1;

	view.setUint16(2, length);
}

function blockTypeToString(blockType: ExtendedReportType): string
{
	switch (blockType)
	{
		case ExtendedReportType.LRLE:
		{
			return 'Loss RLE';
		}

		case ExtendedReportType.DRLE:
		{
			return 'Duplicate RLE';
		}

		case ExtendedReportType.PRT:
		{
			return 'Packet Receipt Times';
		}

		case ExtendedReportType.RRT:
		{
			return 'Receiver Reference Time';
		}

		case ExtendedReportType.DLRR:
		{
			return 'DLRR';
		}

		case ExtendedReportType.SS:
		{
			return 'Statistics Summary';
		}

		case ExtendedReportType.VM:
		{
			return 'VoIP Metrics';
		}

		default:
		{
			assertUnreachable(blockType);
		}
	}
}

/**
 * Parse given 2 bytes number as a Extended Report chunk.
 */
export function parseChunk(chunk: number): ExtendedReportChunk
{
	if (chunk < 0 || chunk > 0xFFFF)
	{
		throw new TypeError('invalid chunk value');
	}

	if (chunk === 0)
	{
		return { chunkType: 'terminating-null' };
	}
}

/**
 * Create a Run Length Chunk.
 */
export function createRunLengthChunk(
	runType: 'zeros' | 'ones',
	runLength: number
): void
{
	// TODO
}

/**
 * Create a Bit Vector Chunk.
 */
export function createBitVectorChunk(bitVector: number): void
{
	// TODO
}

/**
 * RTCP XR packet.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class XrPacket extends RtcpPacket
{
	// Extended Reports.
	#reports: ExtendedReport[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty RTCP XR packet
	 *   will be created.
	 *
	 * @throws
	 * - If given `view` does not contain a valid RTCP XR packet.
	 */
	constructor(view?: DataView)
	{
		super(RtcpPacketType.XR, view);

		if (!this.view)
		{
			this.view = new DataView(new ArrayBuffer(FIXED_HEADER_LENGTH));

			// Write version and packet type.
			this.writeCommonHeader();

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to Extended Reports.
		pos += FIXED_HEADER_LENGTH;

		let count = this.getCount();

		const reportsLength = this.view.byteLength - this.padding;

		while (count-- > 0 && pos < reportsLength)
		{
			const remainingView = new DataView(
				this.view.buffer,
				this.view.byteOffset + pos,
				reportsLength - pos
			);

			const blockType = getExtendedReportType(remainingView);
			const reportLength = getExtendedReportLength(remainingView);

			const reportView = new DataView(
				this.view.buffer,
				this.view.byteOffset + pos,
				reportLength
			);

			let report: ExtendedReport;

			switch (blockType)
			{
				case ExtendedReportType.LRLE:
				{
					report = new ExtendedReportLRLE(reportView);

					break;
				}

				// case ExtendedReportType.DRLE:
				// {
				// 	report = new ExtendedReportDRLE(reportView);

				// 	break;
				// }

				// case ExtendedReportType.PRT:
				// {
				// 	report = new ExtendedReportPRT(reportView);

				// 	break;
				// }

				// case ExtendedReportType.RRT:
				// {
				// 	report = new ExtendedReportRRT(reportView);

				// 	break;
				// }

				// case ExtendedReportType.DLRR:
				// {
				// 	report = new ExtendedReportDLRR(reportView);

				// 	break;
				// }

				// case ExtendedReportType.SS:
				// {
				// 	report = new ExtendedReportSS(reportView);

				// 	break;
				// }

				// case ExtendedReportType.VM:
				// {
				// 	report = new ExtendedReportVM(reportView);

				// 	break;
				// }

				default:
				{
					report = new UnknownExtendedReport(reportView);
				}
			}

			pos += reportLength;

			this.#reports.push(report);
		}

		if (this.#reports.length !== this.getCount())
		{
			throw new RangeError(
				`num of parsed Extended Reports (${this.#reports.length}) doesn't match RTCP count field ({${this.getCount()}})`
			);
		}

		pos += this.padding;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump XR packet info.
	 */
	dump(): XrPacketDump
	{
		return {
			...super.dump(),
			ssrc    : this.getSsrc(),
			reports : this.#reports.map((report) => report.dump())
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		if (!this.needsSerialization())
		{
			return this.view.byteLength;
		}

		const packetLength =
			FIXED_HEADER_LENGTH +
			this.#reports.reduce(
				(sum, report) => sum + report.getByteLength(),
				0
			) +
			this.padding;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	needsSerialization(): boolean
	{
		return (
			super.needsSerialization() ||
			this.#reports.some((report) => report.needsSerialization())
		);
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const view = super.serializeBase();
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to the fixed header fields after the common header.
		pos += COMMON_HEADER_LENGTH;

		// Copy the rest of the fixed header into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset + pos,
				FIXED_HEADER_LENGTH - COMMON_HEADER_LENGTH
			),
			pos
		);

		// Move to Reception Reports.
		pos += FIXED_HEADER_LENGTH - COMMON_HEADER_LENGTH;

		// Write Reception Reports.
		for (const report of this.#reports)
		{
			// Serialize the report into the current position.
			report.prependOnceListener('will-serialize', (length, cb) =>
			{
				cb(view.buffer, view.byteOffset + pos);

				pos += length;
			});

			report.serialize();
		}

		pos += this.padding;

		// Assert that current position is equal than new buffer length.
		if (pos !== view.byteLength)
		{
			throw new RangeError(
				`computed packet length (${pos} bytes) is different than the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Assert that RTCP header length field is correct.
		if (getRtcpLength(view) !== view.byteLength)
		{
			throw new RangeError(
				`length in the RTCP header (${getRtcpLength(view)} bytes) does not match the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): XrPacket
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new XrPacket(view);
	}

	/**
	 * Get sender SSRC.
	 */
	getSsrc(): number
	{
		return this.view.getUint32(4);
	}

	/**
	 * Set sender SSRC.
	 */
	setSsrc(ssrc: number)
	{
		this.view.setUint32(4, ssrc);
	}

	/**
	 * Get Extended Reports.
	 */
	getReports(): ExtendedReport[]
	{
		return Array.from(this.#reports);
	}

	/**
	 * Set Extended Reports.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	setReports(reports: ExtendedReport[]): void
	{
		this.#reports = Array.from(reports);

		// Update RTCP count.
		this.setCount(this.#reports.length);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add Extended Report.
	 *
	 * @remarks
	 * - Serialization is needed after calling this method.
	 */
	addReport(report: ExtendedReport): void
	{
		this.#reports.push(report);

		// Update RTCP count.
		this.setCount(this.#reports.length);

		this.setSerializationNeeded(true);
	}
}

/**
 * Parent class of all Extended Reports.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export abstract class ExtendedReport extends Serializable
{
	readonly #blockType: ExtendedReportType;

	protected constructor(blockType: ExtendedReportType, view?: DataView)
	{
		super(view);

		this.#blockType = blockType;

		if (this.view)
		{
			// Extended Report byte length must be multiple of 4.
			if (this.view.byteLength % 4 !== 0)
			{
				throw new RangeError(
					`Extended Report byte length must be multiple of 4 but given buffer view is ${this.view.byteLength} bytes`
				);
			}
			else if (getExtendedReportType(this.view) !== blockType)
			{
				throw new TypeError(`not a ${blockTypeToString(blockType)} Extended Report`);
			}
			else if (getExtendedReportLength(this.view) !== this.view.byteLength)
			{
				throw new RangeError(
					`length in the RTCP header (${getExtendedReportLength(this.view)} bytes) does not match view length (${this.view.byteLength} bytes)`
				);
			}
		}
	}

	/**
	 * Base Extended Report dump.
	 *
	 * @remarks
	 * - Read the info dump type of each Extended Report instead.
	 */
	dump(): ExtendedReportDump
	{
		return {
			blockType : this.#blockType
		};
	}

	/**
	 * Get the Extended Report block type.
	 */
	getBlockType(): ExtendedReportType
	{
		return this.view.getUint8(1);
	}

	protected writeCommonHeader(): void
	{
		this.setBlockType(this.#blockType);
	}

	/**
	 * Serialize base RTCP packet into a new buffer.
	 */
	protected serializeBase(): DataView
	{
		const blockLength = this.getByteLength();
		const { buffer, byteOffset } = this.getSerializationBuffer(blockLength);

		// Create new DataView with new buffer.
		const view = new DataView(buffer, byteOffset, blockLength);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Copy the common header into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset,
				EXTENDED_REPORT_COMMON_HEADER_LENGTH
			),
			0
		);

		// Update the block length field in the report header.
		setExtendedReportLength(view, blockLength);

		return view;
	}

	/**
	 * Set the Extended Report block type.
	 *
	 * @privateRemarks
	 * - This method is not public since users should not manipulate this field
	 *   directly.
	 */
	private setBlockType(blockType: ExtendedReportType): void
	{
		this.view.setUint8(1, blockType);
	}
}

/**
 * Loss RLE Extended Report.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class ExtendedReportLRLE extends ExtendedReport
{
	// Chunks (2 bytes numbers, unparsed).
	#chunks: number[] = [];

	/**
	 * @param view - If given it will be parsed. Otherwise an empty Loss RLE
	 *   Extended Report will be created.
	 */
	constructor(view?: DataView)
	{
		super(ExtendedReportType.LRLE, view);

		if (!this.view)
		{
			this.view = new DataView(
				new ArrayBuffer(EXTENDED_REPORT_COMMON_HEADER_LENGTH)
			);

			// Write block type.
			this.writeCommonHeader();

			return;
		}

		if (this.view.byteLength < EXTENDED_REPORT_COMMON_HEADER_LENGTH)
		{
			throw new TypeError('wrong byte length for a Loss RLE Extended Report');
		}
		else if (this.view.byteLength % 4 !== 0)
		{
			throw new RangeError(`Loss RLE Extended Report length must be multiple of 4 bytes but it is ${this.view.byteLength} bytes`);
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to chunks.
		pos += EXTENDED_REPORT_COMMON_HEADER_LENGTH + 4 + 2 + 2;

		while (pos < this.view.byteLength)
		{
			const chunk = this.view.getUint16(pos);

			if (chunk === 0)
			{
				break;
			}

			this.#chunks.push(chunk);

			pos += 2;
		}
	}

	/**
	 * Dump Loss RLE Extended Report info.
	 */
	dump(): ExtendedReportLRLEDump
	{
		return {
			...super.dump(),
			thinning : this.getThinning(),
			ssrc     : this.getSsrc(),
			beginSeq : this.getBeginSeq(),
			endSeq   : this.getEndSeq(),
			chunks   : Array.from(this.#chunks)
		};
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		// Header + SSRC + begin seq + end seq.
		let reportLength = EXTENDED_REPORT_COMMON_HEADER_LENGTH + 4 + 2 + 2;

		// Add chunks.
		reportLength += this.#chunks.length * 2;

		// The list of chunks must terminate in terminating null chunks, which
		// basically means padding them to 4 bytes.
		reportLength = padTo4Bytes(reportLength);

		return reportLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const view = super.serializeBase();

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to source of SSRC.
		pos += 4;

		// Copy the SSRC.
		view.setUint32(pos, this.getSsrc());

		// Move to being seq.
		pos += 4;

		// Copy being seq.
		view.setUint16(pos, this.getBeginSeq());

		// Move to end seq.
		pos += 2;

		// Copy being seq.
		view.setUint16(pos, this.getEndSeq());

		// Move to chunks.
		pos += 2;

		// Copy chunks.
		for (const chunk of this.#chunks)
		{
			view.setUint16(pos, chunk);

			++pos;
		}

		// NOTE: No need to care about chunk padding since the obtained buffer
		// has the proper size (multiple of 4 bytes) and is filled with zeroes.

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): ExtendedReportLRLE
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new ExtendedReportLRLE(view);
	}

	/**
	 * Get thinning.
	 */
	getThinning(): number
	{
		return readBits({ view: this.view, byte: 1, mask: 0x0F0 });
	}

	/**
	 * Set thinning.
	 */
	setThinning(thinning: number): void
	{
		writeBits({ view: this.view, byte: 1, mask: 0x0F0, value: thinning });

		this.setSerializationNeeded(true);
	}

	/**
	 * Get SSRC of source.
	 */
	getSsrc(): number
	{
		return this.view.getUint32(4);
	}

	/**
	 * Set SSRC of source.
	 */
	setSsrc(ssrc: number): void
	{
		this.view.setUint32(4, ssrc);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get begin sequence number.
	 */
	getBeginSeq(): number
	{
		return this.view.getUint16(8);
	}

	/**
	 * Set begin sequence number.
	 */
	setBeginSeq(seq: number): void
	{
		this.view.setUint16(8, seq);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get end sequence number.
	 */
	getEndSeq(): number
	{
		return this.view.getUint16(10);
	}

	/**
	 * Set end sequence number.
	 */
	setEndSeq(seq: number): void
	{
		this.view.setUint16(10, seq);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get chunks.
	 *
	 * @remarmks
	 * - Chunks are given as a list of 2 byte integers.
	 * - Use {@link parseChunk} to parse them.
	 */
	getChunks(): number[]
	{
		return Array.from(this.#chunks);
	}

	/**
	 * Set chunks.
	 *
	 * @remarmks
	 * - Chunks must be given as a list of 2 byte integers.
	 * - Use {@link createRunLengthChunk} or {@link createBitVectorChunk} to
	 *   create them.
	 */
	setChunks(chunks: number[]): void
	{
		this.#chunks = Array.from(chunks);

		this.setSerializationNeeded(true);
	}

	/**
	 * Add chunk.
	 *
	 * @remarmks
	 * - Chunk must be given as 2 byte integer.
	 * - Use {@link createRunLengthChunk} or {@link createBitVectorChunk} to
	 *   create it.
	 * - Given chunk cannot be a terminating null chunk (0 number).
	 */
	addChunk(chunk: number): void
	{
		if (chunk === 0)
		{
			throw new TypeError('cannot add terminating null chunks');
		}

		this.#chunks.push(chunk);

		this.setSerializationNeeded(true);
	}
}

/**
 * Loss RLE Extended Report.
 *
 * @emits will-serialize - {@link WillSerializeEvent}
 */
export class UnknownExtendedReport extends ExtendedReport
{
	// Buffer view holding the report body.
	#bodyView: DataView;

	/**
	 * @param view - If given it will be parsed. Otherwise an empty unknown
	 *   Extended Report will be created.
	 * @param blockType - If `view` is not given, this parameter must be given.
	 *
	 * @throws
	 * - If given `view` does not contain a valid unknown Extended Report.
	 */
	constructor(view?: DataView, blockType?: ExtendedReportType | number)
	{
		super(view ? getExtendedReportType(view) : blockType!, view);

		if (!view && !blockType)
		{
			throw new TypeError('view or blockType must be given');
		}

		if (!this.view)
		{
			this.view = new DataView(
				new ArrayBuffer(EXTENDED_REPORT_COMMON_HEADER_LENGTH)
			);

			// Write block type.
			this.writeCommonHeader();

			// Set empty body.
			this.#bodyView = new DataView(
				this.view.buffer,
				this.view.byteOffset + EXTENDED_REPORT_COMMON_HEADER_LENGTH,
				0
			);

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += EXTENDED_REPORT_COMMON_HEADER_LENGTH;

		// Get body.
		const bodyLength = this.view.byteLength - pos;

		this.#bodyView = new DataView(
			this.view.buffer,
			this.view.byteOffset + pos,
			bodyLength
		);

		pos += bodyLength;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength)
		{
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump unknown Extended Report info.
	 */
	dump(): UnknownExtendedReportDump
	{
		return super.dump();
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number
	{
		if (!this.needsSerialization())
		{
			return this.view.byteLength;
		}

		const packetLength =
			EXTENDED_REPORT_COMMON_HEADER_LENGTH +
			this.#bodyView.byteLength;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(): void
	{
		const view = super.serializeBase();
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += EXTENDED_REPORT_COMMON_HEADER_LENGTH;

		// Copy the body into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.#bodyView.buffer,
				this.#bodyView.byteOffset,
				this.#bodyView.byteLength
			),
			pos
		);

		// Create new body DataView.
		const bodyView = new DataView(
			view.buffer,
			view.byteOffset + pos,
			this.#bodyView.byteLength
		);

		pos += bodyView.byteLength;

		// Assert that RTCP header length field is correct.
		if (getRtcpLength(view) !== view.byteLength)
		{
			throw new RangeError(
				`length in the RTCP header (${getRtcpLength(view)} bytes) does not match the available buffer size (${view.byteLength} bytes)`
			);
		}

		// Update DataView.
		this.view = view;

		// Update body DataView.
		this.#bodyView = bodyView;

		this.setSerializationNeeded(false);
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer?: ArrayBuffer, byteOffset?: number): UnknownExtendedReport
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new UnknownExtendedReport(view);
	}

	/**
	 * Get the report body.
	 */
	getBody(): DataView
	{
		return this.#bodyView;
	}

	/**
	 * Set the reportpacket body.
	 */
	setBody(view: DataView): void
	{
		this.#bodyView = view;

		// Ensure body is padded to 4 bytes.
		if (view.byteLength % 4 !== 0)
		{
			throw new TypeError('body byte length must be multiple of 4 bytes');
		}

		this.setSerializationNeeded(true);
	}
}
