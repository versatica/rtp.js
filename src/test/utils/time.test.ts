import {
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
} from '../../utils/time';

// Middle 32 bits of the given NTP timestamp.
function toCompactNtp(seconds: number, fractions: number): number {
	return ((seconds << 16) | (fractions >>> 16)) >>> 0;
}

function toTimeUs(seconds: number, fractions: number): number {
	return ntpToTimeUs({ seconds, fractions });
}

test('ntpToTimeUs()', () => {
	const nowUs = Math.round(performance.now() * 1000);
	const ntp = timeUsToNtp(nowUs);
	const nowUs2 = ntpToTimeUs(ntp);
	const ntp2 = timeUsToNtp(nowUs2);

	expect(nowUs2).toBe(nowUs);
	expect(ntp2.seconds).toBe(ntp.seconds);
	expect(ntp2.fractions).toBe(ntp.fractions);
});

test('timeUsToNtp()', () => {
	let ntp = timeUsToNtp(1500000);

	expect(ntp.seconds).toBe(1);
	// Half a second in NTP fractional units.
	expect(ntp.fractions).toBe(2147483648);

	// A real NTP instant, seconds since Jan 1, 1900, which still fits in 32 bits.
	ntp = timeUsToNtp(3990000000750000);

	expect(ntp.seconds).toBe(3990000000);
	expect(ntpToTimeUs(ntp)).toBe(3990000000750000);

	// Sub-millisecond times are kept.
	expect(timeUsToNtp(1000500).fractions).toBeGreaterThan(
		timeUsToNtp(1000000).fractions
	);
	expect(timeUsToNtp(1000500).fractions).toBeLessThan(
		timeUsToNtp(1001000).fractions
	);
	expect(ntpToTimeUs(timeUsToNtp(1000500))).toBe(1000500);
});

test('ntpToCompactNtp()', () => {
	// The middle 32 bits of the NTP timestamp.
	expect(ntpToCompactNtp({ seconds: 0x12345678, fractions: 0x9abcdef0 })).toBe(
		0x56789abc
	);
	expect(ntpToCompactNtp({ seconds: 0, fractions: 0 })).toBe(0);
	expect(ntpToCompactNtp({ seconds: 0xffffffff, fractions: 0xffffffff })).toBe(
		0xffffffff
	);

	// One second and a half in 1/65536 seconds units.
	expect(ntpToCompactNtp(timeUsToNtp(1500000))).toBe(0x18000);
});

test('timeUsToCompactNtpInterval()', () => {
	// Converts negative to zero.
	expect(timeUsToCompactNtpInterval(-1)).toBe(0);
	expect(timeUsToCompactNtpInterval(0)).toBe(0);

	// Converts values just above and just below max uint32_t.
	expect(timeUsToCompactNtpInterval(65536000000)).toBe(0xffffffff);
	expect(timeUsToCompactNtpInterval(65535999985)).toBe(0xffffffff);
	expect(timeUsToCompactNtpInterval(65535999970)).toBe(0xfffffffe);

	// Converts half-seconds.
	expect(timeUsToCompactNtpInterval(500000)).toBe(0x8000);
	expect(timeUsToCompactNtpInterval(1000000)).toBe(0x10000);
	expect(timeUsToCompactNtpInterval(1500000)).toBe(0x18000);

	// Convert us -> compact NTP -> us. Compact NTP precision is ~15us.
	for (const us of [1516, 15000, 5485, 5515]) {
		expect(
			Math.abs(compactNtpRttToTimeUs(timeUsToCompactNtpInterval(us)) - us)
		).toBeLessThanOrEqual(16);
	}
});

test('compactNtpIntervalToTimeUs()', () => {
	{
		const diffUs = toTimeUs(0x12654, 0x64335) - toTimeUs(0x12345, 0x23456);
		const compactNtpDiff =
			(toCompactNtp(0x12654, 0x64335) - toCompactNtp(0x12345, 0x23456)) >>> 0;

		expect(
			Math.abs(compactNtpIntervalToTimeUs(compactNtpDiff) - diffUs)
		).toBeLessThanOrEqual(1000);
	}

	// The later timestamp has the lower compact NTP representation, which is
	// fine as long as the difference is computed with unsigned arithmetic.
	{
		const diffUs = toTimeUs(0x20000, 0x64335) - toTimeUs(0x1ffff, 0x23456);

		expect(diffUs).toBeGreaterThan(0);
		expect(toCompactNtp(0x20000, 0x64335)).toBeLessThan(
			toCompactNtp(0x1ffff, 0x23456)
		);

		const compactNtpDiff =
			(toCompactNtp(0x20000, 0x64335) - toCompactNtp(0x1ffff, 0x23456)) >>> 0;

		expect(
			Math.abs(compactNtpIntervalToTimeUs(compactNtpDiff) - diffUs)
		).toBeLessThanOrEqual(1000);
	}

	// A difference close to 2^16 seconds is a negative one.
	{
		const diffUs = toTimeUs(0x1ffff, 0x64335) - toTimeUs(0x20000, 0x23456);

		expect(diffUs).toBeLessThan(0);

		const compactNtpDiff =
			(toCompactNtp(0x1ffff, 0x64335) - toCompactNtp(0x20000, 0x23456)) >>> 0;

		expect(
			Math.abs(compactNtpIntervalToTimeUs(compactNtpDiff) - diffUs)
		).toBeLessThanOrEqual(1000);
	}

	// Right in the middle, both +2^15 and -2^15 seconds are valid results.
	expect(Math.abs(compactNtpIntervalToTimeUs(0x80000000))).toBe(
		0x8000 * 1000000
	);
});

test('compactNtpRttToTimeUs()', () => {
	// A difference close to 2^15 seconds is still a positive one.
	{
		const diffUs = toTimeUs(0x17fff, 0xffff5) - toTimeUs(0x10000, 0x00006);

		expect(Math.abs(diffUs - ((1 << 15) - 1) * 1000000)).toBeLessThanOrEqual(
			1000
		);

		const compactNtpDiff =
			(toCompactNtp(0x17fff, 0xffff5) - toCompactNtp(0x10000, 0x00006)) >>> 0;

		expect(
			Math.abs(compactNtpRttToTimeUs(compactNtpDiff) - diffUs)
		).toBeLessThanOrEqual(1000);
	}

	// A negative round trip time is returned as 1000 microseconds.
	{
		const diffUs = toTimeUs(0x1ffff, 0x64335) - toTimeUs(0x20000, 0x23456);

		expect(diffUs).toBeLessThan(0);

		const compactNtpDiff =
			(toCompactNtp(0x1ffff, 0x64335) - toCompactNtp(0x20000, 0x23456)) >>> 0;

		expect(compactNtpRttToTimeUs(compactNtpDiff)).toBe(1000);
	}
});

test('timeUsToAbsSendTime()', () => {
	// A whole second is the fractional unit itself, being the format 6.18 fixed
	// point seconds.
	expect(timeUsToAbsSendTime(1000000)).toBe(262144);
	expect(timeUsToAbsSendTime(1500000)).toBe(393216);
	expect(timeUsToAbsSendTime(0)).toBe(0);
	// Resolution is 1/262144 of a second, so a couple of microseconds already
	// move the value.
	expect(timeUsToAbsSendTime(2)).toBe(1);

	// Only 6 bits of seconds are kept, so the value wraps every 64 seconds.
	const wrapPeriodUs = 64 * 1000000;

	expect(timeUsToAbsSendTime(wrapPeriodUs)).toBe(0);
	expect(timeUsToAbsSendTime(wrapPeriodUs + 1000000)).toBe(
		timeUsToAbsSendTime(1000000)
	);

	// A negative time returns the value of the positive time it's congruent
	// with.
	expect(timeUsToAbsSendTime(-1000000)).toBe(
		timeUsToAbsSendTime(wrapPeriodUs - 1000000)
	);
	expect(timeUsToAbsSendTime(-wrapPeriodUs)).toBe(0);
});

test('absSendTimeToTimeUs()', () => {
	// A whole second is the fractional unit itself, being the format 6.18 fixed
	// point seconds.
	expect(absSendTimeToTimeUs(262144)).toBe(1000000);
	expect(absSendTimeToTimeUs(393216)).toBe(1500000);
	expect(absSendTimeToTimeUs(0)).toBe(0);
	// The result is truncated, being the resolution 1/262144 of a second.
	expect(absSendTimeToTimeUs(1)).toBe(3);
	// The highest value is right below the 64 seconds of the wrap period.
	expect(absSendTimeToTimeUs(0xffffff)).toBe(63999996);

	// Convert us -> abs-send-time -> us. Resolution is ~3.8us.
	for (const us of [1, 1000, 123456, 1000000, 63999990]) {
		expect(
			Math.abs(absSendTimeToTimeUs(timeUsToAbsSendTime(us)) - us)
		).toBeLessThanOrEqual(4);
	}
});

test('timeUsToQ32x32()', () => {
	// A whole second is the fractional unit itself.
	expect(timeUsToQ32x32(1000000)).toEqual({ seconds: 1, fractions: 0 });
	expect(timeUsToQ32x32(-1000000)).toEqual({ seconds: -1, fractions: 0 });
	expect(timeUsToQ32x32(0)).toEqual({ seconds: 0, fractions: 0 });
	expect(timeUsToQ32x32(1000)).toEqual({ seconds: 0, fractions: 4294967 });

	// Seconds are 32 bits wide in the format, so 2^31 seconds no longer fit.
	const outOfRangeUs = 2 ** 31 * 1000000;

	expect(timeUsToQ32x32(outOfRangeUs)).toBeUndefined();
	expect(timeUsToQ32x32(-outOfRangeUs)).toBeUndefined();
	expect(timeUsToQ32x32(outOfRangeUs - 1)).toBeDefined();
	expect(timeUsToQ32x32(-outOfRangeUs + 1)).toBeDefined();
});

test('q32x32ToTimeUs()', () => {
	expect(q32x32ToTimeUs({ seconds: 1, fractions: 0 })).toBe(1000000);
	expect(q32x32ToTimeUs({ seconds: -1, fractions: 0 })).toBe(-1000000);
	expect(q32x32ToTimeUs({ seconds: 0, fractions: 0 })).toBe(0);

	for (const us of [
		1, -1, 1000, -1000, 1000000, -1000000, 123456789, -123456789,
	]) {
		expect(q32x32ToTimeUs(timeUsToQ32x32(us)!)).toBe(us);
	}
});
