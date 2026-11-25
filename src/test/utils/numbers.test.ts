import {
	isUnsignedInteger,
	isUnsignedInteger8,
	isUnsignedInteger16,
	isUnsignedInteger24,
	isUnsignedInteger32,
	isSignedInteger32,
} from '../../utils/numbers.js';

test('isUnsignedInteger()', () => {
	expect(isUnsignedInteger(0)).toBe(true);
	expect(isUnsignedInteger(1)).toBe(true);
	expect(isUnsignedInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
	expect(isUnsignedInteger(-1)).toBe(false);
	expect(isUnsignedInteger(1.5)).toBe(false);
	expect(isUnsignedInteger(NaN)).toBe(false);
	expect(isUnsignedInteger(Infinity)).toBe(false);
});

test('isUnsignedInteger() with max', () => {
	expect(isUnsignedInteger(0, 255)).toBe(true);
	expect(isUnsignedInteger(255, 255)).toBe(true);
	expect(isUnsignedInteger(256, 255)).toBe(false);
	expect(isUnsignedInteger(-1, 255)).toBe(false);
	expect(isUnsignedInteger(1.5, 255)).toBe(false);
	expect(isUnsignedInteger(0, 0)).toBe(true);
	expect(isUnsignedInteger(1, 0)).toBe(false);
});

test('isUnsignedInteger8()', () => {
	expect(isUnsignedInteger8(0)).toBe(true);
	expect(isUnsignedInteger8(1)).toBe(true);
	expect(isUnsignedInteger8(0xff)).toBe(true);
	expect(isUnsignedInteger8(0x100)).toBe(false);
	expect(isUnsignedInteger8(-1)).toBe(false);
	expect(isUnsignedInteger8(1.5)).toBe(false);
	expect(isUnsignedInteger8(NaN)).toBe(false);
	expect(isUnsignedInteger8(Infinity)).toBe(false);
});

test('isUnsignedInteger16()', () => {
	expect(isUnsignedInteger16(0)).toBe(true);
	expect(isUnsignedInteger16(1)).toBe(true);
	expect(isUnsignedInteger16(0xffff)).toBe(true);
	expect(isUnsignedInteger16(0x10000)).toBe(false);
	expect(isUnsignedInteger16(-1)).toBe(false);
	expect(isUnsignedInteger16(1.5)).toBe(false);
	expect(isUnsignedInteger16(NaN)).toBe(false);
	expect(isUnsignedInteger16(Infinity)).toBe(false);
});

test('isUnsignedInteger24()', () => {
	expect(isUnsignedInteger24(0)).toBe(true);
	expect(isUnsignedInteger24(1)).toBe(true);
	expect(isUnsignedInteger24(0xffffff)).toBe(true);
	expect(isUnsignedInteger24(0x1000000)).toBe(false);
	expect(isUnsignedInteger24(-1)).toBe(false);
	expect(isUnsignedInteger24(1.5)).toBe(false);
	expect(isUnsignedInteger24(NaN)).toBe(false);
	expect(isUnsignedInteger24(Infinity)).toBe(false);
});

test('isUnsignedInteger32()', () => {
	expect(isUnsignedInteger32(0)).toBe(true);
	expect(isUnsignedInteger32(1)).toBe(true);
	expect(isUnsignedInteger32(0xffffffff)).toBe(true);
	expect(isUnsignedInteger32(0x100000000)).toBe(false);
	expect(isUnsignedInteger32(-1)).toBe(false);
	expect(isUnsignedInteger32(1.5)).toBe(false);
	expect(isUnsignedInteger32(NaN)).toBe(false);
	expect(isUnsignedInteger32(Infinity)).toBe(false);
});

test('isSignedInteger32()', () => {
	expect(isSignedInteger32(0)).toBe(true);
	expect(isSignedInteger32(-1)).toBe(true);
	expect(isSignedInteger32(0x7fffffff)).toBe(true);
	expect(isSignedInteger32(-0x80000000)).toBe(true);
	expect(isSignedInteger32(0x80000000)).toBe(false);
	expect(isSignedInteger32(-0x80000001)).toBe(false);
	expect(isSignedInteger32(1.5)).toBe(false);
	expect(isSignedInteger32(-1.5)).toBe(false);
	expect(isSignedInteger32(NaN)).toBe(false);
	expect(isSignedInteger32(-Infinity)).toBe(false);
});
