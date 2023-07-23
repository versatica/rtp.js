### TODO

- Make extensions in `RtpPacket` have a `DataView` as value so they don't copy bytes when parsing.

- When parsing a RTP packet (in the constructor) do not generate `ArrayBuffers`. And so not use `buffer.slice()` at all.

- Make `rtxEncode()` not create `new ArrayBuffer()`. Or probably what we need is to create a single `DataView` with length matching the the new RTP payload length, and fill it.

- `rtpPacket.rtxDecode()` (and others including constructor): Avoid that the method calls otehr methods that set serialization flag.

- Must test `rtpPacket.getPayloadView()` by matching binary content and so on.

- Use `pos` instead of `offset` everywhere.

- Review exported functions in `utils.ts`.
