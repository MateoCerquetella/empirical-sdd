# Empirical 0.20 demo

## First setup

Install once from a terminal:

```bash
npm install -g empirical-sdd
empirical install
```

Open a repository in a detected coding agent, reload it as instructed by the
installer, and invoke the one Empirical entrypoint. On first use the agent
initializes `.empirical/`, asks only material repository-policy questions, and
builds compact repository context. No project-local workflow command is added.

## Small feature

Ask in agent chat:

> `$empirical` Add a hello command that prints `hello`.

The single entrypoint routes this eligible tiny change internally to Fast,
implements it, runs a focused test, reviews the diff, and completes the exact
revision. There is no separate Fast skill for you to invoke.

## Complex feature

Ask in agent chat:

> `$empirical` Add expiring team invitations with revocation and audit history.

The single entrypoint routes to Complex, produces an observable specification,
design and accepted decisions, plans and implements the change, verifies every
criterion, reviews the result, and archives validated behavior into living
capability specs.

After the specification passes, choose one of:

- Continue here.
- Save for later.
- Continue in a detected agent.

The last choice shows an exact target, cwd, and command and requires explicit
approval before the host agent starts anything.

## Unrelated work while active

Ask the same entrypoint for a different feature. Empirical previews an isolated
Git worktree with exact base commit, branch, path, and argv. After approval it
creates and starts the request in the linked checkout. The original feature
remains selected only in its original checkout.

## Upgrade

```bash
empirical update
```

This upgrades the package and refreshes the one global entrypoint per detected
agent.
