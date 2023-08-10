# rtp.js

[![][npm-shield-rtp.js]][npm-rtp.js]
[![][github-actions-shield-rtp.js]][github-actions-rtp.js]

RTP stack for Node.js and browser written in TypeScript. **rtp.js** provides with an API to parse, generate and modify RTP and RTCP packets.

_NOTE:_ Work in progress. Many more RTCP packets will be added along with new features.


## Documentation

* [API](https://versatica.github.io/rtp.js/)
* All core classes and functions are exported by the main module. Example:
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
    SdesPacket
  } from 'rtp.js';
  ```
* The main module also exports a `utils` module with some helpers and utilities. Example:
  ```ts
  import { utils } from 'rtp.js';
  
  const view = utils.stringToDataView('foo');
  ```


## Source Code

* [GitHub](https://github.com/versatica/rtp.js/)


## Authors

* Iñaki Baz Castillo [[website](https://inakibaz.me)|[github](https://github.com/ibc/)]
* José Luis Millán [[github](https://github.com/jmillan/)]


## License

[ISC](./LICENSE)



[npm-shield-rtp.js]: https://img.shields.io/npm/v/rtp.js.svg
[npm-rtp.js]: https://npmjs.org/package/rtp.js
[github-actions-shield-rtp.js]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js.yaml/badge.svg
[github-actions-rtp.js]: https://github.com/versatica/rtp.js/actions/workflows/rtp.js.yaml
