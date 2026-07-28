# Empirical project setup prompt

Read the templates under `ai/context/` and help the user define only the facts
that materially affect delivery:

- project vision;
- personas and user value;
- domain vocabulary;
- architecture constraints; and
- technology and verification commands.

Keep the context concrete, incremental, and product-neutral. Do not invent
unknown decisions. When the repository is ready, run `empirical doctor --json`.
