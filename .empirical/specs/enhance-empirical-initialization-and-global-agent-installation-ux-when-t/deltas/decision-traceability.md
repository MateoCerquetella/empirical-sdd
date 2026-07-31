# Decision Traceability

## Purpose

Make material implementation decisions explainable and reviewable without
capturing private model reasoning, under an explicit project policy.

## MODIFIED Requirements

### Requirement: Complex changes record material decisions

When project configuration sets Complex decision records to `required`, every
Complex feature MUST maintain a concise decision record covering evidence,
options, chosen approach, consequences or risks, and verification. The in-agent
setup wizard MUST show this gate, default it to required on first run, and
preserve its current value during repair. When the explicit setting is `off`,
Design and Review MUST NOT falsely report a required decision artifact. Decision
records MUST never request or store private chain-of-thought, secrets, prompt
transcripts, or token-level reasoning.

#### Scenario: A developer keeps the recommended policy

- **WHEN** first-run setup is confirmed without customization
- **THEN** Complex Design requires a valid reviewable decision record

#### Scenario: A developer explicitly disables the policy

- **WHEN** setup or reconfiguration saves Complex decision records as `off`
- **THEN** later Complex transitions honor that persisted choice
- **AND** no unrelated evidence or acceptance gate is weakened
