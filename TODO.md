### TODO

- RTP is done. RTCP is not.

- Use `pos` instead of `offset` everywhere.

- Review exported functions in `utils.ts`.

- Make `packet.serialize()` accept an optional `buffer?: ArrayBuffer` and `byteOffset?: number` and, if given, serialize into it (check length).

- Same for `clone()`.
