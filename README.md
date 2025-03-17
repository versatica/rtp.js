# rtp.js

[![][npm-shield-rtp.js]][npm-rtp.js]
[![][github-actions-shield-rtp.js]][github-actions-rtp.js]

RTP stack for Node.js and browser written in TypeScript. **rtp.js** provides with an API to parse, generate and modify RTP and RTCP packets.

## Installation

```text
npm install rtp.js
```

## Usage

- [API documentation](https://versatica.github.io/rtp.js)

- All RTP and RTCP classes, types and packet related helpers are exported by the `packets` module.

  ```ts
  import * as packets from 'rtp.js/packets';

  const {
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
  } = packets;
  ```

- The `utils` module exports some generic helpers and utilities.

  ```ts
  import * as utils from 'rtp.js/packets';

  const view = utils.stringToDataView('fooœæ€ñ#¢∞Ω©bar');
  ```

- CommonJS is also supported:

  ```ts
  const packets = require('rtp.js/packets');
  const utils = require('rtp.js/utils');
  ```

## Note about TypeScript

**rtp.js** is written in TypeScript with `module: NodeNext`, meaning that TypeScript projects that have **rtp.js** as dependency must have `moduleResolution` with value "node16", 'NodeNext" or "bundler" in their `tsconfig.json` file.

## Authors

- Iñaki Baz Castillo [[website](https://inakibaz.me)|[github](https://github.com/ibc/)]
- José Luis Millán [[github](https://github.com/jmillan/)]

## License

[ISC](./LICENSE)

[npm-shield-rtp.js]: https://img.shields.io/npm/v/rtp.js.svg
[npm-rtp.js]: https://npmjs.org/package/rtp.js
[github-actions-shield-rtp.js]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js.yaml/badge.svg
[github-actions-rtp.js]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js.yaml
