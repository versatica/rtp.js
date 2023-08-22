import { RtpPacket,	RtpPacketDump } from '../../../packets/RTP/RtpPacket';
import {
	RtpExtensionType,
	rtpExtensionUriToType
} from '../../../packets/RTP/rtpExtensions';

const rtpPacketDump: Partial<RtpPacketDump> =
{
	midExt                    : 'œæ€å∫∂',
	ridExt                    : 'qweasd',
	repairedRidExt            : '44444444',
	absSendTimeExt            : 999444,
	transportWideSeqNumberExt : 12345
};

const packet = new RtpPacket();

packet.setExtensionMapping(
	{
		[RtpExtensionType.MID]                       : 1,
		[RtpExtensionType.RTP_STREAM_ID]             : 2,
		[RtpExtensionType.RTP_REPAIRED_STREAM_ID]    : 3,
		[RtpExtensionType.ABS_SEND_TIME]             : 4,
		[RtpExtensionType.TRANSPORT_WIDE_SEQ_NUMBER] : 5
	}
);

test('set RTP extension mapping and get/set specific RTP extensions', () =>
{
	packet.setMidExtension(rtpPacketDump.midExt);
	packet.setRidExtension(rtpPacketDump.ridExt);
	packet.setRepairedRidExtension(rtpPacketDump.repairedRidExt);
	packet.setAbsSendTimeExtension(rtpPacketDump.absSendTimeExt);
	packet.setTransportWideSeqNumberExtension(
		rtpPacketDump.transportWideSeqNumberExt
	);

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

	packet2.setMidExtension(rtpPacketDump.midExt);

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

	expect(
		rtpExtensionUriToType('http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time')
	).toBe(RtpExtensionType.ABS_SEND_TIME);

	expect(
		rtpExtensionUriToType('http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01')
	).toBe(RtpExtensionType.TRANSPORT_WIDE_SEQ_NUMBER);

	expect(rtpExtensionUriToType('foo')).toBe(undefined);
});
