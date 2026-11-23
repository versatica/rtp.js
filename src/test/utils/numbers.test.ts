import { isUnsignedInteger } from '../../utils/numbers';

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
