# Dine App — Full Project Context

> Use this document to get Claude up to speed on the Dine codebase. Paste it at the start of a conversation.

## What is Dine?

Social dining app — "Instagram for food meets Splitwise with AI taste intelligence." iOS-first React Native app with Supabase backend. Users post meals, rate dishes, split bills via Venmo, and get AI-powered restaurant recommendations based on their taste profile.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.83 + Expo SDK 55 |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| Styling | NativeWind v4 (TailwindCSS for RN) |
| State | Zustand + AsyncStorage |
| Backend | Supabase (Auth, PostgreSQL, Storage, Edge Functions) |
| AI/ML | OpenAI embeddings (pgvector), GPT-4o Mini (receipt parsing), Google Vision (OCR) |
| Restaurant Data | Google Places API, Yelp Fusion |
| Payments | Venmo deep links (venmo://paycharge) |
| Analytics | Mixpanel |
| Push | Expo Notifications + Supabase Edge Function triggers |
| Language | TypeScript (strict mode) |

---

## Project Structure

```
dine_poc/
├── App.tsx                          # Root entry
├── src/
│   ├── navigation/
│   │   ├── RootNavigator.tsx        # Auth-gated: Splash → Auth → Onboarding → MainTabs
│   │   ├── MainTabNavigator.tsx     # 5 tabs: Feed, Explore, PostCreation (FAB), Activity, Profile
│   │   └── PostCreationNavigator.tsx # 7-step nested stack for meal posts
│   ├── screens/
│   │   ├── auth/AuthScreen.tsx
│   │   ├── onboarding/             # Splash, Welcome, Permissions, ProfileSetup
│   │   ├── tabs/                   # Feed, Explore, Activity, Profile
│   │   ├── post-creation/          # Home, QuickPost, ValidateReceipt, SelectFriends,
│   │   │                           # AssignItems, Summary, RateMeal, AddCaption, PostPrivacy,
│   │   │                           # VenmoRequests
│   │   ├── detail/                 # MealDetail, UserProfile, RestaurantDetail, Comments,
│   │   │                           # EditPost, TaggedRate, EditProfile
│   │   ├── playlists/              # PlaylistDetail, CreatePlaylist
│   │   ├── settings/               # Settings, NotificationPreferences
│   │   ├── recommendations/        # RecommendationsScreen
│   │   ├── credits/                # CreditDashboardScreen
│   │   ├── leaderboard/            # LeaderboardScreen
│   │   └── profile/                # SavedRestaurantsScreen
│   ├── services/                   # Service layer (never call Supabase from screens)
│   │   ├── auth-service.ts
│   │   ├── post-service.ts
│   │   ├── user-service.ts
│   │   ├── receipt-service.ts
│   │   ├── recommendation-service.ts
│   │   ├── credit-service.ts
│   │   ├── contact-service.ts
│   │   ├── bookmark-service.ts
│   │   ├── mention-service.ts
│   │   ├── referral-service.ts
│   │   ├── venmo-service.ts
│   │   ├── leaderboard-service.ts
│   │   └── social-proof-service.ts
│   ├── stores/                     # Zustand stores (8 total)
│   │   ├── authStore.ts
│   │   ├── userProfileStore.ts
│   │   ├── settingsStore.ts
│   │   ├── socialStore.ts
│   │   ├── billSplitterStore.ts
│   │   ├── contactsStore.ts
│   │   ├── splitHistoryStore.ts
│   │   └── notificationsStore.ts
│   ├── types/index.ts              # All TypeScript types (see below)
│   ├── constants/
│   │   ├── config.ts               # Reads keys from expo Constants
│   │   └── colors.ts               # Brand color tokens
│   └── lib/
│       ├── supabase.ts             # Supabase client
│       └── analytics.ts            # Mixpanel wrapper
├── supabase/
│   ├── migrations/                 # 17 SQL migrations (see below)
│   └── functions/                  # 6 Edge Functions (see below)
├── tailwind.config.js
├── app.config.js
└── package.json
```

---

## Navigation Architecture

### Auth Flow
```
Splash → Auth (Google OAuth) → Onboarding (Welcome → Permissions → ProfileSetup) → MainTabs
```

### Main Tabs
```
Feed | Explore | [+ FAB] | Activity | Profile
```
The center tab is a floating action button (gradient blue-purple, raised -16px) that opens the PostCreation flow.

### Post Creation Flow (7 steps)
```
Home → QuickPost (or full flow below)
     → ValidateReceipt → SelectFriends → AssignItems → Summary → RateMeal → AddCaption → PostPrivacy
```

### Deep Linking
- Prefixes: `dine://`, `https://dine.app`
- Routes: `feed`, `explore`, `my-profile`, `post/:postId`, `profile/:userId`, `restaurant/:name`, `split/:splitId`

### Detail Screens (pushed on root stack)
MealDetail, UserProfile, RestaurantDetail, Comments (modal), EditPost, TaggedRate, EditProfile, PlaylistDetail, CreatePlaylist (modal), Settings, NotificationPreferences, Recommendations, VenmoRequests, CreditDashboard, SavedRestaurants, Leaderboard

---

## TypeScript Types

```typescript
// Auth
interface AuthUser { id, email, accessToken }

// User Profile
interface User {
  id, email, display_name, username, avatar_url?, bio?, phone_number?,
  venmo_username?, city?, state?, total_meals, restaurants_visited,
  cities_explored, cuisine_preferences[], dietary_restrictions[],
  credit_balance, current_tier: UserTier, streak_weeks, last_post_week?, created_at
}

// Posts
interface Post {
  id, author_id, author?: User, restaurant_name, city?, state?, address?,
  caption, overall_rating, price_range?, price_per_person?, cuisine_type?,
  tags[], meal_type?, food_photos[], photo_labels?, is_public,
  meal_date?, meal_time?, like_count, comment_count, created_at,
  dish_ratings?, tagged_friends?, receipt_items?,
  receipt_subtotal/tax/tip/discount/total?,
  is_discoverer?, is_quick_post?, is_liked?, recent_comments?
}

// Dish Ratings
interface DishRating { id, post_id?, user_id?, dish_name, rating, notes?, is_star_dish, endorsements? }
interface DishEndorsement { id, dish_rating_id, user_id, emoji, created_at }

// Bill Splitting
interface TaggedFriend { id, post_id, user_id?, display_name, username?, venmo_username?, amount_owed?, has_rated?, rated_at?, contributed_photos?, user? }
interface ReceiptItem { id, name, price, assigned_to[] }
interface ReceiptData { restaurantName, date, time, address, city, state, items[], subtotal, tax, tip, discount, total }
interface PersonBreakdown { friend, items[], itemsTotal, taxShare, tipShare, total }
interface Friend { id, display_name, username?, avatar_url?, venmo_username?, phone_number?, user_id?, contact_id?, is_app_user }

// Contacts
interface Contact { id, owner_id, phone_number?, display_name, venmo_username?, linked_user_id?, split_count, last_split_at?, created_at, updated_at, linked_user? }

// Social
interface Comment { id, post_id, author_id, author?, content, like_count, is_liked?, created_at }
type NotificationType = 'like' | 'comment' | 'comment_like' | 'tag' | 'follow' | 'recommendation'
interface Notification { id, user_id, type, from_user_id, from_user?, post_id?, message, is_read, created_at }

// Playlists & Recommendations
interface Playlist { id, user_id, name, description?, is_public, restaurants[], created_at }
interface PlaylistRestaurant { id, restaurant_name, city?, state?, cuisine_type?, google_place_id?, yelp_id?, notes?, added_at }
interface RestaurantRecommendation { restaurant_name, city, state, cuisine_type?, google_place_id?, yelp_id?, rating?, price_range?, image_url?, matched_dishes[], explanation, match_score }
interface DiningPartner { id, user_id, partner_id, partner?, label, created_at }

// Credits & Tiers
type UserTier = 'rock' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'black'
TierThresholds = { rock: 0, bronze: 100, silver: 500, gold: 2000, platinum: 10000, black: 50000 }
type CreditEventType = 'post_quality' | 'streak' | 'discovery' | 'referral' | 'attribution'
interface CreditEvent { id, user_id, type, credits, source_post_id?, source_user_id?, metadata, created_at }

// Leaderboard
interface LeaderboardEntry { rank, restaurant_name, city, state?, cuisine_type?, avg_rating, post_count, unique_visitors, leaderboard_score, top_dishes[] }
type LeaderboardTimePeriod = 'week' | 'month' | 'quarter' | 'year'

// Social Proof
interface FriendVisit { userId, displayName, username, avatarUrl?, visitCount, latestRating, latestVisitDate, starDishes[] }

// Engagement Tracking
interface PostEngagement { id, user_id, post_id, post_author_id, restaurant_name, engagement_type, created_at }
type EngagementType = 'like' | 'comment' | 'bookmark'

// Post Creation Draft (7-step flow state)
interface CreatePostDraft {
  receiptImages?, receiptData?,
  selectedFriends[], isFamilyStyle, itemAssignments, personBreakdowns?,
  overallRating, dishRatings[],
  foodPhotos[], photoLabels, caption, tags[], cuisineType?, mealType?,
  isPublic, mealDate?
}

// Navigation param lists
type RootStackParamList = {
  Splash, Auth, Onboarding, Main,
  MealDetail: { postId }, UserProfile: { userId },
  RestaurantDetail: { name, city?, placeId? },
  Comments: { postId }, EditPost: { postId }, TaggedRate: { postId },
  EditProfile, PlaylistDetail: { playlistId }, CreatePlaylist,
  Settings, NotificationPreferences, Recommendations,
  VenmoRequests: { breakdowns?, restaurantName?, splitId? },
  CreditDashboard, SavedRestaurants,
  Leaderboard: { city?, cuisine?, period? }
}
```

---

## Database Schema (Supabase/PostgreSQL)

### Extensions
- `pgvector` — taste profile embeddings (1536-dim)
- `pg_trgm` — fuzzy text search on usernames, restaurant names
- `uuid-ossp` — UUID generation

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | User profiles (linked to auth.users) |
| `follows` | Social graph (follower_id, following_id) |
| `dining_partners` | Labeled dining relationships |
| `posts` | Meal posts with ratings, photos, receipt data |
| `dish_ratings` | Per-dish ratings with optional pgvector embedding |
| `post_tagged_friends` | Friends tagged in a post (with amount_owed for splitting) |
| `receipt_items` | Line items from scanned receipts |
| `likes` | Post likes (user_id, post_id) |
| `comments` | Post comments (max 500 chars) |
| `notifications` | In-app notifications |
| `playlists` | Restaurant playlists/wishlists |
| `playlist_restaurants` | Restaurants saved to playlists |
| `user_taste_profiles` | Aggregated 1536-dim taste embedding per user |
| `contacts` | User's contact book (linked to app users when matched) |
| `push_tokens` | Expo push notification tokens |
| `credit_events` | Credit earning/spending history |
| `post_engagements` | Engagement tracking for attribution |
| `referrals` | Referral tracking |
| `split_invites` | Bill split invite links |

### Migrations (17 total)
```
001_initial_schema.sql          — Core tables, RLS policies, RPC functions
002_vector_search_function.sql  — pgvector similarity search
003_photo_labels.sql            — Photo-to-dish name mapping
004_comment_count_functions.sql — Auto-increment/decrement comment counts
005_comment_likes.sql           — Comment like system
006_tagged_user_experience.sql  — Tagged friend rating/photo contributions
007_contacts_system.sql         — Contacts table + phone number matching
008_push_tokens.sql             — Push notification token storage
009_push_notification_trigger.sql — Auto-trigger push on like/comment/follow
010_credit_system.sql           — credit_events table, tier columns, add_credits RPC
011_discovery_credit.sql        — First-to-post-about-restaurant credit
011_streak_tracking.sql         — Weekly posting streak tracking
012_quick_post_flag.sql         — is_quick_post column on posts
013_referrals_and_split_invites.sql — Referral system + split invite links
014_post_engagements.sql        — Attribution tracking for engagement
015_leaderboard_rpc.sql         — Leaderboard aggregation function
017_restaurant_partnerships.sql — Restaurant partnership system
```

### RLS (Row Level Security) — enabled on ALL tables
- Users: public read, self-insert/update
- Posts: public posts visible to all, private to author only
- Follows/Likes: public read, self-manage
- Comments: visible on public posts, self-insert/delete
- Notifications: self-read/update only
- Receipt items: visible to post author + tagged friends only
- Playlists: public or owner-only

### Key RPC Functions
- `increment_like_count(post_id)` / `decrement_like_count(post_id)`
- `upsert_taste_profile(user_id, embedding, total_ratings)`
- `add_credits(user_id, type, credits, metadata)` — atomic credit + tier update
- `get_leaderboard(city, cuisine, period, limit)` — aggregated restaurant rankings

---

## Edge Functions (6)

| Function | Purpose |
|----------|---------|
| `analyze-receipt` | Google Vision OCR → GPT-4o Mini parsing → structured ReceiptData JSON |
| `generate-embedding` | OpenAI text-embedding-3-small for dish ratings → updates user taste profile |
| `get-recommendations` | pgvector cosine similarity + Yelp supplement → ranked restaurant list |
| `upload-photo` | Handles photo uploads to Supabase Storage |
| `send-push-notification` | Sends Expo push notifications |
| `calculate-post-credits` | Scores post quality → awards Dine Credits |

All sensitive API keys (Google Vision, OpenAI, Yelp) live server-side in Edge Functions only.

---

## Key Features

### 1. Post Creation (7-step flow)
Scan receipt → OCR + AI parse → select friends → assign items → rate dishes → add photos/caption → set privacy → optionally request Venmo payments

### 2. Quick Post
Single-screen low-friction posting for when you don't have a receipt.

### 3. Bill Splitting
Receipt items assigned to friends → per-person breakdown (items + tax/tip share) → Venmo deep links for payment collection.

### 4. Taste Intelligence
Each dish rating generates an OpenAI embedding. User's taste profile = weighted centroid of all their dish embeddings (weight = (rating/10)^2, so 9/10 dishes count 4x more than 5/10). Couple recommendations use centroid of both users' embeddings.

### 5. Restaurant Recommendations
pgvector cosine similarity on user taste profile → matched restaurants → supplemented with Yelp data → ranked and explained.

### 6. Dine Credits & Tiers
Credits earned for: post quality, streaks, discovery (first to post about restaurant), referrals, attribution (when your post drives engagement). Tiers: Rock → Bronze (100) → Silver (500) → Gold (2000) → Platinum (10000) → Black (50000).

### 7. Social Features
Follow system, likes, comments with @mentions, notifications (in-app + push), dish endorsements, social proof ("3 friends visited this restaurant").

### 8. Playlists / Wishlists
Save restaurants to named playlists. Bookmark from any restaurant detail screen.

### 9. Leaderboard
Restaurant rankings by city/cuisine/time period, based on community ratings.

---

## Design System

### Colors
```
accent:      #007AFF (iOS blue)
success:     #10B981 (green)
error:       #EF4444 (red)
warning:     #F59E0B (amber/gold)
gold:        #F59E0B

background:           #FFFFFF
background-secondary: #F9FAFB
text-primary:         #1F2937
text-secondary:       #6B7280
border:               #E5E7EB
border-light:         #F3F4F6
```

### Typography (via TailwindCSS)
```
xs:   10px/14px    sm:  12px/16px    base: 14px/20px
md:   16px/24px    lg:  18px/28px    xl:   20px/28px
2xl:  24px/32px    3xl: 32px/40px    4xl:  40px/48px
```

### Styling
NativeWind v4 — use Tailwind classes, never raw StyleSheet for layout/colors. Font family: System.

---

## Environment Variables
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
GOOGLE_VISION_API_KEY=     # Server-side only (Edge Functions)
GOOGLE_PLACES_API_KEY=
OPENAI_API_KEY=            # Server-side only (Edge Functions)
YELP_API_KEY=              # Server-side only (Edge Functions)
GOOGLE_OAUTH_CLIENT_ID=
```
Flow: `.env` → `app.config.js` (extra) → expo-constants → `src/constants/config.ts`

---

## Current State (April 2026)

- **34 screens** built across all flows
- **13 services**, **8 Zustand stores**
- **17 database migrations**, **6 Edge Functions**
- TypeScript strict mode, 0 errors
- iOS-first (no Android yet)
- Deployed via EAS Build
- Tracked in Linear (project: "Upgrade Front End", team: Engineering, key: ENG)

### Recent Work (last 15 commits)
- ENG-74: Fix contact import (native single-contact picker)
- ENG-52: Dine Credit System v2 (attribution, leaderboards, social proof)
- ENG-51: Share to Instagram/iMessage with branded card
- ENG-48: Invite friends via bill split with referral credits
- ENG-50: @Mentions in comments & captions
- ENG-49: Bookmark / Dining Wishlist with playlist picker
- ENG-47: Quick Posts
- ENG-45: Tier-up celebration modal with confetti
- ENG-44: Credit Dashboard screen
- ENG-42: Discovery credit
- ENG-41: Streak tracking
- ENG-40: Post quality scoring
- ENG-39: Credit system database schema

---

## Architectural Patterns & Rules

1. **Service layer**: Screens call services, services call Supabase. Never call Supabase directly from screens.
2. **Server-side secrets**: All API keys (Vision, OpenAI, Yelp) live in Edge Functions only. Supabase anon key is safe client-side (RLS handles auth).
3. **Path alias**: `@/*` maps to `src/*`
4. **NativeWind**: Use Tailwind classes, not StyleSheet for layout/colors.
5. **RLS everywhere**: Every table has Row Level Security enabled.
6. **Taste embeddings**: Weighted centroid, (rating/10)^2 weighting.
7. **Branch naming**: `sankalans/eng-{number}-{slug}` (Linear format)
