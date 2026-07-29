# Project Policy Specification

## Purpose

Committed project policy supplies stable domain context and phase-specific guidance to every supported agent while preserving Empirical's mandatory gates.

## Requirements

### Requirement: Project policy enriches action packets

Empirical MUST load project context and per-phase guidance from committed `.empirical/policy.json`, expose that context through public packets, and append relevant guidance after built-in phase instructions.

#### Scenario: A phase has local guidance

- **WHEN** Empirical renders an action for that phase
- **THEN** the packet includes both mandatory built-in instructions and the additional project guidance

### Requirement: Policy cannot disable enforcement

Project policy MUST NOT replace or bypass acceptance criteria, required artifacts, exact revisions, evidence, browser, screenshot, review, delta, or archive validation.

#### Scenario: Local guidance conflicts with a gate

- **WHEN** policy asks an agent to skip a mandatory artifact or check
- **THEN** the guidance remains visible but the core still rejects completion until the mandatory gate passes
