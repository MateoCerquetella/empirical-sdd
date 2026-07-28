# Real usage demo

This walkthrough uses a new repository and a Quick workflow to add a working
`hello.js` command.

## Install Empirical

After the npm package is published, install it once on the machine:

```bash
npm install -g @empirical/sdd
empirical --version
```

To run the current source checkout before npm publication:

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

Empirical responds:

```text
Empirical is ready. Open any agent and say: Use Empirical to <your request>.
```

Initialization creates portable `.empirical/` state, repository instructions,
and project MCP discovery. Restart or reopen the coding agent once so it loads
the new project configuration.

## Ask the agent

In Codex, Claude Code, Gemini CLI, Cursor, Windsurf, or another
terminal-capable coding agent, send:

```text
Use Empirical to add a hello command that prints "Hello from Empirical!".
```

The agent discovers Empirical through MCP or the repository instructions. It
then shapes an acceptance criterion, implements `hello.js`, executes it,
records test evidence, reviews the change, and continues until the workflow is
done.

During the run, the same state is visible from another terminal:

```bash
empirical status
empirical next
```

A completed run looks like this:

```text
$ node hello.js
Hello from Empirical!

$ empirical status
feature=001-add-a-hello-command phase=done status=done revision=5 profile=quick

$ empirical verify
Evidence is complete for 1 acceptance criteria.
```

The developer does not manually manage revisions or evidence JSON. Those are
the protocol between the agent and Empirical. The developer installs once,
initializes once per repository, and describes the work normally.

## Larger work

For a higher-assurance workflow:

```text
Use Empirical with the Strong profile to replace authentication.
```

Or start it explicitly:

```bash
empirical start "Replace authentication" --profile strong
```

Strong adds explicit Specify, Design, and Plan phases before implementation.
