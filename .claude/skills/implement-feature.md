---
name: implement-feature
description: "End-to-end feature implementation workflow: requirements → spec → schema → build → review"
---

# Feature Implementation Workflow

When asked to implement a feature (not a specific ticket), follow this workflow:

## Step 1: Requirements Breakdown
Launch `pm-requirements-breakdown` agent with the feature description.
Wait for structured user stories and acceptance criteria before proceeding.

## Step 2: Component Specs (if UI work)
Launch `component-spec-designer` for any new UI components identified in Step 1.
Can run in parallel with Step 3.

## Step 3: Database Changes (if needed)
Launch `db-migration-agent` to create migrations for any schema changes.
Can run in parallel with Step 2.

## Step 4: Implementation
Launch `ticket-implementer` or `design-system-builder` depending on the work:
- `ticket-implementer` — for feature logic, services, stores, navigation
- `design-system-builder` — for screens and UI-heavy components

If both are needed, run them in parallel on independent pieces.

## Step 5: Code Review
Launch `code-reviewer` on all changed files.
Address any 🐛 Bug or 🔒 Security findings before considering the feature done.

## Notes
- Always create a feature branch using Linear naming: `sankalans/eng-{number}-{slug}`
- All new Supabase tables must have RLS enabled
- Sensitive API keys go in Edge Functions only
