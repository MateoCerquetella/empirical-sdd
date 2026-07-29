# Plan

1. Add a platform-aware lock-open retry classifier in `src/storage.ts`.
2. Route Windows `EPERM`/`EACCES` through the existing bounded delay and make stale inspection races fall through to that delay.
3. Add deterministic classifier assertions beside the existing concurrent recovery and superseded-owner tests.
4. Run the focused lock tests repeatedly, then run `bun run ci` and review the exact diff.
5. Submit criterion evidence, pass Review, Archive the modified parallel-workstreams requirement, and require the three-platform GitHub matrix before merge.
