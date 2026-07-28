# Handoff — PM to Architect

- **Spec:** 001-portable-resumable-sdd-library
- **Gate:** Pass
- **Date:** 2026-07-28

## Locked product decisions

- Existing v1 `ai/` repositories remain valid inputs.
- Repository files, not an IDE database, are canonical.
- Quick and Strong profiles share evidence truthfulness but differ in ceremony.
- UI criteria require browser assertions, screenshots, and screenshot review.
- Delivery is post-review, individually configured, and separately authorized.
- The first release is a standalone library and CLI; product-specific hosts are
  later adapters.

## Architecture focus

Design a language-independent protocol with a Rust reference implementation,
atomic filesystem persistence, capability interfaces, and conformance tests.
