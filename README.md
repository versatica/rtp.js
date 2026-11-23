# rtp.js

[![][npm-shield-rtp.js]][npm-rtp.js]
[![][github-actions-shield-rtp.js]][github-actions-rtp.js]
[![][github-actions-shield-rtp.js-npm-publish]][github-actions-rtp.js-npm-publish]
[![][github-actions-shield-docs]][github-actions-docs]

RTP stack for Node.js and browser written in TypeScript. **rtp.js** provides with an API to parse, generate and modify RTP and RTCP packets.

## Installation

```text
npm install rtp.js
```

## Usage

- [API documentation](https://versatica.github.io/rtp.js)

- RTP packets and RTP extensions are exported by the `packets/RTP` module:

  ```ts
  import { isRtp, RtpPacket, ExtensionType } from 'rtp.js/packets/RTP';

  if (isRtp(buffer)) {
  	const rtpPacket = RtpPacket.parse(buffer);

  	rtpPacket.setExtensionMapping({ [ExtensionType.MID]: 1 });

  	const mid = rtpPacket.getMidExtension();
  }
  ```

- RTCP packets are exported by the `packets/RTCP` module:

  ```ts
  import {
  	isRtcp,
  	ReceiverReportPacket,
  	SenderReportPacket,
  	SdesPacket,
  	ByePacket,
  	// [...]
  } from 'rtp.js/packets/RTCP';

  const byePacket = ByePacket.factory(new Uint8Array(1500));

  byePacket.addSsrc(1234);
  byePacket.setReason('bye bye');
  ```

- Every packet lives within the `Uint8Array` given to `parse()` or `factory()` and every modification is applied in place within it, so `getBuffer()` always returns the serialized packet.
- In Node.js a `Buffer` can be given instead, since it's a `Uint8Array`.

## Note about TypeScript

**rtp.js** exposes its entry points ("rtp.js/packets/RTP", "rtp.js/packets/RTCP", "rtp.js/packets/common" and "rtp.js/utils") via the `exports` field of its `package.json` file, so TypeScript projects importing them must have `moduleResolution` set to "node16", "NodeNext" or "bundler" in their `tsconfig.json` file.

## Author

- Iñaki Baz Castillo [[website](https://inakibaz.me)|[github](https://github.com/ibc/)]

## License

[ISC](./LICENSE.md)

[npm-shield-rtp.js]: https://img.shields.io/npm/v/rtp.js.svg
[npm-rtp.js]: https://npmjs.org/package/rtp.js
[github-actions-shield-rtp.js]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js.yaml/badge.svg?branch=master
[github-actions-rtp.js]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js.yaml?query=branch%3Amaster
[github-actions-shield-rtp.js-npm-publish]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js-npm-publish.yaml/badge.svg
[github-actions-rtp.js-npm-publish]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js-npm-publish.yaml
[github-actions-shield-docs]: https://github.com/versatica/rtp.js/actions/workflows/docs.yaml/badge.svg?branch=master
[github-actions-docs]: https://github.com/versatica/rtp.js/actions/workflows/docs.yaml?query=branch%3Amaster
