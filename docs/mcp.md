# MCP usage

Empirical exposes its registry-backed internal API over stdio:

```json
{
  "mcpServers": {
    "empirical": {
      "command": "empirical",
      "args": ["mcp"]
    }
  }
}
```

The six skills can be installed across 73 global agent targets. Skill-file
compatibility does not imply MCP configuration or executable handoff support.

## Important tool groups

- Setup and context: `empirical_init`, `empirical_adopt`,
  `empirical_configure`, `empirical_policy`, `empirical_context`,
  `empirical_doctor`, `empirical_migrate`.
- Discovery and routing: `empirical_explore`, `empirical_discovery`,
  `empirical_route`, `empirical_fast`, `empirical_complex`, `empirical_yolo`.
- Exact workflow: `empirical_loop`, `empirical_next`, `empirical_status`,
  `empirical_explain`, `empirical_complete`, `empirical_retry`.
- Evidence and integration: `empirical_evidence_execute`,
  `empirical_evidence_collect`, `empirical_verify`, `empirical_integrate`,
  `empirical_capabilities`.
- External ceilings: `empirical_deliver`, `empirical_publish`.
- Isolation and handoff: `empirical_handoff`, `empirical_worktree_propose`,
  `empirical_worktree_create`, `empirical_integrations`.

Tool names, descriptions, profiles, modes, internal CLI verbs, and skill entry
operations are derived from one registry and checked for exact parity. The
legacy `empirical_archive` boundary remains callable only to return the explicit
Schema-5 integration requirement.

## Agent contract

1. Inspect setup without writing, show the complete settings, and persist only
   after confirmation.
2. Resume selected non-terminal work before treating request text as new work.
3. Use five-pass discovery only for material ambiguity or explicit Socratic use.
4. Call `empirical_route`; Fast is legal only at the contract-neutral floor.
5. In YOLO, obey the recorded ceiling and ask only for a product blocker,
   missing permission, or hard safety boundary.
6. If start returns a worktree proposal, display and obtain literal approval
   before creation.
7. Execute configured evidence or collect artifacts, then complete the exact
   revision with immutable receipt IDs.
8. For Complex work, integrate against an independent target worktree. Deliver
   only when Policy and authorization cover it. Never infer publication.

Read operations, proposals, and Doctor do not mutate. Worktree creation,
configured command execution, integration, delivery, and publication are
explicitly effectful and retain their own safety gates.

## Policy v2

`empirical_configure` accepts the strict Policy v2 document:

```json
{
  "schemaVersion": 2,
  "context": ["README.md"],
  "phases": {},
  "verification": {
    "evidence": {
      "required": true,
      "browserForUi": true,
      "screenshotForUi": true,
      "codeReview": true
    },
    "commands": [
      {
        "id": "test",
        "argv": ["npm", "test"],
        "cwd": ".",
        "timeoutMs": 300000,
        "maxOutputBytes": 262144,
        "evidenceKinds": ["test", "review"],
        "criteria": []
      }
    ]
  },
  "delivery": null,
  "preferredAgent": null
}
```

Shell launchers and shell-control arguments are rejected. Delivery, when
enabled, is `{ "provider": "github", "targetBranch": "main",
"requiredChecks": ["test"] }`.
