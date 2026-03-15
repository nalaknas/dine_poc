# Dine — Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Choose your organization, name the project (e.g., `dine`), set a database password, and select a region
4. Copy the **Project URL** and **anon key** into your `.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   ```

---

## 2. Enable Extensions

Run these in the Supabase SQL Editor (**Database → SQL Editor**):

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

---

## 3. Apply Database Migrations

Apply migrations in order via the SQL Editor or Supabase CLI:

### Option A: SQL Editor (manual)

Run each file in order:
1. `supabase/migrations/001_initial_schema.sql` — Core tables, RLS policies, indexes
2. `supabase/migrations/002_vector_search_function.sql` — `find_similar_dishes()` function
3. `supabase/migrations/003_photo_labels.sql` — Photo metadata columns
4. `supabase/migrations/004_comment_count_functions.sql` — Comment count RPC
5. `supabase/migrations/005_comment_likes.sql` — Comment likes table + functions

### Option B: Supabase CLI

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

---

## 4. Verify Tables

After applying migrations, you should see these tables in **Table Editor**:

| Table | Description |
|-------|-------------|
| `users` | User profiles (linked to auth.users) |
| `follows` | Follower/following relationships |
| `dining_partners` | Labeled partnerships between users |
| `posts` | Meal posts with ratings, receipts, photos |
| `dish_ratings` | Per-dish ratings with embedding vectors |
| `post_tagged_friends` | Friends tagged in each post |
| `receipt_items` | Receipt line items with assignments |
| `likes` | Post likes |
| `comments` | Post comments |
| `comment_likes` | Comment likes |
| `notifications` | User notifications |
| `playlists` | Restaurant collections |
| `playlist_restaurants` | Restaurants in playlists |
| `user_taste_profiles` | pgvector taste embeddings |

All tables have RLS enabled with appropriate policies.

---

## 5. Deploy Edge Functions

### Prerequisites

```bash
# Install Supabase CLI if not already
brew install supabase/tap/supabase

# Log in
supabase login

# Link project
supabase link --project-ref your-project-ref
```

### Deploy all functions

```bash
supabase functions deploy analyze-receipt
supabase functions deploy generate-embedding
supabase functions deploy get-recommendations
supabase functions deploy upload-photo
```

### Set Edge Function secrets

```bash
supabase secrets set GOOGLE_VISION_API_KEY=your-key
supabase secrets set OPENAI_API_KEY=your-key
supabase secrets set YELP_API_KEY=your-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

You can find the **Service Role Key** in Supabase Dashboard → Settings → API → `service_role` key.

> **Important:** The service role key bypasses RLS. It is used by Edge Functions only (e.g., `upload-photo`). Never expose it client-side.

---

## 6. Create Storage Buckets

In the Supabase Dashboard → Storage:

1. Create a bucket named **`avatars`** (public)
2. Create a bucket named **`food-photos`** (public)
3. Create a bucket named **`receipts`** (private)

Or via SQL:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('food-photos', 'food-photos', true),
  ('receipts', 'receipts', false);
```

---

## 7. Configure Authentication

In Supabase Dashboard → Authentication → Providers:

1. **Email** — Enabled by default
2. **Google OAuth** (optional):
   - Enable the Google provider
   - Add your Google OAuth Client ID and Secret
   - Set the redirect URL to your Expo auth callback

---

## 8. Local Development (Optional)

```bash
# Start local Supabase (Docker required)
supabase start

# This gives you local URLs for Supabase services
# Update .env to point to local:
# SUPABASE_URL=http://localhost:54321
# SUPABASE_ANON_KEY=<local-anon-key>

# Serve Edge Functions locally
supabase functions serve

# Stop local Supabase
supabase stop
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Link project | `supabase link --project-ref <ref>` |
| Push migrations | `supabase db push` |
| Deploy function | `supabase functions deploy <name>` |
| Set secret | `supabase secrets set KEY=value` |
| List secrets | `supabase secrets list` |
| Start local | `supabase start` |
| Serve functions locally | `supabase functions serve` |
| Reset local DB | `supabase db reset` |
| Generate types | `supabase gen types typescript --linked > src/types/supabase.ts` |
