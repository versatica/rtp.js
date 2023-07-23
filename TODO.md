### TODO

- Make extensions in `RtpPacket` have a `DataView` as value so they don't copy bytes when parsing.

- When parsing a RTP packet (in the constructor) do not generate `ArrayBuffers`. And so not use `buffer.slice()` at all.

- `rtpPacket.rtxDecode()` (and others including constructor): Avoid that the method calls otther methods that set serialization flag.

- Must test `rtpPacket.getPayloadView()` by matching binary content and so on.

- Use `pos` instead of `offset` everywhere.

- Review exported functions in `utils.ts`.
