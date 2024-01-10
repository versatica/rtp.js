import { Serializable } from '../../packets/Serializable';
import { clone, areDataViewsEqual } from '../../utils/helpers';

export class Foo extends Serializable {
	constructor(view: DataView) {
		super(view);
	}

	getByteLength(): number {
		return this.view.byteLength;
	}

	serialize(buffer?: ArrayBuffer, byteOffset?: number): void {
		const bufferData = this.getSerializationBuffer(buffer, byteOffset);

		// Create new DataView with new buffer.
		const view = new DataView(
			bufferData.buffer,
			bufferData.byteOffset,
			bufferData.byteLength,
		);
		const uint8Array = new Uint8Array(
			view.buffer,
			view.byteOffset,
			view.byteLength,
		);

		// Copy the entire view into the new buffer.
		uint8Array.set(
			new Uint8Array(
				this.view.buffer,
				this.view.byteOffset,
				this.view.byteLength,
			),
			0,
		);

		// Update DataView.
		this.view = view;

		this.setSerializationNeeded(false);
	}

	clone(
		buffer?: ArrayBuffer,
		byteOffset?: number,
		serializationBuffer?: ArrayBuffer,
		serializationByteOffset?: number,
	): Foo {
		const view = this.cloneInternal(
			buffer,
			byteOffset,
			serializationBuffer,
			serializationByteOffset,
		);

		return new Foo(view);
	}
}

describe('parse Foo 1', () => {
	let array: Uint8Array;
	let view: DataView;
	let clonedView: DataView;
	let foo: Foo;

	beforeEach(() => {
		// Buffer of 20 bytes.
		array = new Uint8Array([
			0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xff, 0xff,
			0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
		]);

		// Create a view with just 10 bytes.
		view = new DataView(array.buffer, array.byteOffset, 10);

		clonedView = clone<DataView>(view);

		foo = new Foo(view);
	});

	test('serializable processing succeeds', () => {
		expect(foo.getByteLength()).toBe(10);
		expect(foo.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(foo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(foo.getView(), clonedView)).toBe(true);
	});

	test('serialize() succeeds', () => {
		const buffer = new ArrayBuffer(10);
		const byteOffset = 0;

		foo.serialize(buffer, byteOffset);

		expect(foo.getByteLength()).toBe(10);
		expect(foo.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(foo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(foo.getView(), clonedView)).toBe(true);
	});

	test('serialize() fails if current buffer is given and it collides', () => {
		foo.serialize(view.buffer, /* byteOffset */ 9);

		expect(foo.getByteLength()).toBe(10);
		expect(foo.needsSerialization()).toBe(false);
		// This is true because obviously both are the same DataView instance,
		// however it's been overwritten.
		expect(areDataViewsEqual(foo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(foo.getView(), clonedView)).toBe(false);
	});

	test('clone() succeeds', () => {
		const clonedFoo = foo.clone();

		expect(clonedFoo.getByteLength()).toBe(10);
		expect(clonedFoo.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(clonedFoo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedFoo.getView(), clonedView)).toBe(true);
	});

	test('clone() succeeds if current buffer is given', () => {
		const clonedFoo = foo.clone(foo.getView().buffer, foo.getView().byteOffset);

		expect(clonedFoo.getByteLength()).toBe(10);
		expect(clonedFoo.needsSerialization()).toBe(false);
		expect(areDataViewsEqual(clonedFoo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedFoo.getView(), clonedView)).toBe(true);
	});

	test('clone() fails if current buffer is given for serialization and it collides', () => {
		// Force seriqlization when cloning.
		// @ts-ignore
		foo.setSerializationNeeded(true);

		const buffer = new ArrayBuffer(10);
		const byteOffset = 0;
		const clonedFoo = foo.clone(
			buffer,
			byteOffset,
			/* serializationBuffer */ view.buffer,
			/* byteOffset */ 9,
		);

		expect(clonedFoo.getByteLength()).toBe(10);
		expect(clonedFoo.needsSerialization()).toBe(false);
		// This is true because obviously both are the same DataView instance,
		// however it's been overwritten.
		expect(areDataViewsEqual(clonedFoo.getView(), view)).toBe(true);
		expect(areDataViewsEqual(clonedFoo.getView(), clonedView)).toBe(false);
	});
});
