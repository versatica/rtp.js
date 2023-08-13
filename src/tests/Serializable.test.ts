import { Serializable } from '../Serializable';
import { clone, areDataViewsEqual } from '../utils';

export class Foo extends Serializable
{
	constructor(view: DataView)
	{
		super(view);
	}

	getByteLength(): number
	{
		return this.view.byteLength;
	}

	serialize(): void
	{
		const { buffer, byteOffset, byteLength } = this.getSerializationBuffer();

		// Create new DataView with new buffer.
		const view = new DataView(buffer, byteOffset, byteLength);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength
		);

		// Copy the entire view into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset,
				this.view.byteLength
			),
			0
		);

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	clone(buffer?: ArrayBuffer, byteOffset?: number): Foo
	{
		const view = this.cloneInternal(buffer, byteOffset);

		return new Foo(view);
	}
}

describe('parse Foo 1', () =>
{
	let array: Uint8Array;
	let view: DataView;
	let clonedView: DataView;
	let foo: Foo;

	beforeEach(() =>
	{
		// Buffer of 20 bytes.
		array = new Uint8Array(
			[
				0x00, 0x11, 0x22, 0x33,
				0x44, 0x55, 0x66, 0x77,
				0x88, 0x99, 0xFF, 0xFF,
				0xFF, 0xFF, 0xFF, 0xFF,
				0xFF, 0xFF, 0xFF, 0xFF
			]
		);

		// Create a view with just 10 bytes.
		view = new DataView(
			array.buffer,
			array.byteOffset,
			10
		);

		clonedView = clone<DataView>(view);

		foo = new Foo(view);
	});

	test('serializable processing succeeds', () =>
	{
		expect(foo.getByteLength()).toBe(10);
		expect(foo.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(foo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(foo.getView(), clonedView)).toBe(true);
	});

	test('serialize() succeeds', () =>
	{
		const buffer = new ArrayBuffer(10);
		const byteOffset = 0;

		foo.once('will-serialize', (length, cb) =>
		{
			cb(buffer, byteOffset);
		});

		foo.serialize();

		expect(foo.getByteLength()).toBe(10);
		expect(foo.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(foo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(foo.getView(), clonedView)).toBe(true);
	});

	test('serialize() fails if current buffer is given and it collides', () =>
	{
		foo.once('will-serialize', (length, cb) =>
		{
			// Given buffer is the object's current one with byte offset 9, which
			// is the last byte of the object's DataView, so it will be wronly
			// overwritten.
			cb(view.buffer, /* byteOffset */ 9);
		});

		foo.serialize();

		expect(foo.getByteLength()).toBe(10);
		expect(foo.needsSerialization()).toBe(false);
		// This is true because obviously both are the same DataView instance,
		// however it's been overwritten.
		expect(areDataViewsEqual(foo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(foo.getView(), clonedView)).toBe(false);
	});

	test('clone() succeeds', () =>
	{
		const clonedFoo = foo.clone();

		expect(clonedFoo.getByteLength()).toBe(10);
		expect(clonedFoo.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(clonedFoo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedFoo.getView(), clonedView)).toBe(true);
	});

	test('clone() succeeds if current buffer is given', () =>
	{
		const clonedFoo = foo.clone(foo.getView().buffer, foo.getView().byteOffset);

		expect(clonedFoo.getByteLength()).toBe(10);
		expect(clonedFoo.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(clonedFoo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedFoo.getView(), clonedView)).toBe(true);
	});

	test('clone() fails if current buffer is given for serialization and it collides', () =>
	{
		// Force seriqlization when cloning.
		// @ts-ignore
		foo.setSerializationNeeded(true);

		foo.once('will-serialize', (length, cb) =>
		{
			cb(view.buffer, /* byteOffset */ 9);
		});

		const buffer = new ArrayBuffer(10);
		const byteOffset = 0;
		const clonedFoo = foo.clone(buffer, byteOffset);

		expect(clonedFoo.getByteLength()).toBe(10);
		expect(clonedFoo.needsSerialization()).toBe(false);
		// This is true because obviously both are the same DataView instance,
		// however it's been overwritten.
		expect(areDataViewsEqual(clonedFoo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedFoo.getView(), clonedView)).toBe(false);
	});
});
