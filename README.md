# rtp.js

[![][npm-shield-rtp.js]][npm-rtp.js]
[![][github-actions-shield-rtp.js]][github-actions-rtp.js]
[![][github-actions-shield-docs]][github-actions-docs]

RTP stack for Node.js and browser written in TypeScript. **rtp.js** provides with an API to parse, generate and modify RTP and RTCP packets.

## Installation

```text
npm install rtp.js
```

## Usage

- [API documentation](https://versatica.github.io/rtp.js)

- All RTP and RTCP classes, types and packet related helpers are exported by the `packets` module:

  ```ts
  import {
  	isRtp,
  	isRtcp,
  	RtpPacket,
  	CompoundPacket,
  	ReceiverReportPacket,
  	SenderReportPacket,
  	ReceptionReport,
  	ByePacket,
  	SdesPacket,
  	NackPacket,
  	SrReqPacket,
  	EcnPacket,
  	PliPacket,
  	SliPacket,
  	RpsiPacket,
  	XrPacket,
  	ExtendedJitterReportsPacket,
  	GenericPacket,
  	// etc.
  } from 'rtp.js/packets';

  const rtpPacket = new RtpPacket();
  ```

- The `utils` module exports some generic helpers and utilities:

  ```ts
  import {
  	padTo4Bytes,
  	nodeBufferToDataView,
  	dataViewToNodeBuffer,
  	nodeBufferToArrayBuffer,
  	arrayBufferToNodeBuffer,
  	numericArrayToDataView,
  	numberToDataView,
  	dataViewToString,
  	arrayBufferToString,
  	stringToDataView,
  	getStringByteLength,
  	// etc.
  } from 'rtp.js/utils';

  const view = stringToDataView('fooœæ€ñ#¢∞Ω©bar');
  ```

- CommonJS is also supported:

  ```ts
  const { RtpPacket /* etc. */ } = require('rtp.js/packets');
  const { padTo4Bytes /* etc. */ } = require('rtp.js/utils');
  ```

- Single entry point ("main" or "module" entries in `package.json`) is also supported for backwards compatibility:

  ```ts
  // Using ESM:
  import { packets as rtpJsPackets, utils as rtpJsUtils } from 'rtp.js';

  // Using CommonJS:
  const { packets: rtpJsPackets, utils: rtpJsUtils } = require('rtp.js');

  const { RtpPacket /* etc. */ } = rtpJsPackets;
  const { padTo4Bytes /* etc. */ } = rtpJsUtils;
  ```

## Note about TypeScript

**rtp.js** is written in TypeScript with `module: NodeNext`, meaning that TypeScript projects that want to import **rtp.js** using its exposed entry points ("rtp.js/packets" and "rtp.js/utils") must have `moduleResolution` set to "node16", 'NodeNext" or "bundler" in their `tsconfig.json` file.

## Authors

- Iñaki Baz Castillo [[website](https://inakibaz.me)|[github](https://github.com/ibc/)]
- José Luis Millán [[github](https://github.com/jmillan/)]

## License

[ISC](./LICENSE.md)

[npm-shield-rtp.js]: https://img.shields.io/npm/v/rtp.js.svg
[npm-rtp.js]: https://npmjs.org/package/rtp.js
[github-actions-shield-rtp.js]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js.yaml/badge.svg
[github-actions-rtp.js]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js.yaml
[github-actions-shield-docs]: https://github.com/versatica/rtp.js/actions/workflows/docs.yaml/badge.svg
[github-actions-docs]: https://github.com/versatica/rtp.js/actions/workflows/docs.yaml
