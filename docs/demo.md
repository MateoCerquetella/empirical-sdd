# Empirical 0.20 demo

## First setup

```bash
cd my-repository
empirical init
```

Accept or edit the detected base, sibling checkout path, branch pattern, and
Complex decision setting. `empirical config` changes them later.

## Small feature

```bash
empirical fast "Add a hello command that prints hello"
```

Implement the generated criterion, then use the exact returned command:

```bash
empirical complete --revision 1 --outcome passed \
  --summary "Added hello command" \
  --test "hello command test passed" \
  --review "focused diff reviewed"
```

Expected final status in that checkout:

```text
feature=add-a-hello-command-that-prints-hello phase=done status=done revision=2 profile=fast
```

## Complex feature

```bash
empirical complex "Add expiring team invitations with revocation"
```

At Specify, replace the spec placeholders with observable criteria and declare
behavior deltas. At Design, complete both `design.md` and `decisions.md`. At
Plan, write executable steps. Then implement, attach evidence, review against
accepted decisions, and archive the validated deltas. Always use the exact
completion command returned by the preceding action.

```bash
empirical explain
```

Use Explain whenever the next step or gate is unclear.

## Unrelated work while active

```bash
empirical complex "Fix password reset expiry"
```

Empirical displays a read-only proposal such as:

```text
Base: main
Base commit: <approved-base-commit>
Branch: fix/fix-password-reset-expiry
Path: ../my-repository-fix-password-reset-expiry
Command: git worktree add -b fix/fix-password-reset-expiry ... <approved-base-commit>
```

Approve only after inspecting it. Empirical checks a clean source checkout,
creates the branch and linked checkout without force, starts the exact request,
and prints:

```bash
cd "../my-repository-fix-password-reset-expiry" && empirical loop
```

The original feature remains unchanged in its original checkout.
