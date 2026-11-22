import type { Ntp } from '../../types';

/**
 * RTP extensions.
 *
 * @category RTP
 */
export enum RtpExtensionType {
	/**
	 * Media identification.
	 *
	 * URI: "urn:ietf:params:rtp-hdrext:sdes:mid"
	 *
	 * @see
	 * - [RFC 9143](https://datatracker.ietf.org/doc/html/rfc9143)
	 */
	MID,

	/**
	 * RTP Stream Identifier.
	 *
	 * URI: "urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id"
	 *
	 * @see
	 * - [RFC 8852](https://datatracker.ietf.org/doc/html/rfc8852)
	 */
	RTP_STREAM_ID,

	/**
	 * RTP Repaired Stream Identifier.
	 *
	 * URI: "urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id"
	 *
	 * @see
	 * - [RFC 8852](https://datatracker.ietf.org/doc/html/rfc8852)
	 */
	REPAIRED_RTP_STREAM_ID,

	/**
	 * Absolute Send Time.
	 *
	 * URI: "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time"
	 *
	 * @see
	 * - [Google Source](https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/abs-send-time)
	 */
	ABS_SEND_TIME,

	/**
	 * Transport-wide Sequence Number.
	 *
	 * URI: "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"
	 *
	 * @see
	 * - [draft-holmer-rmcat-transport-wide-cc-extensions-01](https://datatracker.ietf.org/doc/html/draft-holmer-rmcat-transport-wide-cc-extensions-01)
	 */
	TRANSPORT_WIDE_CC_01,

	/**
	 * Audio Level.
	 *
	 * URI: "urn:ietf:params:rtp-hdrext:ssrc-audio-level"
	 *
	 * @see
	 * - [RFC 6464](https://datatracker.ietf.org/doc/html/rfc6464)
	 */
	SSRC_AUDIO_LEVEL,

	/**
	 * Dependency Descriptor.
	 *
	 * URI: "https://aomediacodec.github.io/av1-rtp-spec/#dependency-descriptor-rtp-header-extension"
	 *
	 * @see
	 * - [AV1 RTP Specification](https://aomediacodec.github.io/av1-rtp-spec/#dependency-descriptor-rtp-header-extension)
	 */
	DEPENDENCY_DESCRIPTOR,

	/**
	 * Video Orientation.
	 *
	 * URI: "urn:3gpp:video-orientation"
	 *
	 * @see
	 * - [3GPP TS 26.114 V13.2.0](https://www.etsi.org/deliver/etsi_ts/126100_126199/126114/13.02.00_60/ts_126114v130200p.pdf)
	 */
	VIDEO_ORIENTATION,

	/**
	 * Absolute Capture Time.
	 *
	 * URI: "http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time"
	 *
	 * @see
	 * - [Google Source](https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/abs-capture-time)
	 */
	ABS_CAPTURE_TIME,

	/**
	 * Playout Delay.
	 *
	 * URI: "http://www.webrtc.org/experiments/rtp-hdrext/playout-delay"
	 *
	 * @see
	 * - [Google Source](https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/playout-delay)
	 */
	PLAYOUT_DELAY,
}

/**
 * Mapping of RTP extension types and their corresponding RTP extension ids.
 *
 * @category RTP
 *
 * @example
 * ```ts
 * const rtpExtensionMapping: RtpExtensionMapping =
 * {
 *   [RtpExtensionType.MID]: 1,
 *   [RtpExtensionType.RTP_STREAM_ID]: 3
 * };
 * ```
 */
export type RtpExtensionMapping = Partial<Record<RtpExtensionType, number>>;

/**
 * SSRC Audio Level data.
 *
 * @category RTP
 *
 * @see
 * - [RFC 6464](https://datatracker.ietf.org/doc/html/rfc6464)
 */
export type SsrcAudioLevelExtension = {
	/**
	 * Audio level expressed in -dBov, with values from 0 to 127 representing 0
	 * to -127 dBov.
	 */
	volume: number;

	/**
	 * Whether the encoder believes the audio packet contains voice activity.
	 */
	voice: boolean;
};

/**
 * Video Orientation data.
 *
 * @category RTP
 *
 * @see
 * - [3GPP TS 26.114 V13.2.0](https://www.etsi.org/deliver/etsi_ts/126100_126199/126114/13.02.00_60/ts_126114v130200p.pdf)
 */
export type VideoOrientationExtension = {
	/**
	 * Direction of the camera used for the video stream: `false` for the
	 * front-facing camera (facing the user) and `true` for the back-facing
	 * camera.
	 */
	camera: boolean;

	/**
	 * Whether the video, as sent on the link, is horizontally flipped (left-right
	 * mirror operation).
	 */
	flip: boolean;

	/**
	 * Counter clockwise rotation in degrees.
	 */
	rotation: 0 | 90 | 180 | 270;
};

/**
 * Absolute Capture Time data.
 *
 * @category RTP
 *
 * @see
 * - [Google Source](https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/abs-capture-time)
 */
export type AbsCaptureTimeExtension = {
	/**
	 * Capture time in NTP format (unsigned Q32.32).
	 */
	absCaptureTimestamp: Ntp;

	/**
	 * Estimated offset between the capture clock and the sender clock (signed
	 * Q32.32, so `seconds` is a signed 32 bits value).
	 */
	estimatedCaptureClockOffset?: Ntp;
};

/**
 * Playout Delay data.
 *
 * @category RTP
 *
 * @see
 * - [Google Source](https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/playout-delay)
 */
export type PlayoutDelayExtension = {
	/**
	 * Minimum playout delay in 10 ms units (12 bits).
	 */
	minDelay: number;

	/**
	 * Maximum playout delay in 10 ms units (12 bits).
	 */
	maxDelay: number;
};

/**
 * Get the RTP extension type associated to the given RTP extension URI.
 *
 * @category RTP
 */
export function rtpExtensionUriToType(
	uri: string
): RtpExtensionType | undefined {
	switch (uri) {
		case 'urn:ietf:params:rtp-hdrext:sdes:mid': {
			return RtpExtensionType.MID;
		}

		case 'urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id': {
			return RtpExtensionType.RTP_STREAM_ID;
		}

		case 'urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id': {
			return RtpExtensionType.REPAIRED_RTP_STREAM_ID;
		}

		case 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time': {
			return RtpExtensionType.ABS_SEND_TIME;
		}

		case 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01': {
			return RtpExtensionType.TRANSPORT_WIDE_CC_01;
		}

		case 'urn:ietf:params:rtp-hdrext:ssrc-audio-level': {
			return RtpExtensionType.SSRC_AUDIO_LEVEL;
		}

		case 'https://aomediacodec.github.io/av1-rtp-spec/#dependency-descriptor-rtp-header-extension': {
			return RtpExtensionType.DEPENDENCY_DESCRIPTOR;
		}

		case 'urn:3gpp:video-orientation': {
			return RtpExtensionType.VIDEO_ORIENTATION;
		}

		case 'http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time': {
			return RtpExtensionType.ABS_CAPTURE_TIME;
		}

		case 'http://www.webrtc.org/experiments/rtp-hdrext/playout-delay': {
			return RtpExtensionType.PLAYOUT_DELAY;
		}

		default: {
			return undefined;
		}
	}
}
