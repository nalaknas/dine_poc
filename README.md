# Dine

**Instagram for food meets Splitwise — with AI taste intelligence.**

A social dining app where you share meals, split bills, and get personalized restaurant recommendations powered by your actual eating history.

---

## What It Does

Every time you eat out, you snap a photo, scan the receipt, rate your dishes, and split the bill — all in one flow. Over time, Dine builds a **taste profile** from your ratings and uses AI to recommend restaurants you'll actually love.

### Core Features

- **Social Feed** — Post meals with photos, dish ratings, restaurant tags, and captions
- **Receipt Scanning** — OCR-powered receipt parsing that extracts line items automatically
- **Bill Splitting** — Assign items to friends, calculate totals with tax/tip, send Venmo requests
- **AI Taste Profiles** — Every dish rating becomes a vector embedding; your palate is represented mathematically
- **Smart Recommendations** — Vector similarity search finds restaurants that match your preferences
- **Couple Mode** — Finds spots that match *both* your palates by computing the midpoint of two taste profiles
- **Restaurant Playlists** — Curate and share lists of favorite spots

## How the AI Works

1. You rate a dish (e.g., "Spicy Miso Ramen — 9/10")
2. The dish is converted into a 1536-dimensional embedding
3. Higher ratings carry exponentially more weight — a 9/10 dish influences your profile 4x more than a 5/10
4. Your taste profile vector evolves with every meal
5. Recommendations are found via cosine similarity against restaurant vectors, enriched with live data

## Tech Highlights

| Area | Approach |
|---|---|
| **Frontend** | React Native + Expo (iOS-first), NativeWind for styling, Zustand for state |
| **Backend** | Supabase — Auth, PostgreSQL, Storage, Edge Functions (Deno) |
| **AI/ML** | OpenAI embeddings + pgvector for taste similarity search |
| **Receipt OCR** | Google Cloud Vision → GPT-4o Mini structured parsing |
| **Security** | All third-party API keys are server-side only; client uses Supabase anon key with row-level security on every table |
| **Payments** | Venmo deep links with web fallback |

## Scale

- **28 screens** across auth, onboarding, feed, post creation (7-step flow), detail views, playlists, recommendations, and settings
- **14 database tables** with RLS policies, vector indexes, and trigram search
- **3 Edge Functions** handling receipt analysis, embedding generation, and recommendation serving
- **6 Zustand stores** managing auth, social, notifications, settings, user profiles, and bill splitting

---

Built with React Native, Supabase, and a lot of good meals.
