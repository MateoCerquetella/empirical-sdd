export const MANAGED_CONTEXT_MARKER = "<!-- empirical-sdd:managed-context-v2 -->";

const LEGACY_TOPIC_TEMPLATES: Readonly<Record<string, string>> = {
  ".empirical/context/overview.md": `# Project Overview

Maintain this page from repository evidence.

## Purpose

- TODO: What the project does and who it serves.

## Boundaries

- TODO: Major scope boundaries and explicit non-goals.

## Evidence

- TODO: Link the manifests, documentation, and entrypoints used.
`,
  ".empirical/context/architecture.md": `# Architecture

Maintain this page from repository evidence.

## Components and ownership

- TODO

## Data and control flow

- TODO

## External dependencies

- TODO
`,
  ".empirical/context/commands.md": `# Commands

Maintain only commands verified from manifests, scripts, or CI configuration.

## Setup

- TODO

## Run, test, and build

- TODO

## Verification evidence

- TODO
`,
  ".empirical/context/conventions.md": `# Conventions

Maintain this page from repository instructions and observed code.

## Code and structure

- TODO

## Testing and delivery

- TODO

## Repository-specific constraints

- TODO
`,
};

export function isLegacyRepositoryKnowledgeTemplate(
  path: string,
  contents: string,
): boolean {
  const template = LEGACY_TOPIC_TEMPLATES[path];
  return template !== undefined && contents.trim() === template.trim();
}
