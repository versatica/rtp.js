import {
	areDataViewsEqual,
	nodeBufferToDataView,
	dataViewToNodeBuffer,
	nodeBufferToArrayBuffer,
	arrayBufferToNodeBuffer,
} from '../../utils/helpers.mts';

test('nodeBufferToDataView() and dataViewToNodeBuffer()', () => {
	const array = new Uint8Array([
		0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
	]);

	const view1 = new DataView(array.buffer, array.byteOffset, array.byteLength);

	const nodeBuffer = dataViewToNodeBuffer(view1);
	const view2 = nodeBufferToDataView(nodeBuffer);

	expect(areDataViewsEqual(view1, view2)).toBe(true);
});

test('nodeBufferToArrayBuffer() and arrayBufferToNodeBuffer()', () => {
	const array = new Uint8Array([
		0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
	]);

	const arrayBuffer1 = array.buffer;
	const nodeBuffer = arrayBufferToNodeBuffer(arrayBuffer1);
	const arrayBuffer2 = nodeBufferToArrayBuffer(nodeBuffer);
	const view1 = new DataView(arrayBuffer1);
	const view2 = new DataView(arrayBuffer2);

	expect(areDataViewsEqual(view1, view2)).toBe(true);
});
