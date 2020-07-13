import { Logger } from './Logger';
import { clone } from './utils';

const RTP_VERSION = 2;
const FIXED_HEADER_LENGTH = 12;

const logger = new Logger('RtpPacket');

export type RtpHeaderExtension =
{
	id: number;
	value: Buffer;
}

export class RtpPacket
{
	// Buffer.
	private buffer: Buffer;
	// Whether serialization is needed due to modifications.
	private serializationNeeded: boolean = false;
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
	// Header extension.
	private headerExtension?: RtpHeaderExtension;
	// One-Byte or Two-Bytes extensions.
	private extensions: Map<number, Buffer> = new Map();
	// Payload.
	private payload?: Buffer;
	// Number of bytes of padding.
	private padding: number = 0;

	constructor(buffer: Buffer)
	{
		this.buffer = buffer;
	}

	dump(): any
	{
		const headerExtension = this.getHeaderExtension();
		const extensions: any = {};

		for (const [ id, value ] of this.extensions)
		{
			extensions[id] = value;
		}

		return {
			version         : this.version,
			payloadType     : this.payloadType,
			sequenceNumber  : this.sequenceNumber,
			timestamp       : this.timestamp,
			ssrc            : this.ssrc,
			csrc            : this.csrc,
			marker          : this.marker,
			headerExtension : headerExtension
				? {
					id     : headerExtension.id,
					length : headerExtension.value.length
				}
				: undefined,
			extensions    : extensions,
			payloadLength : this.payload?.length || 0,
			padding       : this.padding
		};
	}

	getBuffer(): Buffer
	{
		if (this.serializationNeeded)
		{
			this.serialize();
		}

		return this.buffer;
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
		// TODO: No. Write the payloadType directly in this.buffer.
		// Same for other setters.

		if (payloadType !== this.payloadType)
		{
			this.serializationNeeded = true;
		}

		this.payloadType = payloadType;
	}

	getSequenceNumber(): number
	{
		return this.sequenceNumber;
	}

	setSequenceNumber(sequenceNumber: number): void
	{
		if (sequenceNumber !== this.sequenceNumber)
		{
			this.serializationNeeded = true;
		}

		this.sequenceNumber = sequenceNumber;
	}

	getTimestamp(): number
	{
		return this.timestamp;
	}

	setTimestamp(timestamp: number): void
	{
		if (timestamp !== this.timestamp)
		{
			this.serializationNeeded = true;
		}

		this.timestamp = timestamp;
	}

	getSsrc(): number
	{
		return this.ssrc;
	}

	setSsrc(ssrc: number): void
	{
		if (ssrc !== this.ssrc)
		{
			this.serializationNeeded = true;
		}

		this.ssrc = ssrc;
	}

	getCsrc(): number[]
	{
		return this.csrc;
	}

	setCsrc(csrc: number[]): void
	{
		this.serializationNeeded = true;
		this.csrc = csrc;
	}

	getMarker(): boolean
	{
		return this.marker;
	}

	setMarker(marker: boolean): void
	{
		if (marker !== this.marker)
		{
			this.serializationNeeded = true;
		}

		this.marker = marker;
	}

	getHeaderExtension(): RtpHeaderExtension | undefined
	{
		return this.headerExtension;
	}

	setHeaderExtension(headerExtension?: RtpHeaderExtension): void
	{
		this.serializationNeeded = true;
		this.headerExtension = headerExtension;
	}

	HasOneByteExtensions(): boolean
	{
		return this.headerExtension?.id === 0xBEDE;
	}

	HasTwoBytesExtensions(): boolean
	{
		return (
			((this.headerExtension?.id || 0) & 0b1111111111110000) ===
			0b0001000000000000
		);
	}

	getExtensionById(id: number): Buffer | undefined
	{
		return this.extensions.get(id);
	}

	setExtensionById(id: number, value: Buffer): void
	{
		this.serializationNeeded = true;
		this.extensions.set(id, value);
	}

	deleteExtensionById(id: number): void
	{
		if (this.extensions.delete(id))
		{
			this.serializationNeeded = true;
		}
	}

	clearExtensions(): void
	{
		this.serializationNeeded = true;
		this.extensions.clear();
	}

	getPayload(): Buffer | undefined
	{
		return this.payload;
	}

	setPayload(payload?: Buffer): void
	{
		this.serializationNeeded = true;
		this.payload = payload;
	}

	getPadding(): number
	{
		return this.padding;
	}

	setPadding(padding: number): void
	{
		this.serializationNeeded = true;
		this.padding = padding;
	}

	parseExtensions(): void
	{
		this.extensions.clear();

		if (this.HasOneByteExtensions())
		{
			const buffer = this.headerExtension!.value;
			let pos: number = 0;

			// One-Byte extensions cannot have length 0.
			while (pos < buffer.length)
			{
				const id = (buffer[pos] & 0xF0) >> 4;
				const length = (buffer[pos] & 0x0F) + 1;

				// id=15 in One-Byte extensions means "stop parsing here".
				if (id === 15)
				{
					break;
				}

				// Valid extension id.
				if (id !== 0)
				{
					if (pos + 1 + length > buffer.length)
					{
						logger.warn(
							'parseExtensions() | not enough space for the announced One-Byte extension value'
						);

						break;
					}

					// Store the One-Byte extension element in the map.
					this.extensions.set(
						id,
						Buffer.from(buffer.buffer, buffer.byteOffset + pos + 1, length)
					);

					pos += (length + 1);
				}
				// id=0 means alignment.
				else
				{
					++pos;
				}

				// Counting padding bytes.
				while (pos < buffer.length && buffer[pos] === 0)
				{
					++pos;
				}
			}
		}
		else if (this.HasTwoBytesExtensions())
		{
			const buffer = this.headerExtension!.value;
			let pos: number = 0;

			// Two-Byte extensions can have length 0.
			while (pos + 1 < buffer.length)
			{
				const id = buffer[pos];
				const length = buffer[pos + 1];

				// Valid extension id.
				if (id !== 0)
				{
					if (pos + 2 + length > buffer.length)
					{
						logger.warn(
							'parseExtensions() | not enough space for the announced Two-Bytes extension value'
						);

						break;
					}

					// Store the Two-Bytes extension element in the map.
					this.extensions.set(
						id,
						Buffer.from(buffer.buffer, buffer.byteOffset + pos + 2, length)
					);

					pos += (length + 2);
				}
				// id=0 means alignment.
				else
				{
					++pos;
				}

				// Counting padding bytes.
				while (pos < buffer.length && buffer[pos] === 0)
				{
					++pos;
				}
			}
		}
	}

	serialize(): void
	{
		let length = FIXED_HEADER_LENGTH;

		length += this.csrc.length * 4;

		// If the extensions map is filled, trust it.
		// TODO: This will fail if I clear all extensions. So better have another
		// this.extensionsSerializationNeeded flag.
		if (this.extensions.size > 0)
		{
			if (this.HasOneByteExtensions())
			{
				for (const value of this.extensions.values())
				{
					length += 1 + value.length;
				}
			}
			else if (this.HasTwoBytesExtensions())
			{
				for (const value of this.extensions.values())
				{
					length += 2 + value.length;
				}
			}
		}
		// Otherwise trust the header extension.
		else if (this.headerExtension)
		{
			length += 4 + this.headerExtension.value.length;
		}

		length += this.payload?.length || 0;
		length += this.padding;

		this.buffer = Buffer.alloc(length);

		// TODO: Do everything.
	}

	clone(): RtpPacket
	{
		const clonedPacket = new RtpPacket(clone(this.buffer));

		clonedPacket.setPayloadType(this.payloadType);
		clonedPacket.setSequenceNumber(this.sequenceNumber);
		clonedPacket.setTimestamp(this.timestamp);
		clonedPacket.setSsrc(this.ssrc);
		clonedPacket.setCsrc(clone(this.csrc));
		clonedPacket.setMarker(this.marker);
		clonedPacket.setHeaderExtension(clone(this.headerExtension));
		clonedPacket.setPayload(clone(this.payload));
		clonedPacket.setPadding(this.padding);

		for (const [ id, value ] of this.extensions)
		{
			clonedPacket.setExtensionById(id, value);
		}

		return clonedPacket;
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
		throw new TypeError('invalid RTP packet');
	}

	const packet = new RtpPacket(buffer);
	const firstByte: number = buffer.readUInt8(0);
	const secondByte: number = buffer.readUInt8(1);
	let pos: number = FIXED_HEADER_LENGTH;

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

	// Parse CSRC.
	const csrcCount: number = firstByte & 0x0F;

	if (csrcCount > 0)
	{
		if (buffer.length < pos + (csrcCount * 4))
		{
			throw new TypeError('no space for announced CSRC count');
		}

		const csrc: number[] = [];

		for (let i = 0; i < csrcCount; ++i)
		{
			csrc.push(buffer.readUInt32BE(pos));
			pos += 4;
		}

		packet.setCsrc(csrc);
	}

	// Parse header extension.
	const extensionFlag: boolean = Boolean((firstByte >> 4) & 1);

	if (extensionFlag)
	{
		const id = buffer.readUInt16BE(pos);
		const length = buffer.readUInt16BE(pos + 2) * 4;
		const value =
			Buffer.from(buffer.buffer, buffer.byteOffset + pos + 4, length);

		packet.setHeaderExtension({ id, value });
		pos += (4 + length);
	}

	// Get padding.
	const paddingFlag: boolean = Boolean((firstByte >> 5) & 1);

	if (paddingFlag)
	{
		const padding = buffer.readUInt8(buffer.length - 1);

		packet.setPadding(padding);
	}

	// Get payload.
	const paddingLength = packet.getPadding();
	const payloadLength: number =
		buffer.length - pos - paddingLength;

	if (payloadLength < 0)
	{
		throw new TypeError(
			`announced padding (${paddingLength} bytes) is bigger than available space for payload (${buffer.length - pos} bytes)`
		);
	}

	const payload =
		Buffer.from(buffer.buffer, buffer.byteOffset + pos, payloadLength);

	packet.setPayload(payload);
	pos += (payload.length + paddingLength);

	// Ensure that buffer length and parsed length match.
	if (pos !== buffer.length)
	{
		throw new TypeError(
			`parsed length (${pos} bytes) does not match buffer length (${buffer.length} bytes)`
		);
	}

	return packet;
}
