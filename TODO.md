### TODO

- Must document that `serialize()` must be called by the user when adds a receiver report in a RR packet or a ssrc in a BYE packet, etc (or fix it).

- `new ByePacket(buffer)` MUST NOT internally call `this.addSsrc()` because that sets `this.serializationNeeded = true` and it doesn't make sense.

- Same for `ReceiverReportPacket` and `this.addReport()`.

- Remove `this.setCount(this.ssrcs.length);` from `bye.addSsrc()` since we cannot rely on `this.serializationNeeded` entirely for some things and not for others.

- Same for `receiverReport.addReport()`.

- Maybe we should make the packets emit 'serializationneed' event and expose a `needsSerialization()` public method. Or just the latter.

- And once above bullets are done, make tests use it and also assert whether serialization is needed or not. Same for `RtpPacket`.

- `README` and project description in `package.json`, GitHub, etc: Mention that this is for Node and Browser. And check that this is true.
