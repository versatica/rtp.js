import {
	ExtendedReport,
	ExtendedReportType,
	ExtendedReportDump,
	getExtendedReportType,
	COMMON_HEADER_LENGTH,
} from './ExtendedReport.mts';

/**
 * Generic Extended Report dump.
 *
 * @category RTCP Extended Reports
 */
export type GenericExtendedReportDump = ExtendedReportDump;

/**
 * Generic Extended Report.
 *
 * ```text
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |     BT=???    | type-specific |         block length          |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                             body                              |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * :                              ...                              :
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * ```
 *
 * @category RTCP Extended Reports
 *
 * @see
 * - [RFC 3611 section 3](https://datatracker.ietf.org/doc/html/rfc3611#section-3)
 */
export class GenericExtendedReport extends ExtendedReport {
	// Buffer view holding the report body.
	#bodyView: DataView;

	/**
	 * @param view - If given it will be parsed. Otherwise an empty generic
	 *   Extended Report will be created.
	 * @param reportType - If `view` is not given, this parameter must be given.
	 *
	 * @throws
	 * - If given `view` does not contain a valid generic Extended Report.
	 */
	constructor(view?: DataView, reportType?: ExtendedReportType | number) {
		super(view ? getExtendedReportType(view) : reportType!, view);

		if (!view && !reportType) {
			throw new TypeError('view or reportType must be given');
		}

		if (!this.view) {
			this.view = new DataView(new ArrayBuffer(COMMON_HEADER_LENGTH));

			// Write report type.
			this.writeCommonHeader();

			// Set empty body.
			this.#bodyView = new DataView(
				this.view.buffer,
				this.view.byteOffset + COMMON_HEADER_LENGTH,
				0
			);

			return;
		}

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += COMMON_HEADER_LENGTH;

		// Get body.
		const bodyLength = this.view.byteLength - pos;

		this.#bodyView = new DataView(
			this.view.buffer,
			this.view.byteOffset + pos,
			bodyLength
		);

		pos += bodyLength;

		// Ensure that view length and parsed length match.
		if (pos !== this.view.byteLength) {
			throw new RangeError(
				`parsed length (${pos} bytes) does not match view length (${this.view.byteLength} bytes)`
			);
		}
	}

	/**
	 * Dump generic Extended Report info.
	 */
	dump(): GenericExtendedReportDump {
		return super.dump();
	}

	/**
	 * @inheritDoc
	 */
	getByteLength(): number {
		if (!this.needsSerialization()) {
			return this.view.byteLength;
		}

		const packetLength = COMMON_HEADER_LENGTH + this.#bodyView.byteLength;

		return packetLength;
	}

	/**
	 * @inheritDoc
	 */
	serialize(buffer?: ArrayBuffer, byteOffset?: number): void {
		const view = this.serializeBase(buffer, byteOffset);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Position relative to the DataView byte offset.
		let pos = 0;

		// Move to body.
		pos += COMMON_HEADER_LENGTH;

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

		if (pos !== view.byteLength) {
			throw new RangeError(
				`filled length (${pos} bytes) does not match the available buffer size (${view.byteLength} bytes)`
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
	clone(
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number
	): GenericExtendedReport {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset
		);

		return new GenericExtendedReport(view);
	}

	/**
	 * Get the value of the type specific field (second byte in the Extended
	 * Report common header).
	 */
	getTypeSpecific(): number {
		return this.view.getUint8(1);
	}

	/**
	 * Set the value of the type specific field (second byte in the Extended
	 * Report common header).
	 */
	setTypeSpecific(typeSpecific: number): void {
		this.view.setUint8(1, typeSpecific);

		this.setSerializationNeeded(true);
	}

	/**
	 * Get the report body.
	 */
	getBody(): DataView {
		return this.#bodyView;
	}

	/**
	 * Set the report body.
	 *
	 * @remarks
	 * - Given `view` must have a byte length multiple of 4 bytes.
	 */
	setBody(view: DataView): void {
		this.#bodyView = view;

		// Ensure body is padded to 4 bytes.
		if (view.byteLength % 4 !== 0) {
			throw new TypeError('body byte length must be multiple of 4 bytes');
		}

		this.setSerializationNeeded(true);
	}
}
