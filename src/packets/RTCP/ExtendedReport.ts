import { Serializable, type SerializableDump } from '../common/Serializable';
import { isUnsignedInteger, isUnsignedInteger8 } from '../../utils/numbers';
import { padTo4Bytes } from '../../utils/buffers';

/**
 * Length (in bytes) of the Extended Report block header.
 */
export const EXTENDED_REPORT_HEADER_LENGTH = 4;

/**
 * Maximum length (in bytes) representable by the block length field.
 */
const MAX_EXTENDED_REPORT_LENGTH = (0xffff + 1) * 4;

/**
 * RTCP XR Extended Report block type.
 */
export enum ExtendedReportBlockType {
	/**
	 * Receiver Reference Time Report Block.
	 */
	RRT = 4,
	/**
	 * DLRR Report Block.
	 */
	DLRR = 5,
}

/**
 * RTCP XR Extended Report block info dump.
 */
export type ExtendedReportDump = SerializableDump & {
	/**
	 * Block type.
	 */
	blockType: ExtendedReportBlockType;
	/**
	 * Value of the type-specific field, whose meaning depends on the block
	 * type.
	 */
	typeSpecific: number;
};

/**
 * Whether the given buffer could be a valid Extended Report block.
 *
 * @param buffer - Buffer holding the Extended Report block. Its `byteLength`
 *   can be greater than the length of the Extended Report block.
 */
export function isExtendedReport(buffer: Uint8Array): boolean {
	if (buffer.byteLength < EXTENDED_REPORT_HEADER_LENGTH) {
		return false;
	}

	const length = ((buffer[2]! << 8) + buffer[3]! + 1) * 4;

	return buffer.byteLength >= length;
}

/**
 * RTCP XR Extended Report block. Parent class of all Extended Report blocks.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |      BT       | type-specific |         block length          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :             type-specific block contents                      :
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * - Block type (BT) (8 bits): Identifies the block format.
 * - Type-specific (8 bits): Its use is determined by the block type
 *   definition.
 * - Block length (16 bits): Length of the block in 32-bit words minus one,
 *   including the header. Therefore the total length in bytes is
 *   (block length + 1) * 4.
 * - Type-specific block contents (variable length): Its format depends on
 *   the block type (BT). It's a multiple of 32 bits long.
 *
 * @see
 * - [RFC 3611 section 3](https://datatracker.ietf.org/doc/html/rfc3611#section-3)
 */
export abstract class ExtendedReport extends Serializable {
	protected constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP XR Extended Report block info.
	 */
	override dump(): ExtendedReportDump {
		return {
			...super.dump(),
			blockType: this.getBlockType(),
			typeSpecific: this.getTypeSpecific(),
		};
	}

	/**
	 * @inheritDoc
	 */
	abstract override clone(buffer: Uint8Array): ExtendedReport;

	/**
	 * Get the Extended Report block type.
	 *
	 * @remarks
	 * - In a block with unknown type, the returned value is not a member of
	 *   {@link ExtendedReportBlockType}.
	 */
	getBlockType(): ExtendedReportBlockType {
		return this.getView().getUint8(0);
	}

	/**
	 * To be called by the `parse()` method of each subclass right after
	 * creating the block. It sets the length of the block to the one announced
	 * in its block length field and validates the block type.
	 *
	 * @param blockType - Expected block type. If not given, any block type is
	 *   accepted.
	 *
	 * @remarks
	 * - The subclass must verify that the buffer is an Extended Report block
	 *   (see {@link isExtendedReport}) before creating the block.
	 *
	 * @throws
	 * - `TypeError` if the block type is not the given one.
	 * - `TypeError` if the buffer has no space for the announced length.
	 */
	protected parseHeader(blockType?: ExtendedReportBlockType): void {
		if (blockType !== undefined && this.getBlockType() !== blockType) {
			throw new TypeError(
				`not a RTCP XR ${ExtendedReportBlockType[blockType]} Extended Report block`
			);
		}

		const length = (this.getView().getUint16(2) + 1) * 4;

		// NOTE: This throws if there is no space in the buffer.
		this.setLength(length);
	}

	/**
	 * To be called by the `factory()` method of each subclass. It writes the
	 * whole Extended Report block header and sets the length of the block.
	 *
	 * @param blockType - Block type.
	 * @param typeSpecific - Value of the type-specific field.
	 * @param length - Length (in bytes) of the block.
	 *
	 * @throws
	 * - `TypeError` if `typeSpecific` is not an integer between 0 and 255, in
	 *   which case nothing changes.
	 * - `TypeError` if `length` is lower than the block header length, is not
	 *   multiple of 4 bytes or cannot be represented by the block length field,
	 *   in which case nothing changes.
	 * - `TypeError` if the buffer has no space for the given `length`, in which
	 *   case nothing changes.
	 */
	protected initializeHeader(
		blockType: ExtendedReportBlockType,
		typeSpecific: number,
		length: number
	): void {
		if (!isUnsignedInteger8(typeSpecific)) {
			throw new TypeError(
				`typeSpecific (${typeSpecific}) must be an integer between 0 and 255`
			);
		} else if (
			!isUnsignedInteger(length, MAX_EXTENDED_REPORT_LENGTH) ||
			length < EXTENDED_REPORT_HEADER_LENGTH ||
			padTo4Bytes(length) !== length
		) {
			throw new TypeError(
				`length (${length}) must be a multiple of 4 between ${EXTENDED_REPORT_HEADER_LENGTH} and ${MAX_EXTENDED_REPORT_LENGTH}`
			);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setLength(length);

		const view = this.getView();

		view.setUint8(0, blockType);
		view.setUint8(1, typeSpecific);
		this.#setLengthField(length);
	}

	/**
	 * Get the value of the type-specific field, whose meaning depends on the
	 * block type.
	 */
	protected getTypeSpecific(): number {
		return this.getView().getUint8(1);
	}

	/**
	 * Set the value of the type-specific field, whose meaning depends on the
	 * block type.
	 *
	 * @throws
	 * - `TypeError` if `typeSpecific` is not an integer between 0 and 255.
	 */
	protected setTypeSpecific(typeSpecific: number): void {
		if (!isUnsignedInteger8(typeSpecific)) {
			throw new TypeError(
				`typeSpecific (${typeSpecific}) must be an integer between 0 and 255`
			);
		}

		this.getView().setUint8(1, typeSpecific);
	}

	/**
	 * Get the body of the block (the type-specific block contents).
	 *
	 * @remarks
	 * - The returned value is a view over the buffer of the block (no bytes
	 *   are copied).
	 */
	protected getBody(): Uint8Array {
		return this.getBuffer().subarray(EXTENDED_REPORT_HEADER_LENGTH);
	}

	/**
	 * Get the length (in bytes) of the body of the block.
	 */
	protected getBodyLength(): number {
		return this.getLength() - EXTENDED_REPORT_HEADER_LENGTH;
	}

	/**
	 * Set the length (in bytes) of the body of the block. It doesn't write any
	 * byte of the body. It updates the length of the block and its block
	 * length field.
	 *
	 * @throws
	 * - `TypeError` if `bodyLength` is not an unsigned integer multiple of 4
	 *   bytes, in which case nothing changes.
	 * - `TypeError` if the resulting block length cannot be represented by the
	 *   block length field or if the buffer has no space for it, in which case
	 *   nothing changes.
	 */
	protected setBodyLength(bodyLength: number): void {
		if (
			!isUnsignedInteger(bodyLength) ||
			padTo4Bytes(bodyLength) !== bodyLength
		) {
			throw new TypeError(
				`bodyLength (${bodyLength}) must be an unsigned integer multiple of 4`
			);
		}

		const length = EXTENDED_REPORT_HEADER_LENGTH + bodyLength;

		if (length > MAX_EXTENDED_REPORT_LENGTH) {
			throw new TypeError(
				`block length (${length} bytes) cannot be greater than ${MAX_EXTENDED_REPORT_LENGTH} bytes`
			);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setLength(length);

		this.#setLengthField(length);
	}

	/**
	 * Write the given block length (in bytes) in the block length field.
	 */
	#setLengthField(length: number): void {
		this.getView().setUint16(2, length / 4 - 1);
	}
}
