import {
	RtcpPacket,
	RtcpPacketType,
	isRtcp,
	COMMON_HEADER_LENGTH,
	type RtcpPacketDump,
} from './RtcpPacket';
import {
	ExtendedReportBlockType,
	isExtendedReport,
	type ExtendedReport,
	type ExtendedReportDump,
} from './ExtendedReport';
import { RrtExtendedReport } from './extendedReports/RrtExtendedReport';
import { DlrrExtendedReport } from './extendedReports/DlrrExtendedReport';
import { UnknownExtendedReport } from './extendedReports/UnknownExtendedReport';
import { isUnsignedInteger } from '../../utils/numbers';

/**
 * Length (in bytes) of the XR header, RTCP Common Header included.
 */
const XR_HEADER_LENGTH = 8;

/**
 * RTCP XR packet info dump.
 */
export type XrPacketDump = RtcpPacketDump & {
	ssrc: number;
	extendedReports: ExtendedReportDump[];
};

/**
 * RTCP Extended Reports (XR) packet (207).
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|reserved |   PT=XR=207   |             length            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                              SSRC                             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                         report blocks                         :
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * - Reserved (5 bits): Must be set to zero and must be ignored by the
 *   receiver.
 * - Packet type (8 bits): 207.
 * - SSRC (32 bits): The synchronization source identifier for the originator
 *   of this XR packet.
 * - Report blocks (variable length): Zero or more Extended Report blocks.
 *
 * @remarks
 * - Extended Report blocks with an unknown or not implemented block type are
 *   kept as {@link UnknownExtendedReport} and parsing continues with the next
 *   block.
 *
 * @see
 * - [RFC 3611 section 2](https://datatracker.ietf.org/doc/html/rfc3611#section-2)
 */
export class XrPacket extends RtcpPacket {
	// Extended Report blocks.
	#extendedReports: ExtendedReport[] = [];

	/**
	 * Parse a RTCP XR packet.
	 *
	 * @param buffer - Buffer holding the packet. Its `byteLength` is the maximum
	 *   length the packet can take and it can be greater than the length of the
	 *   packet, which is given by its Length field.
	 *
	 * @throws
	 * - `TypeError` if the buffer does not contain a valid RTCP XR packet.
	 */
	static parse(buffer: Uint8Array): XrPacket {
		if (!isRtcp(buffer)) {
			throw new TypeError('not a RTCP packet');
		}

		const packet = new XrPacket(buffer);

		packet.parseCommonHeader(RtcpPacketType.XR);
		packet.#parseExtendedReports();

		return packet;
	}

	/**
	 * Create a RTCP XR packet with SSRC set to 0 and no Extended Report blocks.
	 *
	 * @param buffer - Buffer for the packet. Its `byteLength` is the maximum
	 *   length the packet can take.
	 *
	 * @throws
	 * - `TypeError` if `buffer.byteLength` is lower than 8 bytes.
	 */
	static factory(buffer: Uint8Array): XrPacket {
		const packet = new XrPacket(buffer);

		packet.initializeHeader(RtcpPacketType.XR, 0, XR_HEADER_LENGTH);

		// Set SSRC to 0.
		buffer.fill(0, COMMON_HEADER_LENGTH, XR_HEADER_LENGTH);

		return packet;
	}

	/**
	 * Length (in bytes) of a RTCP XR packet carrying Extended Report blocks
	 * whose lengths sum `extendedReportsLength`.
	 *
	 * @internal
	 */
	static computeLengthFor(extendedReportsLength: number): number {
		// The Extended Report blocks go right after the XR header, and each one
		// is a multiple of 4 bytes, so the packet never needs padding.
		return XR_HEADER_LENGTH + extendedReportsLength;
	}

	private constructor(buffer: Uint8Array) {
		super(buffer);
	}

	/**
	 * Dump RTCP XR packet info.
	 */
	override dump(): XrPacketDump {
		return {
			...super.dump(),
			ssrc: this.getSsrc(),
			extendedReports: this.#extendedReports.map(extendedReport =>
				extendedReport.dump()
			),
		};
	}

	/**
	 * @inheritDoc
	 */
	clone(buffer: Uint8Array): XrPacket {
		const clonedPacket = new XrPacket(buffer);

		// NOTE: No byte is copied here. The XR header and the padding are copied
		// below and each Extended Report block copies its own bytes.
		this.cloneInto(clonedPacket, /* copyBytes */ false);

		const packetBuffer = this.getBuffer();
		const byteOffset = packetBuffer.byteOffset;
		const clonedPacketBuffer = clonedPacket.getBuffer();
		// The Extended Report blocks fill the packet (excluding padding).
		const contentLength = this.getLength() - this.getPadding();

		// Copy the XR header.
		clonedPacketBuffer.set(packetBuffer.subarray(0, XR_HEADER_LENGTH));

		// Copy the padding (if any).
		clonedPacketBuffer.set(packetBuffer.subarray(contentLength), contentLength);

		// Each Extended Report block goes at the same position within the cloned
		// packet.
		for (const extendedReport of this.#extendedReports) {
			const extendedReportBuffer = extendedReport.getBuffer();
			const pos = extendedReportBuffer.byteOffset - byteOffset;

			clonedPacket.#extendedReports.push(
				extendedReport.clone(
					clonedPacketBuffer.subarray(
						pos,
						pos + extendedReportBuffer.byteLength
					)
				)
			);
		}

		return clonedPacket;
	}

	/**
	 * Get the SSRC of the originator of this XR packet.
	 */
	getSsrc(): number {
		return this.getView().getUint32(4);
	}

	/**
	 * Set the SSRC of the originator of this XR packet.
	 *
	 * @throws
	 * - `TypeError` if `ssrc` is not an integer between 0 and 4294967295.
	 */
	setSsrc(ssrc: number): void {
		if (!isUnsignedInteger(ssrc, 0xffffffff)) {
			throw new TypeError(
				`ssrc (${ssrc}) must be an integer between 0 and 4294967295`
			);
		}

		this.getView().setUint32(4, ssrc);
	}

	/**
	 * Get the Extended Report blocks.
	 *
	 * @remarks
	 * - The returned array is a copy, but the Extended Report blocks in it are
	 *   the ones in the packet, so modifying them modifies the packet.
	 */
	getExtendedReports(): ExtendedReport[] {
		return this.#extendedReports.slice();
	}

	/**
	 * Get the first Extended Report block of the given class.
	 *
	 * @example
	 * ```ts
	 * const dlrrExtendedReport = xrPacket.getFirstExtendedReportOfType(
	 *   DlrrExtendedReport
	 * );
	 * ```
	 */
	getFirstExtendedReportOfType<T extends ExtendedReport>(type: {
		prototype: T;
	}): T | undefined {
		for (const extendedReport of this.#extendedReports) {
			if (Object.getPrototypeOf(extendedReport) === type.prototype) {
				return extendedReport as T;
			}
		}

		return undefined;
	}

	/**
	 * Clone the given Extended Report block into the buffer of the packet,
	 * after the existing ones.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 *
	 * @throws
	 * - `Error` if some Extended Report block is being built in place within
	 *   the packet (see {@link needsConsolidation}).
	 * - `TypeError` if the given Extended Report block lives where it would be
	 *   cloned (in the free space of the buffer of the packet), in which case
	 *   nothing changes.
	 * - `TypeError` if the buffer has no space for the Extended Report block,
	 *   in which case nothing changes.
	 */
	addExtendedReport(extendedReport: ExtendedReport): void {
		this.assertDoesNotNeedConsolidation();

		const bodyLength = this.getBodyLength();
		const extendedReportBuffer = extendedReport.getBuffer();
		const extendedReportLength = extendedReportBuffer.byteLength;
		// The Extended Report block goes right after the last one.
		const pos = COMMON_HEADER_LENGTH + bodyLength;
		const view = this.getView();
		const byteOffset = view.byteOffset + pos;

		// NOTE: Checked before changing anything, since the clone below would
		// throw once the length of the packet has been updated.
		if (
			extendedReportBuffer.buffer === view.buffer &&
			byteOffset < extendedReportBuffer.byteOffset + extendedReportLength &&
			extendedReportBuffer.byteOffset < byteOffset + extendedReportLength
		) {
			throw new TypeError(
				'given Extended Report block overlaps the position where it would be cloned'
			);
		}

		// NOTE: This throws if there is no space in the buffer.
		this.setBodyLength(bodyLength + extendedReportLength);

		this.#extendedReports.push(
			extendedReport.clone(
				this.getBuffer().subarray(pos, pos + extendedReportLength)
			)
		);
	}

	/**
	 * Build an Extended Report block of the given class within the free space
	 * of the buffer of the packet. The application can modify it and the
	 * changes are written in the buffer of the packet. Once completed, the
	 * application must call {@link consolidate} on it so the packet adds it,
	 * or {@link discard} so the packet is left as it was.
	 *
	 * @param type - Class of the Extended Report block, whose `factory()` is
	 *   used to create it.
	 *
	 * @remarks
	 * - This method removes existing padding (if any).
	 * - Meanwhile, {@link getLength} of the packet does not include the length
	 *   of the Extended Report block.
	 *
	 * @throws
	 * - `Error` if some Extended Report block is being built in place within
	 *   the packet (see {@link needsConsolidation}).
	 * - `TypeError` if the buffer has no space for the Extended Report block.
	 *
	 * @example
	 * ```ts
	 * const dlrrExtendedReport =
	 *   xrPacket.buildExtendedReportInPlace(DlrrExtendedReport);
	 *
	 * dlrrExtendedReport.addSubBlock({ ... });
	 * dlrrExtendedReport.consolidate();
	 * ```
	 */
	buildExtendedReportInPlace<T extends ExtendedReport>(type: {
		factory(buffer: Uint8Array): T;
	}): T {
		this.assertDoesNotNeedConsolidation();

		const bodyLength = this.getBodyLength();

		// Remove padding (if any) so the new Extended Report block goes right
		// after the last one.
		// NOTE: This doesn't throw since the length doesn't grow.
		this.setBodyLength(bodyLength);

		const view = this.getView();
		const pos = COMMON_HEADER_LENGTH + bodyLength;
		// The free space of the buffer is the potential buffer of the Extended
		// Report block.
		const extendedReport = type.factory(
			new Uint8Array(view.buffer, view.byteOffset + pos, view.byteLength - pos)
		);

		this.handleInPlaceItem(extendedReport, consolidatedExtendedReport => {
			// NOTE: This throws if there is no space in the buffer.
			this.setBodyLength(
				this.getBodyLength() + consolidatedExtendedReport.getLength()
			);

			this.#extendedReports.push(consolidatedExtendedReport);
		});

		return extendedReport;
	}

	protected override setBuffer(buffer: Uint8Array): void {
		for (const extendedReport of this.#extendedReports) {
			this.setItemBuffer(extendedReport, buffer);
		}

		super.setBuffer(buffer);
	}

	#parseExtendedReports(): void {
		// Length of the packet excluding padding.
		const contentLength = this.getLength() - this.getPadding();

		if (contentLength < XR_HEADER_LENGTH) {
			throw new TypeError(
				`packet length (${contentLength} bytes, excluding padding) is lower than ${XR_HEADER_LENGTH} bytes`
			);
		}

		const buffer = this.getBuffer();
		let pos = XR_HEADER_LENGTH;

		// Extended Report blocks must fill the whole packet (excluding padding).
		while (pos < contentLength) {
			// The remaining length in the packet (excluding padding) is the
			// potential buffer of the Extended Report block.
			const remainingBuffer = buffer.subarray(pos, contentLength);

			if (!isExtendedReport(remainingBuffer)) {
				throw new TypeError('not a RTCP XR Extended Report block');
			}

			const extendedReportLength =
				((remainingBuffer[2]! << 8) + remainingBuffer[3]! + 1) * 4;
			// The buffer of the Extended Report block is its exact length.
			const extendedReportBuffer = remainingBuffer.subarray(
				0,
				extendedReportLength
			);
			let extendedReport: ExtendedReport;

			switch (remainingBuffer[0]) {
				case ExtendedReportBlockType.RRT: {
					extendedReport = RrtExtendedReport.parse(extendedReportBuffer);

					break;
				}

				case ExtendedReportBlockType.DLRR: {
					extendedReport = DlrrExtendedReport.parse(extendedReportBuffer);

					break;
				}

				default: {
					extendedReport = UnknownExtendedReport.parse(extendedReportBuffer);
				}
			}

			this.#extendedReports.push(extendedReport);

			pos += extendedReport.getLength();
		}
	}
}
