/**
 * Utilities.
 *
 * ```ts
 * import {
 *   type Ntp,
 *   timeUsToNtp,
 *   ntpToTimeUs,
 *   ntpToCompactNtp,
 *   timeUsToCompactNtpInterval,
 *   compactNtpIntervalToTimeUs,
 *   compactNtpRttToTimeUs,
 *   timeUsToAbsSendTime,
 *   absSendTimeToTimeUs,
 *   timeUsToQ32x32,
 *   q32x32ToTimeUs,
 * } from 'rtp.js/utils';
 * ```
 *
 * @packageDocumentation
 */

export { type Ntp } from './types';

export {
	timeUsToNtp,
	ntpToTimeUs,
	ntpToCompactNtp,
	timeUsToCompactNtpInterval,
	compactNtpIntervalToTimeUs,
	compactNtpRttToTimeUs,
	timeUsToAbsSendTime,
	absSendTimeToTimeUs,
	timeUsToQ32x32,
	q32x32ToTimeUs,
} from './time';
