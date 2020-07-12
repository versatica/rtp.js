import { Logger } from './Logger';

const RTP_VERSION = 2;
const FIXED_HEADER_LENGTH = 12;

export type RtpHeaderExtension =
{
	id: Buffer;
	value: Buffer;
}

const logger = new Logger('RtpPacket');

export class RtpPacket
{
	// Buffer.
	private buffer: Buffer;
	// RTP version.
	private readonly version: number = RTP_VERSION;
	// Payload type.
	private payloadType: number = 0;
	// Sequence number.
	private sequenceNumber: number = 0;
	// Timestamp.
	private timestamp: number = 0;
	// SSRC.
	private ssrc: number = 0;
	// CSRC.
	private csrc: number[] = [];
	// Marker flag.
	private marker: boolean = false;
	// Number of bytes of padding.
	private padding: number = 0;
	// Header extension.
	private headerExtension?: RtpHeaderExtension;
	// Payload.
	private payload?: Buffer;

	constructor(buffer: Buffer)
	{
		logger.debug('constructor()');

		this.buffer = buffer;
	}

	getVersion(): number
	{
		return this.version;
	}

	getPayloadType(): number
	{
		return this.payloadType;
	}

	setPayloadType(payloadType: number): void
	{
		this.payloadType = payloadType;
	}

	getSequenceNumber(): number
	{
		return this.sequenceNumber;
	}

	setSequenceNumber(sequenceNumber: number): void
	{
		this.sequenceNumber = sequenceNumber;
	}

	getTimestamp(): number
	{
		return this.timestamp;
	}

	setTimestamp(timestamp: number): void
	{
		this.timestamp = timestamp;
	}

	getSsrc(): number
	{
		return this.ssrc;
	}

	setSsrc(ssrc: number): void
	{
		this.ssrc = ssrc;
	}

	getCsrc(): number[]
	{
		return this.csrc;
	}

	setCsrc(csrc: number[]): void
	{
		this.csrc = csrc;
	}

	getMarker(): boolean
	{
		return this.marker;
	}

	setMarker(marker: boolean): void
	{
		this.marker = marker;
	}

	getPadding(): number
	{
		return this.padding;
	}

	setPadding(padding: number): void
	{
		this.padding = padding;
	}

	getHeaderExtension(): RtpHeaderExtension | undefined
	{
		return this.headerExtension;
	}

	setHeaderExtension(headerExtension?: RtpHeaderExtension): void
	{
		this.headerExtension = headerExtension;
	}

	getPayload(): Buffer | undefined
	{
		return this.payload;
	}

	setPayload(payload?: Buffer): void
	{
		this.payload = payload;
	}
}

export function isRtp(buffer: Buffer): boolean
{
	const firstByte: number = buffer.readUInt8(0);

	return (
		Buffer.isBuffer(buffer) &&
		buffer.length >= FIXED_HEADER_LENGTH &&
		// DOC: https://tools.ietf.org/html/draft-ietf-avtcore-rfc5764-mux-fixes
		(buffer[0] > 127 && buffer[0] < 192) &&
		// RTP Version must be 2.
		(firstByte >> 6) === RTP_VERSION
	);
}

export function parseRtp(buffer: Buffer): RtpPacket
{
	if (!isRtp(buffer))
	{
		throw new TypeError('not a valid RTP packeet');
	}

	const packet = new RtpPacket(buffer);
	const firstByte: number = buffer.readUInt8(0);
	const secondByte: number = buffer.readUInt8(1);
	let parsedLength = FIXED_HEADER_LENGTH;

	// Parse payload type.
	const payloadType: number = secondByte & 0x7F;

	packet.setPayloadType(payloadType);

	// Parse sequence number.
	const sequenceNumber: number = buffer.readUInt16BE(2);

	packet.setSequenceNumber(sequenceNumber);

	// Parse timestamp.
	const timestamp: number = buffer.readUInt32BE(4);

	packet.setTimestamp(timestamp);

	// Parse SSRC.
	const ssrc: number = buffer.readUInt32BE(8);

	packet.setSsrc(ssrc);

	// Parse marker.
	const marker: boolean = Boolean(secondByte >> 7);

	packet.setMarker(marker);

	// Parse padding.
	const paddingFlag: boolean = Boolean((firstByte >> 5) & 1);

	if (paddingFlag)
	{
		const lastByte = buffer.readUInt8(buffer.length - 1);

		packet.setPadding(lastByte);
	}

	// Parse CSRC.
	const csrcCount: number = firstByte & 0x0F;

	if (csrcCount > 0)
	{
		if (buffer.length < parsedLength + (csrcCount * 4))
		{
			throw new TypeError('no space for announced CSRC count');
		}

		const csrc: number[] = [];

		for (let idx = 0; idx < csrcCount; ++idx)
		{

			parsedLength += (idx * 4);
			csrc.push(buffer.readUInt32BE(parsedLength));
		}

		packet.setCsrc(csrc);
	}

	// Parse header extension.
	const extensionFlag: boolean = Boolean((firstByte >> 4) & 1);

	if (extensionFlag)
	{
		const id = Buffer.from(buffer.buffer, parsedLength, 2);
		const length = buffer.readUInt16BE(parsedLength + 2) * 4;
		const value = Buffer.from(buffer.buffer, parsedLength + 4, length);

		packet.setHeaderExtension({ id, value });
		parsedLength += (4 + length);
	}

	// Parse payload.
	const payloadLength: number =
		buffer.length - parsedLength - packet.getPadding();

	if (payloadLength < 0)
	{
		throw new TypeError(
			'announced padding bigger than available space for payload');
	}

	const payload = Buffer.from(buffer.buffer, parsedLength, payloadLength);

	packet.setPayload(payload);
	parsedLength += (payload.length + packet.getPadding());

	// Ensure that buffer length and parsed length match.
	if (parsedLength !== buffer.length)
	{
		throw new TypeError('parsed length does not match buffer length');
	}

	return packet;
}
