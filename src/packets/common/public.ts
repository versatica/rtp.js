/**
 * Common classes and types of RTP and RTCP packets.
 *
 * ```ts
 * import {
 *   type SerializableDump,
 *   type Serializable,
 * } from 'rtp.js/packets/common';
 * ```
 *
 * @packageDocumentation
 */

// NOTE: We need to export Serializable, otherwise TypeDoc doesn't document
// inherited methods.
export { type SerializableDump, type Serializable } from './Serializable.js';
