/**
 * RTP packet and extensions.
 *
 * ```ts
 * import {
 *   type RtpPacketDump,
 *   type RtpPacketDumpOptions,
 *   isRtp,
 *   RtpPacket,
 *   type ExtensionsForm,
 *   ExtensionType,
 *   type ExtensionMapping,
 *   type SsrcAudioLevelExtension,
 *   type VideoOrientationExtension,
 *   type PlayoutDelayExtension,
 *   type AbsCaptureTimeExtension,
 *   extensionUriToType,
 *   DependencyDescriptorDecodeTargetIndication,
 *   type DependencyDescriptorRenderResolution,
 *   type DependencyDescriptorTemplate,
 *   type DependencyDescriptorStructure,
 *   type DependencyDescriptorMandatoryFields,
 *   type DependencyDescriptorExtension,
 *   type DependencyDescriptorDecodeTargetLayer,
 *   getDependencyDescriptorDecodeTargetLayers,
 *   DependencyDescriptorContext,
 * } from 'rtp.js/packets/RTP';
 * ```
 *
 * @packageDocumentation
 */

export {
	type RtpPacketDump,
	type RtpPacketDumpOptions,
	isRtp,
	RtpPacket,
} from './RtpPacket';

export {
	type ExtensionsForm,
	ExtensionType,
	type ExtensionMapping,
	type SsrcAudioLevelExtension,
	type VideoOrientationExtension,
	type PlayoutDelayExtension,
	type AbsCaptureTimeExtension,
	extensionUriToType,
} from './extensions';

export {
	DependencyDescriptorDecodeTargetIndication,
	type DependencyDescriptorRenderResolution,
	type DependencyDescriptorTemplate,
	type DependencyDescriptorStructure,
	type DependencyDescriptorMandatoryFields,
	type DependencyDescriptorExtension,
	type DependencyDescriptorDecodeTargetLayer,
	getDependencyDescriptorDecodeTargetLayers,
	DependencyDescriptorContext,
} from './dependencyDescriptor';
