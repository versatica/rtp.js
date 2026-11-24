import { BitstreamReader } from '../../utils/BitstreamReader';
import { BitBufferWriter } from '../../utils/BitBufferWriter';
import {
	isUnsignedInteger,
	isUnsignedInteger16,
	isUnsignedInteger32,
} from '../../utils/numbers';

/**
 * Length (in bytes) of the mandatory descriptor fields.
 */
const MANDATORY_FIELDS_LENGTH = 3;

/**
 * Maximum length (in bytes) of a Dependency Descriptor, which is the maximum
 * length of a Two-Byte RTP extension.
 */
const MAX_LENGTH = 255;

/**
 * Maximum number of spatial ids.
 */
const MAX_SPATIAL_IDS = 4;

/**
 * Maximum number of temporal ids.
 */
const MAX_TEMPORAL_IDS = 8;

/**
 * Maximum number of decode targets.
 */
const MAX_DECODE_TARGETS = 32;

/**
 * Maximum number of frame dependency templates.
 */
const MAX_TEMPLATES = 64;

/**
 * Largest frame diff that can be written for a frame. A frame diff is written
 * as `fdiff_minus_one` using 4, 8 or 12 bits, so the largest one is
 * ((1 << 12) - 1) + 1. A frame diff of 0 cannot be represented.
 */
const MAX_FRAME_DIFF = 1 << 12;

/**
 * Largest chain diff that can be written for a frame. A chain diff is written
 * as-is in the 8 bits `frame_chain_fdiff` field.
 */
const MAX_CHAIN_DIFF = (1 << 8) - 1;

/**
 * Largest frame diff that can be written in a frame dependency template, which
 * is written as `fdiff_minus_one` using 4 bits.
 */
const MAX_TEMPLATE_FRAME_DIFF = 1 << 4;

/**
 * Largest chain diff that can be written in a frame dependency template, which
 * is written using 4 bits.
 */
const MAX_TEMPLATE_CHAIN_DIFF = (1 << 4) - 1;

/**
 * Length (in bits) of the mandatory descriptor fields.
 */
const MANDATORY_FIELDS_BITS = 1 + 1 + 6 + 16;

/**
 * Buffer in which the Dependency Descriptor is written before being copied
 * into the RTP packet.
 */
const writeBuffer = new Uint8Array(MAX_LENGTH);

/**
 * Relationship of a frame to a decode target.
 */
export enum DependencyDescriptorDecodeTargetIndication {
	/**
	 * No payload for this decode target is present (symbol '-').
	 */
	NOT_PRESENT = 0,
	/**
	 * Payload for this decode target is present and discardable (symbol 'D').
	 */
	DISCARDABLE = 1,
	/**
	 * Payload for this decode target is present and switch is possible
	 * (symbol 'S').
	 */
	SWITCH = 2,
	/**
	 * Payload for this decode target is present but it is neither discardable
	 * nor a switch indication (symbol 'R').
	 */
	REQUIRED = 3,
}

/**
 * How the spatial and temporal ids of the next frame dependency template are
 * derived from the current one (`next_layer_idc`).
 */
enum NextLayerIdc {
	SAME_LAYER = 0,
	NEXT_TEMPORAL_LAYER = 1,
	NEXT_SPATIAL_LAYER = 2,
	NO_MORE_TEMPLATES = 3,
}

/**
 * Maximum render resolution of the frames of a spatial layer.
 */
export type DependencyDescriptorRenderResolution = {
	/**
	 * Maximum render width (in pixels).
	 */
	width: number;
	/**
	 * Maximum render height (in pixels).
	 */
	height: number;
};

/**
 * Frame dependency template, or the frame dependency information of a frame.
 */
export type DependencyDescriptorTemplate = {
	/**
	 * Spatial id.
	 */
	spatialId: number;
	/**
	 * Temporal id.
	 */
	temporalId: number;
	/**
	 * Decode target indication of each decode target.
	 */
	decodeTargetIndications: DependencyDescriptorDecodeTargetIndication[];
	/**
	 * Difference between the frame number of the frame and the frame number of
	 * each referred frame.
	 */
	frameDiffs: number[];
	/**
	 * Difference between the frame number of the frame and the frame number of
	 * the previous frame in each chain (0 if no previous frame is needed).
	 */
	chainDiffs: number[];
};

/**
 * Template dependency structure of a coded video sequence.
 */
export type DependencyDescriptorStructure = {
	/**
	 * Value of the frame dependency template id of the first template.
	 */
	templateIdOffset: number;
	/**
	 * Number of decode targets.
	 */
	decodeTargetCount: number;
	/**
	 * Number of chains (0 if chains are not used).
	 */
	chainCount: number;
	/**
	 * Index of the chain that protects each decode target (empty if chains are
	 * not used).
	 */
	decodeTargetProtectedByChain: number[];
	/**
	 * Maximum render resolution of each spatial layer (empty if not given).
	 */
	resolutions: DependencyDescriptorRenderResolution[];
	/**
	 * Frame dependency templates, ordered by spatial id and temporal id.
	 */
	templates: DependencyDescriptorTemplate[];
};

/**
 * Mandatory descriptor fields of a Dependency Descriptor, which can be read
 * without a template dependency structure.
 */
export type DependencyDescriptorMandatoryFields = {
	/**
	 * Whether the first payload byte of the RTP packet is the beginning of a
	 * new frame.
	 */
	startOfFrame: boolean;
	/**
	 * Whether the RTP packet is the final one of its frame.
	 */
	endOfFrame: boolean;
	/**
	 * Frame number (16 bits), which increases strictly monotonically in decode
	 * order.
	 */
	frameNumber: number;
};

/**
 * Dependency Descriptor RTP extension.
 *
 * @see
 * - [AV1 RTP Specification, Appendix A](https://aomediacodec.github.io/av1-rtp-spec/#dependency-descriptor-rtp-header-extension)
 */
export type DependencyDescriptorExtension =
	DependencyDescriptorMandatoryFields & {
		/**
		 * Frame dependency information of the frame: the one of its frame
		 * dependency template with the custom decode target indications, frame
		 * diffs and chain diffs of the frame (if any) applied. Not given if the
		 * template dependency structure of the frame is unknown.
		 */
		frameDependencies?: DependencyDescriptorTemplate;
		/**
		 * Maximum render resolution of the frame, if the template dependency
		 * structure gives it.
		 */
		resolution?: DependencyDescriptorRenderResolution;
		/**
		 * Bitmask of the decode targets available for decoding (bit i is decode
		 * target i), if the descriptor carries it. If it carries a template
		 * dependency structure without a bitmask, all decode targets are active.
		 *
		 * @see
		 * - {@link DependencyDescriptorContext.getActiveDecodeTargetsBitmask} to
		 *   get the one in use in the stream, which is valid until the next one.
		 */
		activeDecodeTargetsBitmask?: number;
		/**
		 * Template dependency structure carried by the descriptor, if any.
		 */
		attachedStructure?: DependencyDescriptorStructure;
		/**
		 * Whether the frame is a key frame, this is, the first frame of a coded
		 * video sequence, whose first RTP packet carries the template dependency
		 * structure.
		 */
		isKeyFrame: boolean;
	};

/**
 * Spatial and temporal layer a decode target corresponds to.
 */
export type DependencyDescriptorDecodeTargetLayer = {
	/**
	 * Spatial id of the decode target.
	 */
	spatialId: number;
	/**
	 * Temporal id of the decode target.
	 */
	temporalId: number;
};

/**
 * Template that best matches the frame dependency information of a frame.
 */
type TemplateMatch = {
	/**
	 * Index of the template.
	 */
	templateIndex: number;
	needCustomDtis: boolean;
	needCustomFdiffs: boolean;
	needCustomChains: boolean;
	/**
	 * Length (in bits) of the frame-specific fields, this is, excluding the
	 * mandatory descriptor fields and the template dependency structure.
	 */
	extraSizeBits: number;
};

/**
 * Get the spatial and temporal layer of each decode target of the given
 * template dependency structure, this is, the highest spatial id and temporal
 * id among the templates that are part of it.
 */
export function getDependencyDescriptorDecodeTargetLayers(
	structure: DependencyDescriptorStructure
): DependencyDescriptorDecodeTargetLayer[] {
	const decodeTargetLayers: DependencyDescriptorDecodeTargetLayer[] = [];

	for (let dtIndex = 0; dtIndex < structure.decodeTargetCount; ++dtIndex) {
		let spatialId = 0;
		let temporalId = 0;

		for (const frameTemplate of structure.templates) {
			if (
				frameTemplate.decodeTargetIndications[dtIndex] !==
				DependencyDescriptorDecodeTargetIndication.NOT_PRESENT
			) {
				spatialId = Math.max(spatialId, frameTemplate.spatialId);
				temporalId = Math.max(temporalId, frameTemplate.temporalId);
			}
		}

		decodeTargetLayers.push({ spatialId, temporalId });
	}

	return decodeTargetLayers;
}

/**
 * Read the mandatory descriptor fields of the given Dependency Descriptor.
 */
export function readDependencyDescriptorMandatoryFields(
	data: Uint8Array
): DependencyDescriptorMandatoryFields | undefined {
	if (data.byteLength < MANDATORY_FIELDS_LENGTH) {
		return undefined;
	}

	return {
		startOfFrame: (data[0]! & 0b10000000) !== 0,
		endOfFrame: (data[0]! & 0b01000000) !== 0,
		frameNumber: (data[1]! << 8) | data[2]!,
	};
}

/**
 * Read the given Dependency Descriptor.
 *
 * @param data - Value of the RTP extension.
 * @param context - Context of the stream.
 * @param updateContext - Whether the context is updated with this descriptor
 *   (its template dependency structure, its active decode targets bitmask
 *   and its frame number).
 *
 * @returns `undefined` if the descriptor is malformed.
 */
export function readDependencyDescriptor(
	data: Uint8Array,
	context: DependencyDescriptorContext,
	updateContext: boolean
): DependencyDescriptorExtension | undefined {
	if (data.byteLength < MANDATORY_FIELDS_LENGTH) {
		return undefined;
	}

	const reader = new BitstreamReader(data);

	// Mandatory descriptor fields.
	const startOfFrame = reader.readBit() === 1;
	const endOfFrame = reader.readBit() === 1;
	const frameDependencyTemplateId = reader.readBits(6);
	const frameNumber = reader.readBits(16);

	let activeDecodeTargetsPresent = false;
	let customDtis = false;
	let customFdiffs = false;
	let customChains = false;
	let attachedStructure: DependencyDescriptorStructure | undefined;
	let activeDecodeTargetsBitmask: number | undefined;

	// Extended descriptor fields.
	if (data.byteLength > MANDATORY_FIELDS_LENGTH) {
		const templateDependencyStructurePresent = reader.readBit() === 1;

		activeDecodeTargetsPresent = reader.readBit() === 1;
		customDtis = reader.readBit() === 1;
		customFdiffs = reader.readBit() === 1;
		customChains = reader.readBit() === 1;

		if (templateDependencyStructurePresent) {
			// Only the first packet of a frame can carry a template dependency
			// structure.
			if (!startOfFrame) {
				return undefined;
			}

			attachedStructure = readTemplateDependencyStructure(reader);

			if (!reader.ok()) {
				return undefined;
			}

			activeDecodeTargetsBitmask = 2 ** attachedStructure.decodeTargetCount - 1;
		}
	}

	if (!reader.ok()) {
		return undefined;
	}

	// NOTE: The context only tracks the frame number of descriptors that are
	// not malformed, see below.
	const unwrappedFrameNumber = context.peekUnwrapFrameNumber(frameNumber);
	const structure = attachedStructure ?? context.getStructure();
	const getMandatoryFieldsOnlyDescriptor =
		(): DependencyDescriptorExtension => {
			if (updateContext) {
				context.unwrapFrameNumber(frameNumber);
			}

			return {
				startOfFrame,
				endOfFrame,
				frameNumber,
				isKeyFrame: unwrappedFrameNumber === context.getStructureFrameNumber(),
			};
		};

	// The template dependency structure of the frame is unknown, so nothing
	// else can be read.
	if (!structure) {
		return getMandatoryFieldsOnlyDescriptor();
	}

	if (activeDecodeTargetsPresent) {
		activeDecodeTargetsBitmask = reader.readBits(structure.decodeTargetCount);
	}

	const templateIndex =
		(frameDependencyTemplateId + MAX_TEMPLATES - structure.templateIdOffset) %
		MAX_TEMPLATES;
	const frameTemplate = structure.templates[templateIndex];

	if (!frameTemplate) {
		// A descriptor carrying its structure must refer to one of its templates.
		if (attachedStructure) {
			return undefined;
		}

		// Otherwise the packet bringing the template dependency structure of the
		// frame was lost or delayed, so it's unknown.
		return getMandatoryFieldsOnlyDescriptor();
	}

	// Copy all the fields from the matching template.
	const frameDependencies: DependencyDescriptorTemplate = {
		spatialId: frameTemplate.spatialId,
		temporalId: frameTemplate.temporalId,
		decodeTargetIndications: frameTemplate.decodeTargetIndications.slice(),
		frameDiffs: frameTemplate.frameDiffs.slice(),
		chainDiffs: frameTemplate.chainDiffs.slice(),
	};

	if (customDtis) {
		for (let idx = 0; idx < structure.decodeTargetCount; ++idx) {
			frameDependencies.decodeTargetIndications[idx] = reader.readBits(2);
		}
	}

	if (customFdiffs) {
		frameDependencies.frameDiffs = [];

		for (
			let nextFdiffSize = reader.readBits(2);
			nextFdiffSize > 0;
			nextFdiffSize = reader.readBits(2)
		) {
			const fdiffMinusOne = reader.readBits(4 * nextFdiffSize);

			frameDependencies.frameDiffs.push(fdiffMinusOne + 1);
		}
	}

	if (customChains) {
		for (let idx = 0; idx < structure.chainCount; ++idx) {
			frameDependencies.chainDiffs[idx] = reader.readBits(8);
		}
	}

	if (!reader.ok()) {
		return undefined;
	}

	if (updateContext) {
		context.unwrapFrameNumber(frameNumber);
	}

	// A template dependency structure only counts if its frame is newer than
	// the one that brought the structure in use (so a retransmitted first
	// packet of that same frame doesn't bring it again).
	if (updateContext && attachedStructure) {
		const structureFrameNumber = context.getStructureFrameNumber();

		if (
			structureFrameNumber === undefined ||
			unwrappedFrameNumber > structureFrameNumber
		) {
			context.setStructure(attachedStructure, unwrappedFrameNumber);
		}
	}

	// The active decode targets bitmask is valid until the next one, so the
	// context keeps it for the descriptors that don't carry one.
	if (updateContext && activeDecodeTargetsPresent) {
		context.updateActiveDecodeTargetsBitmask(
			activeDecodeTargetsBitmask!,
			unwrappedFrameNumber
		);
	}

	const spatialResolution = structure.resolutions[frameDependencies.spatialId];

	return {
		startOfFrame,
		endOfFrame,
		frameNumber,
		frameDependencies,
		resolution: spatialResolution ? { ...spatialResolution } : undefined,
		activeDecodeTargetsBitmask,
		attachedStructure,
		isKeyFrame:
			attachedStructure !== undefined ||
			unwrappedFrameNumber === context.getStructureFrameNumber(),
	};
}

/**
 * Write the given Dependency Descriptor.
 *
 * @param descriptor - Dependency Descriptor. Its `frameDependencies` must be
 *   given. If its `attachedStructure` is given, `structure` is written in the
 *   descriptor.
 * @param structure - Template dependency structure in use.
 * @param activeChainsBitmask - Bitmask of the active chains (bit i is chain i).
 *   The chain diffs of inactive chains are written as 0.
 *
 * @returns A view over a buffer shared by every call, so its content must be
 *   copied before calling this function again.
 *
 * @throws
 * - `TypeError` if the descriptor or the structure is not valid or if the
 *   descriptor cannot be represented.
 */
export function writeDependencyDescriptor(
	descriptor: Omit<DependencyDescriptorExtension, 'isKeyFrame'>,
	structure: DependencyDescriptorStructure,
	activeChainsBitmask: number
): Uint8Array {
	const writer = new DependencyDescriptorWriter(
		descriptor,
		structure,
		activeChainsBitmask
	);
	const length = Math.ceil(writer.valueSizeBits() / 8);

	if (length > MAX_LENGTH) {
		throw new TypeError(
			`Dependency Descriptor length (${length} bytes) cannot be greater than ${MAX_LENGTH} bytes`
		);
	}

	const data = writeBuffer.subarray(0, length);

	writer.write(data);

	return data;
}

/**
 * Read the template dependency structure.
 *
 * @remarks
 * - The returned structure and everything in it are frozen, since it may be
 *   kept by a context and given to the application.
 * - The caller must check `reader.ok()` afterwards.
 */
function readTemplateDependencyStructure(
	reader: BitstreamReader
): DependencyDescriptorStructure {
	const templateIdOffset = reader.readBits(6);
	const decodeTargetCount = reader.readBits(5) + 1;
	const templates = readTemplateLayers(reader);

	// Template DTIs.
	for (const frameTemplate of templates) {
		for (let idx = 0; idx < decodeTargetCount; ++idx) {
			frameTemplate.decodeTargetIndications.push(reader.readBits(2));
		}
	}

	// Template FDIFFs.
	for (const frameTemplate of templates) {
		for (
			let fdiffFollows = reader.readBit() === 1;
			fdiffFollows;
			fdiffFollows = reader.readBit() === 1
		) {
			const fdiffMinusOne = reader.readBits(4);

			frameTemplate.frameDiffs.push(fdiffMinusOne + 1);
		}
	}

	// Template chains.
	const chainCount = reader.readNonSymmetric(decodeTargetCount + 1);
	const decodeTargetProtectedByChain: number[] = [];

	if (chainCount > 0) {
		for (let idx = 0; idx < decodeTargetCount; ++idx) {
			decodeTargetProtectedByChain.push(reader.readNonSymmetric(chainCount));
		}

		for (const frameTemplate of templates) {
			for (let chainIdx = 0; chainIdx < chainCount; ++chainIdx) {
				frameTemplate.chainDiffs.push(reader.readBits(4));
			}
		}
	}

	// Render resolutions.
	const resolutions: DependencyDescriptorRenderResolution[] = [];

	if (reader.readBit() === 1 && templates.length > 0) {
		// The way templates are bitpacked, they are always ordered by spatial
		// id.
		const spatialLayers = templates[templates.length - 1]!.spatialId + 1;

		for (let spatialId = 0; spatialId < spatialLayers; ++spatialId) {
			const widthMinusOne = reader.readBits(16);
			const heightMinusOne = reader.readBits(16);

			resolutions.push(
				Object.freeze({ width: widthMinusOne + 1, height: heightMinusOne + 1 })
			);
		}
	}

	for (const frameTemplate of templates) {
		Object.freeze(frameTemplate.decodeTargetIndications);
		Object.freeze(frameTemplate.frameDiffs);
		Object.freeze(frameTemplate.chainDiffs);
		Object.freeze(frameTemplate);
	}

	return Object.freeze({
		templateIdOffset,
		decodeTargetCount,
		chainCount,
		decodeTargetProtectedByChain: Object.freeze(
			decodeTargetProtectedByChain
		) as number[],
		resolutions: Object.freeze(
			resolutions
		) as DependencyDescriptorRenderResolution[],
		templates: Object.freeze(templates) as DependencyDescriptorTemplate[],
	});
}

/**
 * Read the spatial and temporal id of every frame dependency template.
 *
 * @remarks
 * - It invalidates the reader if there are too many templates, spatial ids or
 *   temporal ids.
 */
function readTemplateLayers(
	reader: BitstreamReader
): DependencyDescriptorTemplate[] {
	const templates: DependencyDescriptorTemplate[] = [];
	let temporalId = 0;
	let spatialId = 0;
	let nextLayerIdc: NextLayerIdc;

	do {
		if (templates.length === MAX_TEMPLATES) {
			reader.invalidate();

			break;
		}

		templates.push({
			spatialId,
			temporalId,
			decodeTargetIndications: [],
			frameDiffs: [],
			chainDiffs: [],
		});

		// NOTE: Every 2 bits value is a NextLayerIdc value.
		nextLayerIdc = reader.readBits(2);

		switch (nextLayerIdc) {
			case NextLayerIdc.SAME_LAYER: {
				break;
			}

			case NextLayerIdc.NEXT_TEMPORAL_LAYER: {
				++temporalId;

				if (temporalId >= MAX_TEMPORAL_IDS) {
					reader.invalidate();
				}

				break;
			}

			case NextLayerIdc.NEXT_SPATIAL_LAYER: {
				temporalId = 0;

				++spatialId;

				if (spatialId >= MAX_SPATIAL_IDS) {
					reader.invalidate();
				}

				break;
			}

			case NextLayerIdc.NO_MORE_TEMPLATES: {
				break;
			}
		}
	} while (nextLayerIdc !== NextLayerIdc.NO_MORE_TEMPLATES && reader.ok());

	return templates;
}

/**
 * Check that the given template dependency structure can be used to write a
 * descriptor.
 *
 * @param structure - Template dependency structure.
 * @param writeStructure - Whether the structure itself is going to be written,
 *   in which case every field of it is checked.
 *
 * @throws
 * - `TypeError` if it cannot.
 */
function assertStructure(
	structure: DependencyDescriptorStructure,
	writeStructure: boolean
): void {
	const {
		templateIdOffset,
		decodeTargetCount,
		chainCount,
		decodeTargetProtectedByChain,
		resolutions,
		templates,
	} = structure;

	if (!isUnsignedInteger(templateIdOffset, MAX_TEMPLATES - 1)) {
		throw new TypeError(
			`templateIdOffset (${templateIdOffset}) must be an integer between 0 and ${MAX_TEMPLATES - 1}`
		);
	} else if (
		!isUnsignedInteger(decodeTargetCount, MAX_DECODE_TARGETS) ||
		decodeTargetCount === 0
	) {
		throw new TypeError(
			`decodeTargetCount (${decodeTargetCount}) must be an integer between 1 and ${MAX_DECODE_TARGETS}`
		);
	} else if (!isUnsignedInteger(chainCount, decodeTargetCount)) {
		throw new TypeError(
			`chainCount (${chainCount}) must be an integer between 0 and decodeTargetCount (${decodeTargetCount})`
		);
	} else if (templates.length === 0 || templates.length > MAX_TEMPLATES) {
		throw new TypeError(
			`number of templates (${templates.length}) must be between 1 and ${MAX_TEMPLATES}`
		);
	}

	// The rest of the structure is only needed to write it.
	if (!writeStructure) {
		return;
	}

	if (chainCount > 0) {
		if (decodeTargetProtectedByChain.length !== decodeTargetCount) {
			throw new TypeError(
				`decodeTargetProtectedByChain must have decodeTargetCount (${decodeTargetCount}) items`
			);
		}

		for (const protectedBy of decodeTargetProtectedByChain) {
			if (!isUnsignedInteger(protectedBy, chainCount - 1)) {
				throw new TypeError(
					`decodeTargetProtectedByChain values must be integers between 0 and chainCount - 1 (${chainCount - 1})`
				);
			}
		}
	}

	for (let idx = 0; idx < templates.length; ++idx) {
		const frameTemplate = templates[idx]!;

		if (
			!isUnsignedInteger(frameTemplate.spatialId, MAX_SPATIAL_IDS - 1) ||
			!isUnsignedInteger(frameTemplate.temporalId, MAX_TEMPORAL_IDS - 1)
		) {
			throw new TypeError(
				`template spatialId and temporalId must be integers lower than ${MAX_SPATIAL_IDS} and ${MAX_TEMPORAL_IDS}`
			);
		} else if (
			idx === 0 &&
			(frameTemplate.spatialId !== 0 || frameTemplate.temporalId !== 0)
		) {
			throw new TypeError(
				'first template must have spatialId and temporalId 0'
			);
		} else if (
			idx > 0 &&
			getNextLayerIdc(templates[idx - 1]!, frameTemplate) === undefined
		) {
			throw new TypeError(
				'each template must have the same layer as the previous one, the next temporal layer or the next spatial layer with temporalId 0'
			);
		}

		assertDecodeTargetIndications(
			frameTemplate.decodeTargetIndications,
			decodeTargetCount
		);

		for (const fdiff of frameTemplate.frameDiffs) {
			if (!isUnsignedInteger(fdiff, MAX_TEMPLATE_FRAME_DIFF) || fdiff === 0) {
				throw new TypeError(
					`template frameDiffs values must be integers between 1 and ${MAX_TEMPLATE_FRAME_DIFF}`
				);
			}
		}

		if (frameTemplate.chainDiffs.length !== chainCount) {
			throw new TypeError(
				`template chainDiffs must have chainCount (${chainCount}) items`
			);
		}

		for (const chainDiff of frameTemplate.chainDiffs) {
			if (!isUnsignedInteger(chainDiff, MAX_TEMPLATE_CHAIN_DIFF)) {
				throw new TypeError(
					`template chainDiffs values must be integers between 0 and ${MAX_TEMPLATE_CHAIN_DIFF}`
				);
			}
		}
	}

	if (resolutions.length > 0) {
		const spatialLayers = templates[templates.length - 1]!.spatialId + 1;

		if (resolutions.length !== spatialLayers) {
			throw new TypeError(
				`resolutions must have one item per spatial layer (${spatialLayers})`
			);
		}

		for (const { width, height } of resolutions) {
			if (
				!isUnsignedInteger(width, 0x10000) ||
				!isUnsignedInteger(height, 0x10000) ||
				width === 0 ||
				height === 0
			) {
				throw new TypeError(
					'resolutions width and height must be integers between 1 and 65536'
				);
			}
		}
	}
}

/**
 * @throws
 * - `TypeError` if the given decode target indications are not
 *   `decodeTargetCount` valid values.
 */
function assertDecodeTargetIndications(
	decodeTargetIndications: DependencyDescriptorDecodeTargetIndication[],
	decodeTargetCount: number
): void {
	if (decodeTargetIndications.length !== decodeTargetCount) {
		throw new TypeError(
			`decodeTargetIndications must have decodeTargetCount (${decodeTargetCount}) items`
		);
	}

	for (const dti of decodeTargetIndications) {
		if (
			!isUnsignedInteger(
				dti,
				DependencyDescriptorDecodeTargetIndication.REQUIRED
			)
		) {
			throw new TypeError(
				`decodeTargetIndications values must be DependencyDescriptorDecodeTargetIndication values`
			);
		}
	}
}

/**
 * How the spatial and temporal ids of `next` derive from the ones of
 * `previous`, or `undefined` if they cannot.
 */
function getNextLayerIdc(
	previous: DependencyDescriptorTemplate,
	next: DependencyDescriptorTemplate
): NextLayerIdc | undefined {
	if (
		next.spatialId === previous.spatialId &&
		next.temporalId === previous.temporalId
	) {
		return NextLayerIdc.SAME_LAYER;
	} else if (
		next.spatialId === previous.spatialId &&
		next.temporalId === previous.temporalId + 1
	) {
		return NextLayerIdc.NEXT_TEMPORAL_LAYER;
	} else if (
		next.spatialId === previous.spatialId + 1 &&
		next.temporalId === 0
	) {
		return NextLayerIdc.NEXT_SPATIAL_LAYER;
	}

	return undefined;
}

/**
 * Whether two arrays of numbers have the same items.
 */
function areNumberArraysEqual(
	lhs: readonly number[],
	rhs: readonly number[]
): boolean {
	if (lhs.length !== rhs.length) {
		return false;
	}

	for (let idx = 0; idx < lhs.length; ++idx) {
		if (lhs[idx] !== rhs[idx]) {
			return false;
		}
	}

	return true;
}

/**
 * Context of a stream whose RTP packets carry the Dependency Descriptor RTP
 * extension. The application creates one per stream and passes it every time
 * it reads a Dependency Descriptor of the stream.
 *
 * It keeps the template dependency structure in use, needed to read the
 * descriptors that don't carry one, and which frame brought it, so that the
 * descriptor of an older frame (carried by a retransmitted or reordered RTP
 * packet) does not replace it with an outdated one.
 */
export class DependencyDescriptorContext {
	// Template dependency structure in use.
	#structure?: DependencyDescriptorStructure;
	// Unwrapped frame number of the frame that brought the structure in use.
	#structureFrameNumber?: number;
	// Bitmask of the active decode targets in use.
	#activeDecodeTargetsBitmask?: number;
	// Unwrapped frame number of the frame that brought the bitmask in use.
	#activeDecodeTargetsFrameNumber?: number;
	// Last given frame number.
	#lastFrameNumber?: number;
	// Last unwrapped frame number.
	#lastUnwrappedFrameNumber = 0;

	/**
	 * Get the template dependency structure in use, if any.
	 *
	 * @remarks
	 * - The returned structure is frozen.
	 */
	getStructure(): DependencyDescriptorStructure | undefined {
		return this.#structure;
	}

	/**
	 * Get the bitmask of the decode targets available for decoding in the
	 * stream (bit i is decode target i), if any.
	 *
	 * @remarks
	 * - It's the last bitmask carried by a descriptor of the stream, which is
	 *   valid until the next one, or all decode targets active since the last
	 *   template dependency structure.
	 */
	getActiveDecodeTargetsBitmask(): number | undefined {
		return this.#activeDecodeTargetsBitmask;
	}

	/**
	 * Get the unwrapped frame number of the frame that brought the template
	 * dependency structure in use, if any.
	 *
	 * @internal
	 */
	getStructureFrameNumber(): number | undefined {
		return this.#structureFrameNumber;
	}

	/**
	 * Set the template dependency structure in use and the unwrapped frame
	 * number of the frame that brought it.
	 *
	 * @internal
	 */
	setStructure(
		structure: DependencyDescriptorStructure,
		unwrappedFrameNumber: number
	): void {
		this.#structure = structure;
		this.#structureFrameNumber = unwrappedFrameNumber;

		// A new structure makes all its decode targets active, unless a newer
		// frame already brought a bitmask.
		this.updateActiveDecodeTargetsBitmask(
			2 ** structure.decodeTargetCount - 1,
			unwrappedFrameNumber
		);
	}

	/**
	 * Set the bitmask of the active decode targets in use, unless the frame
	 * that brings it is older than the one that brought the bitmask in use.
	 *
	 * @internal
	 */
	updateActiveDecodeTargetsBitmask(
		bitmask: number,
		unwrappedFrameNumber: number
	): void {
		if (
			this.#activeDecodeTargetsFrameNumber !== undefined &&
			unwrappedFrameNumber < this.#activeDecodeTargetsFrameNumber
		) {
			return;
		}

		this.#activeDecodeTargetsBitmask = bitmask;
		this.#activeDecodeTargetsFrameNumber = unwrappedFrameNumber;
	}

	/**
	 * Unwrap the given frame number so that frames can be ordered despite the
	 * 16 bits of the field wrapping around, and track it as the last one.
	 *
	 * @internal
	 */
	unwrapFrameNumber(frameNumber: number): number {
		this.#lastUnwrappedFrameNumber = this.peekUnwrapFrameNumber(frameNumber);
		this.#lastFrameNumber = frameNumber;

		return this.#lastUnwrappedFrameNumber;
	}

	/**
	 * Same as {@link unwrapFrameNumber} but without tracking it.
	 *
	 * @internal
	 */
	peekUnwrapFrameNumber(frameNumber: number): number {
		if (this.#lastFrameNumber === undefined) {
			return frameNumber;
		}

		let delta = frameNumber - this.#lastFrameNumber;

		if (delta < -0x8000) {
			delta += 0x10000;
		} else if (delta > 0x8000) {
			delta -= 0x10000;
		}

		return this.#lastUnwrappedFrameNumber + delta;
	}
}

/**
 * Serializes a Dependency Descriptor.
 */
class DependencyDescriptorWriter {
	readonly #descriptor: Omit<DependencyDescriptorExtension, 'isKeyFrame'>;
	readonly #frameDependencies: DependencyDescriptorTemplate;
	readonly #structure: DependencyDescriptorStructure;
	readonly #activeChainsBitmask: number;
	readonly #bestTemplate: TemplateMatch;
	#writer?: BitBufferWriter;

	/**
	 * @throws
	 * - `TypeError` if the descriptor or the structure is not valid or if the
	 *   descriptor cannot be represented.
	 */
	constructor(
		descriptor: Omit<DependencyDescriptorExtension, 'isKeyFrame'>,
		structure: DependencyDescriptorStructure,
		activeChainsBitmask: number
	) {
		assertStructure(
			structure,
			/* writeStructure */ descriptor.attachedStructure !== undefined
		);

		const {
			startOfFrame,
			frameNumber,
			frameDependencies,
			activeDecodeTargetsBitmask,
			attachedStructure,
		} = descriptor;

		if (!isUnsignedInteger16(frameNumber)) {
			throw new TypeError(
				`frameNumber (${frameNumber}) must be an integer between 0 and 65535`
			);
		} else if (attachedStructure && !startOfFrame) {
			throw new TypeError(
				'only the first packet of a frame can carry a template dependency structure'
			);
		} else if (!frameDependencies) {
			throw new TypeError('frameDependencies must be given');
		} else if (
			activeDecodeTargetsBitmask !== undefined &&
			!isUnsignedInteger(
				activeDecodeTargetsBitmask,
				2 ** structure.decodeTargetCount - 1
			)
		) {
			throw new TypeError(
				`activeDecodeTargetsBitmask (${activeDecodeTargetsBitmask}) must be an integer with at most decodeTargetCount (${structure.decodeTargetCount}) bits`
			);
		} else if (!isUnsignedInteger32(activeChainsBitmask)) {
			throw new TypeError(
				`activeChainsBitmask (${activeChainsBitmask}) must be an integer between 0 and 4294967295`
			);
		} else if (frameDependencies.chainDiffs.length !== structure.chainCount) {
			throw new TypeError(
				`frameDependencies.chainDiffs must have chainCount (${structure.chainCount}) items`
			);
		}

		assertDecodeTargetIndications(
			frameDependencies.decodeTargetIndications,
			structure.decodeTargetCount
		);

		this.#descriptor = descriptor;
		this.#frameDependencies = frameDependencies;
		this.#structure = structure;
		this.#activeChainsBitmask = activeChainsBitmask;

		this.#assertSerializableDiffs();

		this.#bestTemplate = this.#findBestTemplate();
	}

	/**
	 * Minimum number of bits needed to write the descriptor.
	 */
	valueSizeBits(): number {
		let valueSizeBits =
			MANDATORY_FIELDS_BITS + this.#bestTemplate.extraSizeBits;

		if (this.#hasExtendedFields()) {
			valueSizeBits += 5;

			if (this.#descriptor.attachedStructure) {
				valueSizeBits += this.#structureSizeBits();
			}

			if (this.#shouldWriteActiveDecodeTargetsBitmask()) {
				valueSizeBits += this.#structure.decodeTargetCount;
			}
		}

		return valueSizeBits;
	}

	/**
	 * Write the descriptor into the given buffer, whose length must be the one
	 * given by {@link valueSizeBits} rounded up to bytes.
	 */
	write(data: Uint8Array): void {
		this.#writer = new BitBufferWriter(data);

		this.#writeMandatoryFields();

		if (this.#hasExtendedFields()) {
			this.#writeExtendedFields();
			this.#writeFrameDependencyDefinition();
		}

		// Zero remaining bits.
		this.#writer.zeroBits(this.#writer.remainingBitCount());
	}

	#structureSizeBits(): number {
		const { decodeTargetCount, chainCount, templates, resolutions } =
			this.#structure;
		// Template id offset (6 bits) and number of decode targets (5 bits).
		let bits = 11;

		// Template layers.
		bits += 2 * templates.length;
		// DTIs.
		bits += 2 * templates.length * decodeTargetCount;
		// FDIFFs. Each template uses 1 + 5 * number of frame diffs bits.
		bits += templates.length;

		for (const frameTemplate of templates) {
			bits += 5 * frameTemplate.frameDiffs.length;
		}

		bits += BitBufferWriter.sizeNonSymmetricBits(
			chainCount,
			decodeTargetCount + 1
		);

		if (chainCount > 0) {
			for (const protectedBy of this.#structure.decodeTargetProtectedByChain) {
				bits += BitBufferWriter.sizeNonSymmetricBits(protectedBy, chainCount);
			}

			bits += 4 * templates.length * chainCount;
		}

		// Resolutions.
		bits += 1 + 32 * resolutions.length;

		return bits;
	}

	#calculateMatch(templateIndex: number): TemplateMatch {
		const frameTemplate = this.#structure.templates[templateIndex]!;
		const frameDependencies = this.#frameDependencies;
		const needCustomFdiffs = !areNumberArraysEqual(
			frameDependencies.frameDiffs,
			frameTemplate.frameDiffs
		);
		const needCustomDtis = !areNumberArraysEqual(
			frameDependencies.decodeTargetIndications,
			frameTemplate.decodeTargetIndications
		);
		let needCustomChains = false;

		for (let idx = 0; idx < this.#structure.chainCount; ++idx) {
			if (
				this.#isChainActive(idx) &&
				frameDependencies.chainDiffs[idx] !== frameTemplate.chainDiffs[idx]
			) {
				needCustomChains = true;

				break;
			}
		}

		let extraSizeBits = 0;

		if (needCustomFdiffs) {
			extraSizeBits += 2 * (1 + frameDependencies.frameDiffs.length);

			for (const fdiff of frameDependencies.frameDiffs) {
				if (fdiff <= 1 << 4) {
					extraSizeBits += 4;
				} else if (fdiff <= 1 << 8) {
					extraSizeBits += 8;
				} else {
					extraSizeBits += 12;
				}
			}
		}

		if (needCustomDtis) {
			extraSizeBits += 2 * frameDependencies.decodeTargetIndications.length;
		}

		if (needCustomChains) {
			extraSizeBits += 8 * this.#structure.chainCount;
		}

		return {
			templateIndex,
			needCustomDtis,
			needCustomFdiffs,
			needCustomChains,
			extraSizeBits,
		};
	}

	/**
	 * @throws
	 * - `TypeError` if any frame diff, or chain diff of an active chain, is
	 *   outside of the range that can be written.
	 */
	#assertSerializableDiffs(): void {
		for (const fdiff of this.#frameDependencies.frameDiffs) {
			if (!isUnsignedInteger(fdiff, MAX_FRAME_DIFF) || fdiff === 0) {
				throw new TypeError(
					`frameDiffs values must be integers between 1 and ${MAX_FRAME_DIFF}`
				);
			}
		}

		for (let idx = 0; idx < this.#structure.chainCount; ++idx) {
			// Chain diffs of inactive chains are not written, see
			// #writeFrameChains().
			if (
				this.#isChainActive(idx) &&
				!isUnsignedInteger(
					this.#frameDependencies.chainDiffs[idx]!,
					MAX_CHAIN_DIFF
				)
			) {
				throw new TypeError(
					`chainDiffs values of active chains must be integers between 0 and ${MAX_CHAIN_DIFF}`
				);
			}
		}
	}

	/**
	 * @throws
	 * - `TypeError` if no template has the spatial id and temporal id of the
	 *   frame.
	 */
	#findBestTemplate(): TemplateMatch {
		const templates = this.#structure.templates;
		const { spatialId, temporalId } = this.#frameDependencies;

		function isSameLayer(frameTemplate: DependencyDescriptorTemplate): boolean {
			return (
				frameTemplate.spatialId === spatialId &&
				frameTemplate.temporalId === temporalId
			);
		}

		// Find range of templates with matching spatial id and temporal id.
		const first = templates.findIndex(isSameLayer);

		if (first === -1) {
			throw new TypeError(
				`no template with spatialId ${spatialId} and temporalId ${temporalId}`
			);
		}

		let bestTemplate = this.#calculateMatch(first);

		// Search if there is any better template than the first one.
		for (
			let idx = first + 1;
			idx < templates.length && isSameLayer(templates[idx]!);
			++idx
		) {
			const match = this.#calculateMatch(idx);

			if (match.extraSizeBits < bestTemplate.extraSizeBits) {
				bestTemplate = match;
			}
		}

		return bestTemplate;
	}

	#shouldWriteActiveDecodeTargetsBitmask(): boolean {
		const { activeDecodeTargetsBitmask, attachedStructure } = this.#descriptor;

		if (activeDecodeTargetsBitmask === undefined) {
			return false;
		}

		const allDecodeTargetsBitmask = 2 ** this.#structure.decodeTargetCount - 1;

		if (
			attachedStructure &&
			activeDecodeTargetsBitmask === allDecodeTargetsBitmask
		) {
			return false;
		}

		return true;
	}

	#hasExtendedFields(): boolean {
		return (
			this.#bestTemplate.extraSizeBits > 0 ||
			this.#descriptor.attachedStructure !== undefined ||
			this.#descriptor.activeDecodeTargetsBitmask !== undefined
		);
	}

	#templateId(): number {
		return (
			(this.#bestTemplate.templateIndex + this.#structure.templateIdOffset) %
			MAX_TEMPLATES
		);
	}

	#isChainActive(chainIdx: number): boolean {
		return Math.floor(this.#activeChainsBitmask / 2 ** chainIdx) % 2 === 1;
	}

	#writeBits(value: number, bitCount: number): void {
		this.#writer!.writeBits(value, bitCount);
	}

	#writeNonSymmetric(value: number, numValues: number): void {
		this.#writer!.writeNonSymmetric(value, numValues);
	}

	#writeTemplateDependencyStructure(): void {
		const { templateIdOffset, decodeTargetCount, resolutions } =
			this.#structure;

		this.#writeBits(templateIdOffset, 6);
		this.#writeBits(decodeTargetCount - 1, 5);
		this.#writeTemplateLayers();
		this.#writeTemplateDtis();
		this.#writeTemplateFdiffs();
		this.#writeTemplateChains();

		const hasResolutions = resolutions.length > 0;

		this.#writeBits(hasResolutions ? 1 : 0, 1);

		if (hasResolutions) {
			this.#writeResolutions();
		}
	}

	#writeTemplateLayers(): void {
		const templates = this.#structure.templates;

		for (let idx = 1; idx < templates.length; ++idx) {
			this.#writeBits(
				getNextLayerIdc(templates[idx - 1]!, templates[idx]!)!,
				2
			);
		}

		this.#writeBits(NextLayerIdc.NO_MORE_TEMPLATES, 2);
	}

	#writeTemplateDtis(): void {
		for (const frameTemplate of this.#structure.templates) {
			for (const dti of frameTemplate.decodeTargetIndications) {
				this.#writeBits(dti, 2);
			}
		}
	}

	#writeTemplateFdiffs(): void {
		for (const frameTemplate of this.#structure.templates) {
			for (const fdiff of frameTemplate.frameDiffs) {
				// fdiff_follows_flag (1) and fdiff_minus_one.
				this.#writeBits((1 << 4) | (fdiff - 1), 1 + 4);
			}

			// No more diffs for current template.
			this.#writeBits(0, 1);
		}
	}

	#writeTemplateChains(): void {
		const {
			decodeTargetCount,
			chainCount,
			decodeTargetProtectedByChain,
			templates,
		} = this.#structure;

		this.#writeNonSymmetric(chainCount, decodeTargetCount + 1);

		if (chainCount === 0) {
			return;
		}

		for (const protectedBy of decodeTargetProtectedByChain) {
			this.#writeNonSymmetric(protectedBy, chainCount);
		}

		for (const frameTemplate of templates) {
			for (const chainDiff of frameTemplate.chainDiffs) {
				this.#writeBits(chainDiff, 4);
			}
		}
	}

	#writeResolutions(): void {
		for (const { width, height } of this.#structure.resolutions) {
			this.#writeBits(width - 1, 16);
			this.#writeBits(height - 1, 16);
		}
	}

	#writeMandatoryFields(): void {
		this.#writeBits(this.#descriptor.startOfFrame ? 1 : 0, 1);
		this.#writeBits(this.#descriptor.endOfFrame ? 1 : 0, 1);
		this.#writeBits(this.#templateId(), 6);
		this.#writeBits(this.#descriptor.frameNumber, 16);
	}

	#writeExtendedFields(): void {
		const templateDependencyStructurePresent =
			this.#descriptor.attachedStructure !== undefined;
		const activeDecodeTargetsPresent =
			this.#shouldWriteActiveDecodeTargetsBitmask();

		this.#writeBits(templateDependencyStructurePresent ? 1 : 0, 1);
		this.#writeBits(activeDecodeTargetsPresent ? 1 : 0, 1);
		this.#writeBits(this.#bestTemplate.needCustomDtis ? 1 : 0, 1);
		this.#writeBits(this.#bestTemplate.needCustomFdiffs ? 1 : 0, 1);
		this.#writeBits(this.#bestTemplate.needCustomChains ? 1 : 0, 1);

		if (templateDependencyStructurePresent) {
			this.#writeTemplateDependencyStructure();
		}

		if (activeDecodeTargetsPresent) {
			this.#writeBits(
				this.#descriptor.activeDecodeTargetsBitmask!,
				this.#structure.decodeTargetCount
			);
		}
	}

	#writeFrameDependencyDefinition(): void {
		if (this.#bestTemplate.needCustomDtis) {
			this.#writeFrameDtis();
		}

		if (this.#bestTemplate.needCustomFdiffs) {
			this.#writeFrameFdiffs();
		}

		if (this.#bestTemplate.needCustomChains) {
			this.#writeFrameChains();
		}
	}

	#writeFrameDtis(): void {
		for (const dti of this.#frameDependencies.decodeTargetIndications) {
			this.#writeBits(dti, 2);
		}
	}

	#writeFrameFdiffs(): void {
		for (const fdiff of this.#frameDependencies.frameDiffs) {
			// next_fdiff_size (in 4 bits units) and fdiff_minus_one.
			if (fdiff <= 1 << 4) {
				this.#writeBits((1 << 4) | (fdiff - 1), 2 + 4);
			} else if (fdiff <= 1 << 8) {
				this.#writeBits((2 << 8) | (fdiff - 1), 2 + 8);
			} else {
				this.#writeBits((3 << 12) | (fdiff - 1), 2 + 12);
			}
		}

		// No more diffs.
		this.#writeBits(0, 2);
	}

	#writeFrameChains(): void {
		for (let idx = 0; idx < this.#structure.chainCount; ++idx) {
			const chainDiff = this.#isChainActive(idx)
				? this.#frameDependencies.chainDiffs[idx]!
				: 0;

			this.#writeBits(chainDiff, 8);
		}
	}
}
