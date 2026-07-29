# Conventions

## Code and structure

- TypeScript ESM source lives in `src/`; public types are exported through
  `src/index.ts` and compiled declarations.
- Core behavior is independent from CLI and MCP rendering.
- Persistent writes are atomic, path-contained, and symbolic-link aware.
- Stable `EmpiricalError` codes communicate expected failure modes.

## Testing and delivery

- Tests use Bun fixtures in temporary directories and exercise real Git
  worktrees where isolation behavior matters.
- Changes must pass type checking, the full suite, built distribution smoke,
  npm package inspection, and `git diff --check`.
- Version `0.20.0` remains alpha; publication is a separate explicit action.

## Repository-specific constraints

- `.empirical/` is the durable contract and evidence source of truth.
- Fast is restricted to explicit tiny low-risk non-UI work; substantial or UI
  changes use the seven-phase Complex workflow.
- Do not persist private chain-of-thought or credentials.
- Do not add project-local workflow skills; global installation owns the single
  user-facing Empirical entrypoint.
