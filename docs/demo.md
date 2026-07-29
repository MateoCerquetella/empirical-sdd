# Real usage demo

This walkthrough uses a new repository to add a working `hello` command. The
installed agent skill chooses Fast and combines implementation, verification,
and review into one completion.

## Install Empirical

Install the published package once on the machine:

```bash
npm install -g empirical-sdd
empirical --version
```

If this machine previously used `@empirical/cli`, the repository install script
removes that conflicting legacy binary before installing the current package:

```bash
curl -fsSL https://raw.githubusercontent.com/MateoCerquetella/empirical-sdd/main/scripts/install.sh | sh
```

To test a source checkout instead:

```bash
git clone https://github.com/MateoCerquetella/empirical-sdd.git
cd empirical-sdd
bun install
npm install -g .
empirical --version
```

## Initialize a project

```bash
mkdir hello-empirical
cd hello-empirical
git init
empirical init
```

Initialization creates portable `.empirical/` state, repository instructions,
automatic project skills, manual command fallbacks, and project MCP discovery.
It does not install a session hook or write agent commands into your home
directory. Restart or reopen the coding agent once so it loads the new project
configuration.

## Ask the agent

In Codex, Claude Code, Gemini CLI, Cursor, Windsurf, or another
terminal-capable coding agent, send:

```text
Add a hello command that prints "Hello from Empirical!".
```

There is no special prefix. The agent discovers Empirical through the project
skill, repository instructions, or MCP configuration. Because this request is
trivial, local, reversible, non-UI, and has an obvious focused check, the skill
chooses Fast. The CLI equivalent is:

```bash
empirical fast 'Add a hello command that prints "Hello from Empirical!".'
```

Fast returns one action at revision 1 with the concise spec and acceptance
criterion already generated. The agent implements `./hello`, runs the focused
check, reviews the diff, and submits all required test and review evidence in
one completion. That completion returns the Done packet directly; no extra
`empirical loop` call is needed.

With the CLI fallback, the returned completion command is similarly direct:

```bash
empirical complete --revision 1 --outcome passed \
  --summary "Added and checked the hello command" \
  --test "./hello printed the exact greeting" \
  --review "The diff is minimal and scoped"
```

The agent fills those summaries; the developer does not create an evidence file.

An abridged agent/tool transcript is:

```text
empirical_fast(request="Add a hello command...")
→ phase=implement status=waiting revision=1
→ requiredEvidence=[test, review]

# The current agent writes ./hello, runs it, and reviews the diff.

empirical_complete(revision=1, outcome="passed", evidence=[test, review])
→ phase=done status=done revision=2
```

During the run, the same state is visible from another terminal:

```bash
empirical status
empirical loop
```

A completed run looks like this:

```text
$ ./hello
Hello from Empirical!

$ empirical status
workstream=default feature=001-add-a-hello-command-that-prints-hello phase=done status=done revision=2 profile=fast

$ empirical verify
Evidence is complete for 1 acceptance criteria.
```

Fast finishes this tiny change in one evidence-gated revision. It still
requires test evidence for every criterion and passing review evidence.
The developer does not manually manage revisions or evidence payloads; those
are the protocol between the agent and Empirical.

If automatic discovery is unavailable, use the native manual fallback:

```text
$empirical Add a hello command that prints "Hello from Empirical!".
```

Codex uses `$empirical`; Claude Code, Cursor, Gemini CLI, and Windsurf expose
`/empirical` (Windsurf also supports `@empirical`).

## Larger work

For a higher-assurance workflow:

```text
Replace authentication.
```

The agent skill chooses Complex. The CLI equivalent is:

```bash
empirical complex "Replace authentication"
```

Complex adds explicit Specify, Design, and Plan phases before implementation.
During Specify, the agent declares ADDED, MODIFIED, or REMOVED behavioral
requirements under the feature's `deltas/` directory. Verify still requires
criterion evidence, Review still requires review evidence, and the next packet
then requires Archive:

```text
Specify → Design → Plan → Implement → Verify → Review → Archive → Done
```

Archive atomically updates `.empirical/capabilities/<name>/spec.md`, giving later
changes a concise statement of current behavior rather than only a history of old
feature plans.

If a later agent session needs to continue that active workflow, it calls
`empirical_loop()` or runs `empirical loop` with no request.

If the initial request is genuinely vague, run the restored terminal interview:

```bash
empirical explore "Build a cooperative browser puzzle" --agent codex
```

Empirical asks the original five Socratic passes one question at a time, adds only
material follow-ups, persists every answer under `.empirical/discoveries/`, and
shows the refined contract for approval. Only after approval does it start Fast or
Complex; `--agent codex` then launches Codex against that exact active workflow.
Inside an already-open agent, `empirical_explore(problem="...")` remains a pure
context packet and the generated skill conducts the same interview in the current
conversation. If unrelated work is already active, the agent creates a named
workstream and preserves the explicit workstream from every returned packet.
