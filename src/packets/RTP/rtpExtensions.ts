/**
 * RTP extensions.
 *
 * @category RTP
 */
// ESLint absurdly complains about "'RtpExtensionType' is already declared in the
// upper scope".
// eslint-disable-next-line no-shadow
export enum RtpExtensionType
{
	/**
	 * Media identification.
	 *
	 * URI: `urn:ietf:params:rtp-hdrext:sdes:mid`
	 *
	 * @category RTP
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
	 * @category RTP
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
	 * @category RTP
	 *
	 * @see
   * - [RFC 8852](https://datatracker.ietf.org/doc/html/rfc8852)
	 */
	RTP_REPAIRED_STREAM_ID
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
export function rtpExtensionUriToType(uri: string): RtpExtensionType | undefined
{
	switch (uri)
	{
		case 'urn:ietf:params:rtp-hdrext:sdes:mid':
		{
			return RtpExtensionType.MID;
		}

		case 'urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id':
		{
			return RtpExtensionType.RTP_STREAM_ID;
		}

		case 'urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id':
		{
			return RtpExtensionType.RTP_REPAIRED_STREAM_ID;
		}
	}
}
