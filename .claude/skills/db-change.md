---
name: db-change
description: "Database schema change workflow: design → migrate → validate → apply"
---

# Database Change Workflow

When a task requires database schema changes:

## Step 1: Design & Write Migration
Launch `db-migration-agent` with the requirements. It will:
- Create a numbered migration file in `supabase/migrations/`
- Enable RLS on any new tables
- Add appropriate indexes and constraints
- Use IF NOT EXISTS guards for safety

## Step 2: Validate
The agent validates syntax, safety, ordering, references, and RLS policies.

## Step 3: Apply
Use Supabase MCP (`mcp__supabase__apply_migration`) to apply the migration.

## Rules
- Never drop tables or columns without explicit user confirmation
- Always enable RLS on new tables
- Use `timestamptz` for timestamps, `uuid` for IDs, `vector(1536)` for embeddings
- Wrap destructive operations in transactions
