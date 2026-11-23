/**
 * RTP packet and extensions.
 *
 * ```ts
 * import {
 *   type RtpPacketDump,
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
 * } from 'rtp.js/packets/RTP';
 * ```
 *
 * @packageDocumentation
 */

export { type RtpPacketDump, isRtp, RtpPacket } from './RtpPacket';

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
