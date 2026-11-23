import {
	DependencyDescriptorDecodeTargetIndication,
	type DependencyDescriptorTemplate,
	type DependencyDescriptorStructure,
	type DependencyDescriptorExtension,
	DependencyDescriptorContext,
	getDependencyDescriptorDecodeTargetLayers,
	readDependencyDescriptor,
	writeDependencyDescriptor,
} from '../../../packets/RTP/dependencyDescriptor';
import { RtpPacket } from '../../../packets/RTP/RtpPacket';
import { ExtensionType } from '../../../packets/RTP/extensions';
import { factoryBuffer, resetBuffers } from '../../testHelpers';

const { NOT_PRESENT, DISCARDABLE, SWITCH, REQUIRED } =
	DependencyDescriptorDecodeTargetIndication;

/**
 * All chains are active.
 */
const ALL_CHAINS_ACTIVE = 0xffffffff;

/**
 * Key frame of an L1T2 stream (2 decode targets, 1 chain), frame number 232,
 * carrying its template dependency structure.
 */
// prettier-ignore
const L1T2_KEY_FRAME = new Uint8Array([
	0x80, 0x00, 0xe8, 0x80,
	0x01, 0x1e, 0xa8, 0x51,
	0x41, 0x01, 0x0c, 0x13,
	0xfc, 0x0b, 0x3c,
]);

beforeEach(resetBuffers);

/**
 * Template dependency structure as libwebrtc tests build it, where fields
 * not given are 0 or empty.
 */
function createStructure(
	structure: Partial<DependencyDescriptorStructure>
): DependencyDescriptorStructure {
	return {
		templateIdOffset: 0,
		decodeTargetCount: 0,
		chainCount: 0,
		decodeTargetProtectedByChain: [],
		resolutions: [],
		templates: [],
		...structure,
	};
}

/**
 * Frame dependency template as libwebrtc tests build it, where fields not
 * given are 0 or empty.
 */
function createTemplate(
	frameTemplate: Partial<DependencyDescriptorTemplate>
): DependencyDescriptorTemplate {
	return {
		spatialId: 0,
		temporalId: 0,
		decodeTargetIndications: [],
		frameDiffs: [],
		chainDiffs: [],
		...frameTemplate,
	};
}

/**
 * Descriptor of a frame using the given template, as libwebrtc tests build
 * it (first and last packet of the frame, frame number 0).
 */
function createDescriptor(
	frameTemplate: DependencyDescriptorTemplate
): Omit<DependencyDescriptorExtension, 'isKeyFrame'> {
	return {
		startOfFrame: true,
		endOfFrame: true,
		frameNumber: 0,
		frameDependencies: {
			...frameTemplate,
			decodeTargetIndications: frameTemplate.decodeTargetIndications.slice(),
			frameDiffs: frameTemplate.frameDiffs.slice(),
			chainDiffs: frameTemplate.chainDiffs.slice(),
		},
	};
}

/**
 * Context whose template dependency structure in use is the given one.
 */
function createContext(
	structure: DependencyDescriptorStructure
): DependencyDescriptorContext {
	const context = new DependencyDescriptorContext();

	context.setStructure(structure, 0);

	return context;
}

describe('Dependency Descriptor', () => {
	/* Ported from libwebrtc rtp_dependency_descriptor_extension_unittest.cc. */

	test('writer uses 3 bytes for a perfect template', () => {
		const structure = createStructure({
			decodeTargetCount: 2,
			chainCount: 2,
			templates: [
				createTemplate({
					decodeTargetIndications: [SWITCH, REQUIRED],
					frameDiffs: [1],
					chainDiffs: [2, 2],
				}),
			],
		});
		const descriptor = createDescriptor(structure.templates[0]!);

		expect(
			writeDependencyDescriptor(descriptor, structure, ALL_CHAINS_ACTIVE)
				.byteLength
		).toBe(3);
	});

	test('writer writes zero in unused bits', () => {
		const structure = createStructure({
			decodeTargetCount: 2,
			chainCount: 2,
			templates: [
				createTemplate({
					decodeTargetIndications: [SWITCH, REQUIRED],
					frameDiffs: [1],
					chainDiffs: [1, 1],
				}),
			],
		});
		const descriptor = createDescriptor(structure.templates[0]!);

		// NOTE: libwebrtc writes into a buffer filled with 0xff. Here the buffer is
		// shared by every call, so a previous descriptor with every frame field
		// custom leaves non zero bits in it.
		const dirtyDescriptor = createDescriptor(structure.templates[0]!);

		dirtyDescriptor.frameNumber = 0xffff;
		dirtyDescriptor.frameDependencies!.decodeTargetIndications = [
			REQUIRED,
			REQUIRED,
		];
		dirtyDescriptor.frameDependencies!.frameDiffs = [0xfff, 0xfff];
		dirtyDescriptor.frameDependencies!.chainDiffs = [0xff, 0xff];

		writeDependencyDescriptor(dirtyDescriptor, structure, ALL_CHAINS_ACTIVE);

		descriptor.frameDependencies!.frameDiffs = [2];

		const data = writeDependencyDescriptor(
			descriptor,
			structure,
			ALL_CHAINS_ACTIVE
		);

		// 24 bits of mandatory fields, 5 bits of extended fields flags and 8 bits
		// of custom frame diffs (2 + 4 for the frame diff and 2 to end the list),
		// so the last 3 bits of the 5 bytes are unused.
		expect(data.byteLength).toBe(5);
		expect(data[4]! & 0b00000111).toBe(0);
	});

	// In practice chain diff for inactive chain will grow unboundedly because no
	// frames are produced for it, that shouldn't block writing the extension.
	test('template matching skips inactive chains', () => {
		const structure = createStructure({
			decodeTargetCount: 2,
			chainCount: 2,
			templates: [
				createTemplate({
					decodeTargetIndications: [SWITCH, REQUIRED],
					chainDiffs: [2, 2],
				}),
			],
		});
		const descriptor = createDescriptor(structure.templates[0]!);

		// Set only 1st chain as active.
		const activeChainsBitmask = 0b01;

		descriptor.frameDependencies!.chainDiffs[1] = 1000;

		// Expect perfect template match since the only difference is for an
		// inactive chain. Perfect template match consumes 3 bytes.
		expect(
			writeDependencyDescriptor(descriptor, structure, activeChainsBitmask)
				.byteLength
		).toBe(3);
	});

	test('accepts invalid chain diff for inactive chain when chains are custom', () => {
		const structure = createStructure({
			decodeTargetCount: 2,
			chainCount: 2,
			templates: [
				createTemplate({
					decodeTargetIndications: [SWITCH, REQUIRED],
					chainDiffs: [2, 2],
				}),
			],
		});
		const descriptor = createDescriptor(structure.templates[0]!);

		// Set only 1st chain as active.
		const activeChainsBitmask = 0b01;

		// Set chain diff different to the template to make it custom.
		descriptor.frameDependencies!.chainDiffs[0] = 1;
		// Set chain diff for inactive chain beyond limit of 255 max chain diff.
		descriptor.frameDependencies!.chainDiffs[1] = 1000;

		// Because chains are custom, should use more than base 3 bytes.
		expect(
			writeDependencyDescriptor(descriptor, structure, activeChainsBitmask)
				.byteLength
		).toBeGreaterThan(3);
	});

	test('fails to write invalid descriptor', () => {
		const structure = createStructure({
			decodeTargetCount: 2,
			chainCount: 2,
			templates: [
				createTemplate({
					temporalId: 0,
					decodeTargetIndications: [SWITCH, REQUIRED],
					chainDiffs: [2, 2],
				}),
			],
		});
		const descriptor = createDescriptor(structure.templates[0]!);

		descriptor.frameDependencies!.temporalId = 1;

		expect(() =>
			writeDependencyDescriptor(descriptor, structure, 0b11)
		).toThrow(TypeError);
	});

	test('fails to write when number of chains mismatch', () => {
		const structure = createStructure({
			decodeTargetCount: 2,
			chainCount: 2,
			templates: [
				createTemplate({
					temporalId: 0,
					decodeTargetIndications: [SWITCH, REQUIRED],
					chainDiffs: [2, 2],
				}),
			],
		});
		const descriptor = createDescriptor(structure.templates[0]!);

		// Structure has 2 chains, but frame provides 1 chain diff.
		descriptor.frameDependencies!.chainDiffs = [2];

		expect(() =>
			writeDependencyDescriptor(descriptor, structure, 0b11)
		).toThrow(TypeError);
	});

	test('fails to write when number of decode targets mismatch', () => {
		const structure = createStructure({
			decodeTargetCount: 2,
			chainCount: 2,
			templates: [
				createTemplate({
					temporalId: 0,
					decodeTargetIndications: [SWITCH, REQUIRED],
					chainDiffs: [2, 2],
				}),
			],
		});
		const descriptor = createDescriptor(structure.templates[0]!);

		// Structure has 2 decode targets, but frame provides 1 indication.
		descriptor.frameDependencies!.decodeTargetIndications = [SWITCH];

		expect(() =>
			writeDependencyDescriptor(descriptor, structure, 0b11)
		).toThrow(TypeError);
	});

	// The largest frame diff the dependency descriptor can represent is 4096.
	test('fails to write too large frame diff', () => {
		const structure = createStructure({
			decodeTargetCount: 1,
			templates: [createTemplate({ decodeTargetIndications: [SWITCH] })],
		});
		const descriptor = createDescriptor(structure.templates[0]!);

		descriptor.frameDependencies!.frameDiffs = [5275];

		expect(() =>
			writeDependencyDescriptor(descriptor, structure, ALL_CHAINS_ACTIVE)
		).toThrow(TypeError);
	});

	test('fails to write non positive frame diff', () => {
		const structure = createStructure({
			decodeTargetCount: 1,
			templates: [createTemplate({ decodeTargetIndications: [SWITCH] })],
		});

		for (const fdiff of [0, -1]) {
			const descriptor = createDescriptor(structure.templates[0]!);

			descriptor.frameDependencies!.frameDiffs = [fdiff];

			expect(() =>
				writeDependencyDescriptor(descriptor, structure, ALL_CHAINS_ACTIVE)
			).toThrow(TypeError);
		}
	});

	// Chain diffs of active chains must be in the range [0, 255].
	test('fails to write invalid chain diff for active chain', () => {
		const structure = createStructure({
			decodeTargetCount: 1,
			chainCount: 1,
			decodeTargetProtectedByChain: [0],
			templates: [
				createTemplate({ decodeTargetIndications: [SWITCH], chainDiffs: [1] }),
			],
		});

		for (const chainDiff of [-1, 256]) {
			const descriptor = createDescriptor(structure.templates[0]!);

			descriptor.frameDependencies!.chainDiffs = [chainDiff];

			expect(() =>
				writeDependencyDescriptor(descriptor, structure, ALL_CHAINS_ACTIVE)
			).toThrow(TypeError);
		}
	});

	test('round trips frame diffs up to limit', () => {
		const structure = createStructure({
			decodeTargetCount: 1,
			templates: [createTemplate({ decodeTargetIndications: [SWITCH] })],
		});

		// Boundaries of the 4, 8 and 12 bits representations of a frame diff.
		for (const fdiff of [1, 16, 17, 256, 257, 4096]) {
			const descriptor = createDescriptor(structure.templates[0]!);

			descriptor.frameDependencies!.frameDiffs = [fdiff];

			const data = writeDependencyDescriptor(
				descriptor,
				structure,
				ALL_CHAINS_ACTIVE
			);

			expect(data.byteLength).toBeGreaterThan(0);
			expect(data.byteLength).toBeLessThanOrEqual(16);

			const parsed = readDependencyDescriptor(
				data,
				createContext(structure),
				/* updateContext */ true
			);

			expect(parsed?.frameDependencies?.frameDiffs).toEqual([fdiff]);
		}
	});

	test('round trips chain diff up to limit', () => {
		const structure = createStructure({
			decodeTargetCount: 1,
			chainCount: 1,
			decodeTargetProtectedByChain: [0],
			templates: [
				createTemplate({ decodeTargetIndications: [SWITCH], chainDiffs: [1] }),
			],
		});
		const descriptor = createDescriptor(structure.templates[0]!);

		descriptor.frameDependencies!.chainDiffs = [255];

		const data = writeDependencyDescriptor(
			descriptor,
			structure,
			ALL_CHAINS_ACTIVE
		);

		expect(data.byteLength).toBeGreaterThan(0);
		expect(data.byteLength).toBeLessThanOrEqual(16);

		const parsed = readDependencyDescriptor(
			data,
			createContext(structure),
			/* updateContext */ true
		);

		expect(parsed?.frameDependencies?.chainDiffs).toEqual([255]);
	});

	/* Ported from mediasoup TestDependencyDescriptor.cpp (reading only). */

	test('parse a descriptor generated by Chrome', () => {
		// Taken from https://issues.webrtc.org/issues/42225660.
		// prettier-ignore
		const data = new Uint8Array([
			0x80, 0x01, 0x2f, 0x80, 0x02, 0x14, 0xea, 0xa8,
			0x60, 0x41, 0x4d, 0x14, 0x10, 0x20, 0x84, 0x26,
		]);
		const context = new DependencyDescriptorContext();
		const descriptor = readDependencyDescriptor(
			data,
			context,
			/* updateContext */ true
		);

		expect(descriptor).toBeDefined();
		expect(descriptor!.startOfFrame).toBe(true);
		expect(descriptor!.endOfFrame).toBe(false);
		expect(descriptor!.frameNumber).toBe(303);
		expect(descriptor!.isKeyFrame).toBe(true);

		const structure = descriptor!.attachedStructure!;

		expect(structure).toBeDefined();
		expect(context.getStructure()).toBe(structure);
		expect(structure.templateIdOffset).toBe(0);
		expect(structure.decodeTargetCount).toBe(3);
		expect(structure.chainCount).toBe(1);
		expect(structure.decodeTargetProtectedByChain).toEqual([0, 0, 0]);
		expect(structure.templates).toEqual([
			{
				spatialId: 0,
				temporalId: 0,
				decodeTargetIndications: [SWITCH, SWITCH, SWITCH],
				frameDiffs: [],
				chainDiffs: [0],
			},
			{
				spatialId: 0,
				temporalId: 0,
				decodeTargetIndications: [SWITCH, SWITCH, SWITCH],
				frameDiffs: [4],
				chainDiffs: [4],
			},
			{
				spatialId: 0,
				temporalId: 1,
				decodeTargetIndications: [NOT_PRESENT, DISCARDABLE, SWITCH],
				frameDiffs: [2],
				chainDiffs: [2],
			},
			{
				spatialId: 0,
				temporalId: 2,
				decodeTargetIndications: [NOT_PRESENT, NOT_PRESENT, DISCARDABLE],
				frameDiffs: [1],
				chainDiffs: [1],
			},
			{
				spatialId: 0,
				temporalId: 2,
				decodeTargetIndications: [NOT_PRESENT, NOT_PRESENT, DISCARDABLE],
				frameDiffs: [1],
				chainDiffs: [3],
			},
		]);
		expect(getDependencyDescriptorDecodeTargetLayers(structure)).toEqual([
			{ spatialId: 0, temporalId: 0 },
			{ spatialId: 0, temporalId: 1 },
			{ spatialId: 0, temporalId: 2 },
		]);
	});

	test('a new template dependency structure replaces the previous one', () => {
		const context = new DependencyDescriptorContext();
		const first = readDependencyDescriptor(
			L1T2_KEY_FRAME,
			context,
			/* updateContext */ true
		);

		expect(first).toBeDefined();
		expect(context.getStructure()).toBe(first!.attachedStructure);

		// A second key frame comes with its own structure.
		const second = readDependencyDescriptor(
			L1T2_KEY_FRAME,
			context,
			/* updateContext */ true
		);

		expect(second).toBeDefined();

		// Which is a brand new one, told apart from the previous one.
		expect(second!.attachedStructure).not.toBe(first!.attachedStructure);
		expect(context.getStructure()).toBe(second!.attachedStructure);

		// And the first descriptor keeps the one it was parsed with.
		expect(first!.attachedStructure!.decodeTargetCount).toBe(2);
	});

	test('a descriptor without structure is parsed with the one of the context', () => {
		// Mandatory fields only, so it depends on the structure of the key frame.
		const deltaFrameData = new Uint8Array([0x00, 0x00, 0xe8]);
		const context = new DependencyDescriptorContext();
		const keyFrame = readDependencyDescriptor(
			L1T2_KEY_FRAME,
			context,
			/* updateContext */ true
		);

		expect(keyFrame).toBeDefined();

		const deltaFrame = readDependencyDescriptor(
			deltaFrameData,
			context,
			/* updateContext */ true
		);

		expect(deltaFrame).toBeDefined();
		expect(deltaFrame!.attachedStructure).toBeUndefined();
		expect(deltaFrame!.frameDependencies).toEqual(
			keyFrame!.attachedStructure!.templates[0]
		);
	});

	test('custom decode target indications, frame diffs and chains are parsed', () => {
		/**
		 * Delta frame of the L1T2 stream carrying every custom frame dependency
		 * field:
		 *
		 *   start_of_frame:                1
		 *   end_of_frame:                  1
		 *   frame_dependency_template_id:  0
		 *   frame_number:                  232
		 *   extended field flags:          structure:0 bitmask:1 dtis:1 fdiffs:1 chains:1
		 *   active_decode_targets_bitmask: 0b11
		 *   custom dtis:                   switch, required
		 *   custom frame diffs:            a single 4 bit one, fdiff_minus_one 5
		 *                                  (frame diff 6)
		 *   custom chains:                 0xa5
		 *
		 * Which takes 51 bits, so the last 5 are zero padding.
		 */
		// prettier-ignore
		const deltaFrameData = new Uint8Array([
			0xc0, 0x00, 0xe8, 0x7f,
			0x6a, 0x94, 0xa0,
		]);
		// The same one with active decode targets bitmask 0b01.
		// prettier-ignore
		const rewrittenData = new Uint8Array([
			0xc0, 0x00, 0xe8, 0x7b,
			0x6a, 0x94, 0xa0,
		]);
		const context = new DependencyDescriptorContext();

		expect(
			readDependencyDescriptor(
				L1T2_KEY_FRAME,
				context,
				/* updateContext */ true
			)
		).toBeDefined();
		expect(context.getStructure()!.decodeTargetCount).toBe(2);
		expect(context.getStructure()!.chainCount).toBe(1);

		const deltaFrame = readDependencyDescriptor(
			deltaFrameData,
			context,
			/* updateContext */ true
		);

		expect(deltaFrame).toBeDefined();
		expect(deltaFrame!.frameNumber).toBe(232);
		expect(deltaFrame!.activeDecodeTargetsBitmask).toBe(0b11);
		expect(deltaFrame!.frameDependencies!.decodeTargetIndications).toEqual([
			SWITCH,
			REQUIRED,
		]);
		expect(deltaFrame!.frameDependencies!.frameDiffs).toEqual([6]);
		expect(deltaFrame!.frameDependencies!.chainDiffs).toEqual([0xa5]);

		const rewritten = readDependencyDescriptor(
			rewrittenData,
			context,
			/* updateContext */ true
		);

		expect(rewritten).toBeDefined();
		expect(rewritten!.frameNumber).toBe(232);
		expect(rewritten!.activeDecodeTargetsBitmask).toBe(0b01);
	});

	/**
	 * A retransmitted or reordered packet of an old key frame carries the
	 * structure that key frame came with. Taking it would leave every following
	 * packet of the stream parsed with outdated templates until the next key
	 * frame.
	 */
	test('a template dependency structure older than the one in use is ignored', () => {
		// Key frame of an L1T2 stream, frame number 232.
		const oldKeyFrame = L1T2_KEY_FRAME;
		// The same one, frame number 242.
		// prettier-ignore
		const newKeyFrame = new Uint8Array([
			0x80, 0x00, 0xf2, 0x80,
			0x01, 0x1e, 0xa8, 0x51,
			0x41, 0x01, 0x0c, 0x13,
			0xfc, 0x0b, 0x3c,
		]);
		// And frame number 252, in a packet that is not the first one of its
		// frame.
		// prettier-ignore
		const newestKeyFrameNotStartOfFrame = new Uint8Array([
			0x00, 0x00, 0xfc, 0x80,
			0x01, 0x1e, 0xa8, 0x51,
			0x41, 0x01, 0x0c, 0x13,
			0xfc, 0x0b, 0x3c,
		]);
		const context = new DependencyDescriptorContext();

		expect(
			readDependencyDescriptor(oldKeyFrame, context, /* updateContext */ true)
		).toBeDefined();

		const oldStructure = context.getStructure();

		// A newer key frame hands its own structure over.
		expect(
			readDependencyDescriptor(newKeyFrame, context, /* updateContext */ true)
		).toBeDefined();

		const newStructure = context.getStructure();

		expect(newStructure).not.toBe(oldStructure);

		// And the old key frame coming late does not, even though it is parsed
		// fine.
		expect(
			readDependencyDescriptor(oldKeyFrame, context, /* updateContext */ true)
		).toBeDefined();
		expect(context.getStructure()).toBe(newStructure);

		// Neither does a newer one that is not in the first packet of its frame.
		expect(
			readDependencyDescriptor(
				newestKeyFrameNotStartOfFrame,
				context,
				/* updateContext */ true
			)
		).toBeDefined();
		expect(context.getStructure()).toBe(newStructure);
	});

	/* Own tests. */

	test('only the mandatory fields are given if the structure is unknown', () => {
		const context = new DependencyDescriptorContext();
		// Delta frame of the L1T2 stream, frame number 233.
		const descriptor = readDependencyDescriptor(
			new Uint8Array([0x40, 0x00, 0xe9]),
			context,
			/* updateContext */ true
		);

		expect(descriptor).toEqual({
			startOfFrame: false,
			endOfFrame: true,
			frameNumber: 233,
			isKeyFrame: false,
		});
	});

	test('a malformed descriptor is not parsed', () => {
		const context = new DependencyDescriptorContext();

		// Less than the mandatory fields.
		expect(
			readDependencyDescriptor(
				new Uint8Array([0x80, 0x00]),
				context,
				/* updateContext */ true
			)
		).toBeUndefined();

		// A truncated template dependency structure.
		expect(
			readDependencyDescriptor(
				L1T2_KEY_FRAME.subarray(0, 8),
				context,
				/* updateContext */ true
			)
		).toBeUndefined();
		expect(context.getStructure()).toBeUndefined();
	});

	test('every packet of a key frame is a key frame', () => {
		const context = new DependencyDescriptorContext();
		// First packet of the key frame, frame number 232.
		const firstPacket = readDependencyDescriptor(
			L1T2_KEY_FRAME,
			context,
			/* updateContext */ true
		);
		// Last packet of the key frame, without structure.
		const lastPacket = readDependencyDescriptor(
			new Uint8Array([0x40, 0x00, 0xe8]),
			context,
			/* updateContext */ true
		);
		// Next frame, frame number 233.
		const nextFrame = readDependencyDescriptor(
			new Uint8Array([0xc0, 0x00, 0xe9]),
			context,
			/* updateContext */ true
		);

		expect(firstPacket!.isKeyFrame).toBe(true);
		expect(lastPacket!.isKeyFrame).toBe(true);
		expect(nextFrame!.isKeyFrame).toBe(false);
	});

	test('the active decode targets bitmask is valid until the next one', () => {
		const context = new DependencyDescriptorContext();
		const keyFrame = readDependencyDescriptor(
			L1T2_KEY_FRAME,
			context,
			/* updateContext */ true
		);
		const structure = keyFrame!.attachedStructure!;
		const read = (
			frameNumber: number,
			activeDecodeTargetsBitmask?: number
		): DependencyDescriptorExtension | undefined => {
			const data = writeDependencyDescriptor(
				{
					...createDescriptor(structure.templates[0]!),
					frameNumber,
					activeDecodeTargetsBitmask,
				},
				structure,
				ALL_CHAINS_ACTIVE
			);

			return readDependencyDescriptor(
				data.slice(),
				context,
				/* updateContext */ true
			);
		};

		// The key frame carrying the structure makes all decode targets active.
		expect(keyFrame!.activeDecodeTargetsBitmask).toBe(0b11);
		expect(read(233)!.activeDecodeTargetsBitmask).toBe(0b11);

		// A frame carrying a bitmask changes it.
		expect(read(234, 0b01)!.activeDecodeTargetsBitmask).toBe(0b01);

		// It's valid for the following frames that don't carry one.
		expect(read(235)!.activeDecodeTargetsBitmask).toBe(0b01);

		// A bitmask carried by an older frame doesn't replace it.
		expect(read(233, 0b11)!.activeDecodeTargetsBitmask).toBe(0b11);
		expect(read(236)!.activeDecodeTargetsBitmask).toBe(0b01);

		// A new structure makes all decode targets active again.
		// prettier-ignore
		const newKeyFrame = new Uint8Array([
			0x80, 0x01, 0x00, 0x80,
			0x01, 0x1e, 0xa8, 0x51,
			0x41, 0x01, 0x0c, 0x13,
			0xfc, 0x0b, 0x3c,
		]);

		expect(
			readDependencyDescriptor(newKeyFrame, context, /* updateContext */ true)!
				.activeDecodeTargetsBitmask
		).toBe(0b11);
		expect(read(257)!.activeDecodeTargetsBitmask).toBe(0b11);
	});

	test('RtpPacket.setDependencyDescriptorExtension() and RtpPacket.getDependencyDescriptorExtension() succeed', () => {
		const structure = createStructure({
			templateIdOffset: 10,
			decodeTargetCount: 2,
			chainCount: 1,
			decodeTargetProtectedByChain: [0, 0],
			resolutions: [{ width: 640, height: 480 }],
			templates: [
				createTemplate({
					decodeTargetIndications: [SWITCH, SWITCH],
					chainDiffs: [0],
				}),
				createTemplate({
					decodeTargetIndications: [SWITCH, SWITCH],
					frameDiffs: [2],
					chainDiffs: [2],
				}),
				createTemplate({
					temporalId: 1,
					decodeTargetIndications: [NOT_PRESENT, DISCARDABLE],
					frameDiffs: [1],
					chainDiffs: [1],
				}),
			],
		});
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setExtensionMapping({ [ExtensionType.DEPENDENCY_DESCRIPTOR]: 5 });
		packet.setExtensionsForm('two-byte');

		// Key frame carrying the structure.
		packet.setDependencyDescriptorExtension(
			{
				...createDescriptor(structure.templates[0]!),
				frameNumber: 1000,
				attachedStructure: structure,
			},
			structure
		);

		const context = new DependencyDescriptorContext();

		// Dumping doesn't modify the context.
		expect(
			packet.dump({ dependencyDescriptorContext: context })
				.dependencyDescriptorExt
		).toMatchObject({ frameNumber: 1000, isKeyFrame: true });
		expect(context.getStructure()).toBeUndefined();

		// Without context, only the mandatory fields are dumped.
		expect(packet.dump().dependencyDescriptorExt).toEqual({
			startOfFrame: true,
			endOfFrame: true,
			frameNumber: 1000,
		});

		const keyFrame = packet.getDependencyDescriptorExtension(context);

		expect(keyFrame).toBeDefined();
		expect(keyFrame!.isKeyFrame).toBe(true);
		expect(keyFrame!.frameNumber).toBe(1000);
		expect(keyFrame!.resolution).toEqual({ width: 640, height: 480 });
		expect(keyFrame!.activeDecodeTargetsBitmask).toBe(0b11);
		expect(keyFrame!.frameDependencies).toEqual(structure.templates[0]);
		expect(keyFrame!.attachedStructure).toEqual(structure);
		expect(context.getStructure()).toEqual(structure);

		// Delta frame with custom frame diffs and active decode targets.
		packet.setDependencyDescriptorExtension(
			{
				...createDescriptor(structure.templates[2]!),
				startOfFrame: false,
				frameNumber: 1001,
				frameDependencies: {
					...structure.templates[2]!,
					frameDiffs: [1, 300],
				},
				activeDecodeTargetsBitmask: 0b01,
			},
			structure
		);

		const deltaFrame = packet.getDependencyDescriptorExtension(context);

		expect(deltaFrame).toEqual({
			startOfFrame: false,
			endOfFrame: true,
			frameNumber: 1001,
			frameDependencies: {
				spatialId: 0,
				temporalId: 1,
				decodeTargetIndications: [NOT_PRESENT, DISCARDABLE],
				frameDiffs: [1, 300],
				chainDiffs: [1],
			},
			resolution: { width: 640, height: 480 },
			activeDecodeTargetsBitmask: 0b01,
			attachedStructure: undefined,
			isKeyFrame: false,
		});

		// The extension is deleted.
		packet.setDependencyDescriptorExtension(undefined);

		expect(packet.getDependencyDescriptorExtension(context)).toBeUndefined();
	});

	test('RtpPacket.setDependencyDescriptorExtension() throws if the structure is not given', () => {
		const structure = createStructure({
			decodeTargetCount: 1,
			templates: [createTemplate({ decodeTargetIndications: [SWITCH] })],
		});
		const packet = RtpPacket.factory(factoryBuffer);

		packet.setExtensionMapping({ [ExtensionType.DEPENDENCY_DESCRIPTOR]: 5 });

		expect(() =>
			packet.setDependencyDescriptorExtension(
				createDescriptor(structure.templates[0]!)
			)
		).toThrow(TypeError);
	});
});
