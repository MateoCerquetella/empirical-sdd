# Empirical SDD workspace

This directory is the portable source of truth for feature work. Any IDE,
agent, terminal, or CI job may participate if it reads and writes the protocol
files described here.

Start with `ai/context/`, create a spec below `ai/specs/`, and use `empirical select`
followed by `empirical loop` or an external `empirical check-in` loop. `ai/STATE.md` is the
human-readable state projection; `ai/events/` is the recoverable history.

Quick is intended for small, well-understood changes. Strong adds explicit
specification, design, and planning gates. Both require verification and review
before completion. A local database may index these files, but it is never the
authority.

`ai/templates/` keeps the host-neutral prompts from v1. Strong features use
typed `plan.json`; `tasks.md` remains available as an optional human-readable
compatibility checklist.
