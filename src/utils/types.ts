/**
 * NTP timestamp.
 */
export type Ntp = {
	/**
	 * Seconds (32 bits).
	 */
	seconds: number;
	/**
	 * Fractions of second (32 bits).
	 */
	fractions: number;
};
