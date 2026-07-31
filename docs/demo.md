# Empirical 0.20 demo

## Install once

```bash
npm install -g empirical-sdd
empirical install
```

Type to search the 73-target local catalog, use arrows and Space to choose, and
press Enter. Detected, remembered, and already installed targets appear first
with their native destinations. Empirical writes the five skills once per
unique root; no project-local workflow skill is added and installation performs
no runtime network request.

## Initialize deliberately

In Codex:

> `$empirical-init`

The agent first inspects without writing and shows:

```text
◆ Empirical setup
│  Verification: criterion tests, UI browser, UI screenshots, code review
│  Parallel work: ask; base auto; ../{repo}-{feature}; {type}/{feature}
│  Decisions: require reviewable Complex decision records
◇ Apply recommended settings · Customize · Cancel
```

Customize visits each section and finishes with Save, Edit, or Cancel. Existing
repositories show current values and default to Keep. Only after confirmation
does the agent repair runtime bridges, persist settings, build compact context,
and stop without creating feature state. Cancellation writes nothing.

## Small concrete contract

> `$empirical-spec` Add a hello command that prints `hello`; do not change any
> existing command output.

The agent drafts the Complex specification and capability deltas, presents them,
and stops before implementation. After review:

> `$empirical-loop`

Loop treats that invocation as approval and drives the selected contract to a
terminal result. After Specify passes it offers Continue here, Save for later,
or an exact approval-bound handoff to a detected agent.

## Complex Socratic contract

> `$empirical-socratic` Add expiring team invitations with revocation and audit
> history.

The agent asks the five passes one at a time, saves each answer, shows one exact
refined request, waits for approval, drafts Specify, and stops for contract
review. Invoke `$empirical-loop` after approval.

## Automatic mode

> `$empirical` Add a health command that prints `ok`.

Automatic mode initializes if needed, routes this eligible tiny change
internally to Fast, implements it, tests it, reviews it, and completes it.

> `$empirical` Add expiring team invitations with revocation and audit history.

Automatic mode routes substantial work to Complex and drives Specify, Design,
Plan, Implement, Verify, Review, and Archive. It uses Socratic discovery only if
ambiguity is material.

## Unrelated active work

Starting a different feature while one is selected returns an exact, read-only
Git worktree proposal. After explicit approval Empirical creates the linked
checkout and starts the request there. The original feature remains selected
only in its original checkout.

## Upgrade

```bash
empirical update
```

This upgrades the package and refreshes all five managed skills for remembered,
detected, or legacy-managed agents without selecting new catalog entries. The
only other public terminal command is
`empirical install`.
