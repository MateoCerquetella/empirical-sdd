# Project Vision

## Problem

Developers using the original Empirical SDD scaffold can describe the current
phase, but no neutral runtime can reliably resume that phase, continue the
workflow, and prove that the resulting feature satisfies its acceptance
criteria.

## Vision

Empirical SDD is a portable protocol and reference library for evidence-backed
spec-driven development. A repository carries the canonical workflow state;
any compatible CLI, agent, IDE, or automation host can continue it without a
particular vendor, database, or MCP server.

## Users

Developers already using the v1 `ai/` scaffold, followed by teams and tool
authors who need interoperable SDD automation.

## Core outcomes

- Existing v1 repositories remain readable and usable without destructive
  migration.
- Quick work follows a short, low-ceremony loop.
- Strong work follows the complete design, planning, verification, and review
  loop.
- Every acceptance criterion has explicit evidence before completion.
- UI criteria require browser assertions and agent-reviewed screenshots.
- Commit, push, and pull-request delivery are separately configurable.

## Success

A workflow started by one tool can be resumed by another from repository files
alone, including after all IDE caches and databases have been deleted.
