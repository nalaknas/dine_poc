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
| `pm-requirements-breakdown` | Break down a feature idea into user stories, acceptance criteria, and sized tasks |
| `component-spec-designer` | Design a component spec (props, variants, states, accessibility) before building |
| `ticket-implementer` | Implement a Linear ticket by ID — fetches issue, plans, and writes code |
| `db-migration-agent` | Create, validate, or apply Supabase migrations (schema, RLS, indexes) |
| `code-reviewer` | Review written code for bugs, security, and pattern consistency |
| `design-system-builder` | Build screens/components that match the established design system |

### Typical workflow
1. **Plan**: `pm-requirements-breakdown` to decompose the feature
2. **Spec**: `component-spec-designer` for new UI components
3. **Schema**: `db-migration-agent` if DB changes are needed
4. **Build**: `ticket-implementer` or `design-system-builder` to implement
5. **Review**: `code-reviewer` after implementation

Agents can be composed in parallel when tasks are independent (e.g., db-migration-agent + component-spec-designer).
