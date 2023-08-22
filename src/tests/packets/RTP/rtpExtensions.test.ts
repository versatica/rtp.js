import { RtpPacket,	RtpPacketDump } from '../../../packets/RTP/RtpPacket';
import {
	RtpExtensionType,
	rtpExtensionUriToType
} from '../../../packets/RTP/rtpExtensions';

describe('RTP extensions', () =>
{
	const rtpPacketDump: Partial<RtpPacketDump> =
	{
		midExtension         : 'œæ€å∫∂',
		ridExtension         : 'qweasd',
		repairedRidExtension : '1234'
	};

	const packet = new RtpPacket();

	packet.setExtensionMapping(
		{
			[RtpExtensionType.MID]                    : 1,
			[RtpExtensionType.RTP_STREAM_ID]          : 3,
			[RtpExtensionType.RTP_REPAIRED_STREAM_ID] : 4
		}
	);

	test('set RTP extension mapping and get/set specific RTP extensions', () =>
	{
		packet.setMidExtension(rtpPacketDump.midExtension);
		packet.setRidExtension(rtpPacketDump.ridExtension);
		packet.setRepairedRidExtension(rtpPacketDump.repairedRidExtension);

		expect(packet.dump()).toEqual(expect.objectContaining(rtpPacketDump));
	});

	test('RTP extension mapping remains after cloning the packet', () =>
	{
		const clonedPacket = packet.clone();

		expect(clonedPacket.dump()).toEqual(expect.objectContaining(rtpPacketDump));
	});

	test('setting specific RTP extension without mapping does nothing', () =>
	{
		const packet2 = new RtpPacket();

		packet2.setMidExtension(rtpPacketDump.midExtension);

		expect(packet2.getMidExtension()).toBe(undefined);
	});

	test('rtpExtensionUriToType()', () =>
	{
		expect(
			rtpExtensionUriToType('urn:ietf:params:rtp-hdrext:sdes:mid')
		).toBe(RtpExtensionType.MID);

		expect(
			rtpExtensionUriToType('urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id')
		).toBe(RtpExtensionType.RTP_STREAM_ID);

		expect(
			rtpExtensionUriToType('urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id')
		).toBe(RtpExtensionType.RTP_REPAIRED_STREAM_ID);

		expect(rtpExtensionUriToType('foo')).toBe(undefined);
	});
});
