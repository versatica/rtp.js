import type { Ntp } from './types';

/**
 * NTP fractional unit.
 */
const NTP_FRACTIONAL_UNIT = 2 ** 32;

/**
 * Minimum round trip time (in microseconds).
 */
const MIN_RTT_US = 1000;

/**
 * Period (in microseconds) after which the 24 bits of the `abs-send-time` RTP
 * header extension wrap around.
 */
const ABS_SEND_TIME_WRAP_PERIOD_US = 64 * 1000000;

/**
 * The seconds of the Q32.32 format are 32 bits wide, so from here on (in
 * microseconds, positive or negative) a time does not fit.
 */
const Q32X32_OUT_OF_RANGE_US = 2 ** 31 * 1000000;

/**
 * Convert microseconds into an NTP timestamp.
 *
 * @internal
 */
export function timeUsToNtp(timeUs: number): Ntp {
	// NOTE: The truncation of the seconds is intended. Seconds are 32 bits wide
	// in NTP, so they wrap every 2^32 seconds since Jan 1, 1900, being Feb 7,
	// 2036 the next time it happens. That is the NTP era and receivers deal with
	// it by doing modular arithmetic, so there is nothing to protect against
	// here.
	const remainderUs = timeUs % 1000000;

	return {
		seconds: ((timeUs - remainderUs) / 1000000) >>> 0,
		fractions: ((remainderUs / 1000000) * NTP_FRACTIONAL_UNIT) >>> 0,
	};
}

/**
 * Convert an NTP timestamp into microseconds.
 *
 * @internal
 */
export function ntpToTimeUs(ntp: Ntp): number {
	return (
		ntp.seconds * 1000000 +
		Math.round((ntp.fractions * 1000000) / NTP_FRACTIONAL_UNIT)
	);
}

/**
 * Convert an NTP timestamp into its compact NTP representation (the middle 32
 * bits of the NTP timestamp, so 1/65536 seconds units).
 *
 * @internal
 */
export function ntpToCompactNtp(ntp: Ntp): number {
	return ((ntp.seconds << 16) | (ntp.fractions >>> 16)) >>> 0;
}

/**
 * Convert an interval in compact NTP representation (the middle 32 bits of an
 * NTP timestamp, so 1/65536 seconds units) into microseconds.
 *
 * @remarks
 * - The interval is usually the difference between two compact NTP
 *   timestamps, which wraps around every 65536 seconds. Values above
 *   0x80000000 are hence taken as negative intervals rather than as intervals
 *   of more than 32768 seconds.
 * - The result is rounded to the nearest microsecond, halves upwards.
 *
 * @internal
 */
export function compactNtpIntervalToTimeUs(compactNtpInterval: number): number {
	let value = compactNtpInterval;

	if (compactNtpInterval > 0x80000000) {
		value -= 0x100000000;
	}

	// NOTE: Flooring a negative value rounds towards negative infinity, so
	// adding half the divisor first rounds to the nearest value. The division
	// is by a power of 2, so it is exact.
	return Math.floor((value * 1000000 + 32768) / 65536);
}

/**
 * Convert a round trip time in compact NTP representation into microseconds.
 *
 * @remarks
 * - A non-monotonic clock can make the round trip time negative, so a
 *   negative value, as well as one too small to be true, is returned as 1000
 *   microseconds.
 *
 * @internal
 */
export function compactNtpRttToTimeUs(compactNtpRtt: number): number {
	return Math.max(compactNtpIntervalToTimeUs(compactNtpRtt), MIN_RTT_US);
}

/**
 * Convert microseconds into the 6.18 fixed point seconds of the
 * `abs-send-time` RTP header extension, whose resolution is hence 1/262144 of
 * a second.
 *
 * @internal
 */
export function timeUsToAbsSendTime(timeUs: number): number {
	// NOTE: Bring the given time into the period first. This keeps the
	// multiplication below within the range of integers that a number holds
	// exactly, and makes a negative time return the same value as the positive
	// time it's congruent with rather than a meaningless one.
	const wrappedUs =
		((timeUs % ABS_SEND_TIME_WRAP_PERIOD_US) + ABS_SEND_TIME_WRAP_PERIOD_US) %
		ABS_SEND_TIME_WRAP_PERIOD_US;

	return Math.floor((wrappedUs * 262144 + 500000) / 1000000) & 0xffffff;
}

/**
 * Convert microseconds into signed Q32.32 fixed point seconds, which is how
 * the `abs-capture-time` RTP header extension encodes its clock offset, being
 * the capture timestamp itself unsigned instead (UQ32.32).
 *
 * @remarks
 * - The result is given as an {@link Ntp} whose `seconds` is the signed 32
 *   bits integer part and whose `fractions` is the unsigned 32 bits
 *   fractional part (so -0.25 seconds is `{ seconds: -1, fractions:
 *   0xc0000000 }`).
 *
 * @returns `undefined` if the given instant does not fit in the format, whose
 *   seconds are 32 bits wide.
 *
 * @see
 * - [draft-ietf-avtcore-abs-capture-time-00](https://datatracker.ietf.org/doc/html/draft-ietf-avtcore-abs-capture-time-00)
 *
 * @internal
 */
export function timeUsToQ32x32(timeUs: number): Ntp | undefined {
	if (timeUs >= Q32X32_OUT_OF_RANGE_US || timeUs <= -Q32X32_OUT_OF_RANGE_US) {
		return undefined;
	}

	const fixedPoint = timeUs * (NTP_FRACTIONAL_UNIT / 1000000);
	// NOTE: Halves are rounded away from zero.
	const q32x32 = Math.sign(fixedPoint) * Math.round(Math.abs(fixedPoint));
	// NOTE: The division is by a power of 2 and the result of the subtraction
	// is an integer below 2^32, so both are exact even if the value itself is beyond
	// the range of integers that a number holds exactly.
	const seconds = Math.floor(q32x32 / NTP_FRACTIONAL_UNIT);

	return { seconds, fractions: q32x32 - seconds * NTP_FRACTIONAL_UNIT };
}

/**
 * Convert signed Q32.32 fixed point seconds (given as described in
 * {@link timeUsToQ32x32}) into microseconds.
 *
 * @see
 * - [draft-ietf-avtcore-abs-capture-time-00](https://datatracker.ietf.org/doc/html/draft-ietf-avtcore-abs-capture-time-00)
 *
 * @internal
 */
export function q32x32ToTimeUs(q32x32: Ntp): number {
	const fixedPoint =
		(q32x32.seconds * NTP_FRACTIONAL_UNIT + q32x32.fractions) *
		(1000000 / NTP_FRACTIONAL_UNIT);

	// NOTE: Halves are rounded away from zero.
	return Math.sign(fixedPoint) * Math.round(Math.abs(fixedPoint));
}
