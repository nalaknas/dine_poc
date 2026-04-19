# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm start                  # Expo dev server
npm run ios                # iOS simulator
npm run android            # Android emulator
npm test                   # Jest tests
npx jest path/to/test.ts   # Single test
```

Env vars: `.env` → `app.config.js` (extra) → expo-constants → `src/constants/config.ts`. Never import app.config.js at runtime.

## Architecture

**React Native 0.83 + Expo 55, iOS-first. Supabase backend.**

### Navigation (React Navigation 7)
- `RootNavigator` — auth-gated: Splash → Auth → Onboarding → MainTabs
- `MainTabNavigator` — 5 tabs: Feed, Explore, PostCreation (center FAB), Activity, Profile
- `PostCreationNavigator` — 7-step nested stack for meal posts
- Deep linking: `dine://` and `https://dine.app`

### State (Zustand + AsyncStorage)
8 stores in `src/stores/`: auth, userProfile, settings, social, billSplitter, contacts, splitHistory, notifications.

### Services (`src/services/`)
Service layer between screens and Supabase. Never call Supabase directly from screens.

### Styling (NativeWind v4 / TailwindCSS)
Use Tailwind classes via NativeWind, never raw StyleSheet for layout/colors. Brand tokens in `tailwind.config.js` and `src/constants/colors.ts`.

### Supabase
- Client: `src/lib/supabase.ts` (anon key + AsyncStorage persistence)
- Migrations: `supabase/migrations/` (numbered prefixes)
- Edge Functions: `supabase/functions/` — analyze-receipt, generate-embedding, get-recommendations, upload-photo, send-push-notification
- Extensions: pgvector, pg_trgm, uuid-ossp
- **RLS on all tables, always**

### Key Patterns
- **Sensitive API keys are server-side only** — Edge Functions, never client
- **Receipt flow**: Vision OCR → GPT-4o parsing → bill splitting → Venmo deep links
- **Taste intelligence**: OpenAI embeddings as pgvector; cosine similarity for recs
- **Analytics**: Mixpanel (`src/lib/analytics.ts`)
- **Push notifications**: Expo Notifications → Edge Function triggers
- **Path alias**: `@/*` → `src/*`
- **TypeScript strict mode**. Shared types in `src/types/index.ts`

## Branching & Deployment
- Branch names follow Linear format: `sankalans/eng-{number}-{slug}`
- Deploy via EAS Build (iOS-first)
- Linear project: "Upgrade Front End" under Engineering team (key: ENG), MVP 1 milestone

## Agents

Use the specialized agents in `.claude/agents/` to build features end-to-end:

| Agent | When to use |
|-------|-------------|
| `ticket-implementer` | Implement a Linear ticket by ID — fetches issue, plans, and writes code |
| `db-migration-agent` | Create, validate, or apply Supabase migrations (schema, RLS, indexes) |
| `code-reviewer` | Review written code for bugs, security, and pattern consistency |

## Skills

Prefer skills over ad-hoc workflows for repeatable procedures:

| Skill | What it does |
|-------|--------------|
| `ticket-start` | Fetch Linear ticket → sync `development` → create feature branch from `gitBranchName` → set ticket to In Progress |
| `ticket-ship` | Preflight → commit → push → open PR to `development` → monitor CI → merge on green → set ticket to Done |
| `release-to-prod` | Merge `development` → `main` → monitor EAS production build → confirm TestFlight submission |
| `ota-push` | Publish an EAS OTA update to the current channel; falls back to native build if native changes detected |
| `rollback` | Revert a bad `main` merge → trigger rollback build → republish OTA → back-merge to `development` → open post-mortem ticket |
| `sync-branch` | Pull `main` → rebase `development` onto `main` → rebase current feature branch onto `development` |
| `hotfix` | Emergency fix off `main` → PR to `main` → back-merge into `development` |
| `supabase-ship` | Apply pending migrations + deploy edge functions via MCP, then run advisors |
| `preflight` | Pre-commit gate: typecheck + jest + secrets scan. Blocks on failure |
| `branch-cleanup` | Delete merged feature branches (local + remote), prune stale refs, return to `development` |
| `db-change` | Design and apply a Supabase migration via `db-migration-agent` + Supabase MCP |
| `implement-ticket` | End-to-end ticket implementation (delegates to `ticket-implementer` + `code-reviewer`) |
| `implement-feature` | End-to-end feature workflow for larger work |
