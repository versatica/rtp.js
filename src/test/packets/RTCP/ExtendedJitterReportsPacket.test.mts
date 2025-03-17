import {
	ExtendedJitterReportsPacket,
	ExtendedJitterReportsPacketDump,
} from '../../../packets/RTCP/ExtendedJitterReportsPacket.mts';
import { isRtcp, RtcpPacketType } from '../../../packets/RTCP/RtcpPacket.mts';
import { areDataViewsEqual } from '../../../utils/helpers.mts';

const extendedJitterReportsPacketDump: ExtendedJitterReportsPacketDump = {
	byteLength: 12,
	padding: 0,
	packetType: RtcpPacketType.IJ,
	count: 2,
	jitters: [0x11223344, 0x55667788],
};

const array = new Uint8Array([
	0x82,
	0xc3,
	0x00,
	0x02, // Type: 195 (IJ), Count: 2, Length: 2
	0x11,
	0x22,
	0x33,
	0x44, // Jitter: 0x11223344
	0x55,
	0x66,
	0x77,
	0x88, // Jitter: 0x55667788
]);

const view = new DataView(array.buffer, array.byteOffset, array.byteLength);

describe('parse RTCP Extended Jitter Reports packet', () => {
	test('buffer view is RTCP', () => {
		expect(isRtcp(view)).toBe(true);
	});

	test('packet processing succeeds', () => {
		const packet = new ExtendedJitterReportsPacket(view);

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(extendedJitterReportsPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(extendedJitterReportsPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(extendedJitterReportsPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});

describe('create RTCP Extended Jitter Reports packet', () => {
	const packet = new ExtendedJitterReportsPacket();

	test('packet view is RTCP', () => {
		expect(isRtcp(packet.getView())).toBe(true);
	});

	test('packet processing succeeds', () => {
		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual({
			...extendedJitterReportsPacketDump,
			byteLength: 4,
			count: 0,
			jitters: [],
		});

		// Fill optional fields so serialization should be needed.
		packet.setJitters(extendedJitterReportsPacketDump.jitters);

		expect(packet.needsSerialization()).toBe(true);
		expect(packet.dump()).toEqual(extendedJitterReportsPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		packet.serialize();

		expect(packet.needsSerialization()).toBe(false);
		expect(packet.dump()).toEqual(extendedJitterReportsPacketDump);
		expect(areDataViewsEqual(packet.getView(), view)).toBe(true);

		const clonedPacket = packet.clone();

		expect(clonedPacket.needsSerialization()).toBe(false);
		expect(clonedPacket.dump()).toEqual(extendedJitterReportsPacketDump);
		expect(areDataViewsEqual(clonedPacket.getView(), view)).toBe(true);
	});
});
