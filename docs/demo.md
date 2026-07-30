# Empirical 0.20 demo

## Install once

```bash
npm install -g empirical-sdd
empirical install
```

Select agents, reload them, and use one of the five installed skills. No
project-local workflow skill is added.

## Initialize deliberately

In Codex:

> `$empirical-init`

The agent inspects the repository, asks only material isolation or decision
questions, repairs partial setup, builds compact context, and stops without
creating feature state.

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

This upgrades the package and refreshes all five managed skills for detected or
already managed agents. The only other public terminal command is
`empirical install`.
