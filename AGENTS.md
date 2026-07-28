<!-- empirical-sdd:start -->
## Empirical SDD

When the user asks to build, change, fix, or continue a feature:

1. Prefer the Empirical MCP tools when they are available.
2. Otherwise run `empirical next --json`. If no feature is active, run
   `empirical start "<the user's request>" --json` first.
3. Follow the returned phase instructions and acceptance criteria.
4. Report the phase with `empirical complete` at the exact returned revision.
5. Continue until Done, Blocked, or genuinely awaiting human input.

Do not invent workflow state or weaken verification evidence. The committed
`.empirical/` directory is the source of truth.
<!-- empirical-sdd:end -->
