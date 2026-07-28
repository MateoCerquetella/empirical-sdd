# Handoff — Architect to Developer

- **Spec:** 001-portable-resumable-sdd-library
- **Gate:** Pass
- **Date:** 2026-07-28

## Implementation contract

Implement `plan.json` in dependency order. Keep the protocol schemas free of
Rust and host-product terminology. Treat repository files as canonical, require
typed result envelopes, and enforce both configuration and caller authority
for execution side effects.

## Mandatory verification

- Existing v1 fixture remains byte-identical during discovery.
- State recovers after a simulated event/state crash window.
- Stale expected revisions fail.
- Quick and Strong phase sequences differ as specified.
- Missing UI browser/screenshot review evidence blocks Done.
- Delivery cannot run with only repository configuration.
