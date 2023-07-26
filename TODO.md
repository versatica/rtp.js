### TODO

- Review exported functions in `utils.ts` (and remove unused ones).

- Remove `EventEmitter` methods from docs!
  - I've done it with https://github.com/jonchardy/typedoc-plugin-no-inherit however it doesn't remove static members of the parent class: https://github.com/jonchardy/typedoc-plugin-no-inherit/issues/33

- Add events in docs! Probably needs `@emit` or similar. And probably do not expose `RtcPacketEvents`.
