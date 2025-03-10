/**
 * RTP extensions.
 *
 * @category RTP
 */
export enum RtpExtensionType {
	/**
	 * Media identification.
	 *
	 * URI: `urn:ietf:params:rtp-hdrext:sdes:mid`
	 *
	 * @see
	 * - [RFC 9143](https://datatracker.ietf.org/doc/html/rfc9143)
	 */
	MID,
	/**
	 * RTP Stream Identifier.
	 *
	 * URI: `urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id`
	 *
	 * @see
	 * - [RFC 8852](https://datatracker.ietf.org/doc/html/rfc8852)
	 */
	RTP_STREAM_ID,
	/**
	 * RTP Repaired Stream Identifier.
	 *
	 * URI: `urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id`
	 *
	 * @see
	 * - [RFC 8852](https://datatracker.ietf.org/doc/html/rfc8852)
	 */
	RTP_REPAIRED_STREAM_ID,
	/**
	 * Absolute Send Time.
	 *
	 * URI: `http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time`
	 *
	 * @see
	 * - [Google Source](https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/abs-send-time)
	 */
	ABS_SEND_TIME,
	/**
	 * Transport-wide Sequence Number.
	 *
	 * URI: `http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01`
	 *
	 * @see
	 * - [draft-holmer-rmcat-transport-wide-cc-extensions-01](https://datatracker.ietf.org/doc/html/draft-holmer-rmcat-transport-wide-cc-extensions-01)
	 */
	TRANSPORT_WIDE_SEQ_NUMBER,
	/**
	 * Audio Level
	 *
	 * URI: `urn:ietf:params:rtp-hdrext:ssrc-audio-level`
	 *
	 * @see
	 * - [RFC 6464](https://datatracker.ietf.org/doc/html/rfc6464)
	 */
	SSRC_AUDIO_LEVEL,
	/**
	 * Video Orientation.
	 *
	 * URI: `urn:3gpp:video-orientation`
	 *
	 * @see
	 * - [3GPP TS 26.114 V12.7.0](https://www.etsi.org/deliver/etsi_ts/126100_126199/126114/13.02.00_60/ts_126114v130200p.pdf)
	 */
	VIDEO_ORIENTATION,
	/**
	 * Transmission Time Offsets.
	 *
	 * URI: `urn:ietf:params:rtp-hdrext:toffset`
	 *
	 * @see
	 * - [RFC 5450](https://datatracker.ietf.org/doc/html/rfc5450)
	 */
	TOFFSET,
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
 */
export type RtpExtensionMapping = Partial<Record<RtpExtensionType, number>>;

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
			return RtpExtensionType.RTP_REPAIRED_STREAM_ID;
		}

		case 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time': {
			return RtpExtensionType.ABS_SEND_TIME;
		}

		case 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01': {
			return RtpExtensionType.TRANSPORT_WIDE_SEQ_NUMBER;
		}

		case 'urn:ietf:params:rtp-hdrext:ssrc-audio-level': {
			return RtpExtensionType.SSRC_AUDIO_LEVEL;
		}

		case 'urn:3gpp:video-orientation': {
			return RtpExtensionType.VIDEO_ORIENTATION;
		}

		case 'urn:ietf:params:rtp-hdrext:toffset': {
			return RtpExtensionType.TOFFSET;
		}
	}
}

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
 * - [3GPP TS 26.114 V12.7.0](https://www.etsi.org/deliver/etsi_ts/126100_126199/126114/13.02.00_60/ts_126114v130200p.pdf)
 */
export type VideoOrientationExtension = {
	camera: boolean;
	flip: boolean;
	/**
	 * 0: no rotation.
	 * 1: rotation is 90º.
	 * 2: rotation is 180º.
	 * 3: rotation is 270º.
	 */
	rotation: number;
};

/**
 * Convert Unix epoch timestamp in milliseconds to "Absolute Send Time" format.
 *
 * @category RTP
 *
 * @see
 * - [Google Source](https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/abs-send-time)
 */
export function timeMsToAbsSendTime(timeMs: number): number {
	return (((timeMs << 18) + 500) / 1000) & 0x00ffffff;
}
