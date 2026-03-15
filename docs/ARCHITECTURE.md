# Dine — Architecture Overview

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.83 + Expo SDK 55 |
| Styling | NativeWind v4 (TailwindCSS) |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| State | Zustand + AsyncStorage |
| Backend | Supabase (Auth + PostgreSQL + Storage + Edge Functions) |
| AI/OCR | Google Vision API + OpenAI GPT-4o Mini |
| Embeddings | OpenAI text-embedding-3-small + pgvector |
| Restaurant Data | Google Places API + Yelp Fusion |
| Payments | Venmo deep links |

---

## Folder Structure

```
dine_poc/
├── App.tsx                          # Entry point (GestureHandler + SafeAreaProvider)
├── app.config.js                    # Expo config (reads .env)
├── babel.config.js                  # NativeWind JSX + Reanimated
├── metro.config.js                  # Metro + NativeWind CSS
├── tailwind.config.js               # Brand colors, font sizes
├── global.css                       # Tailwind directives
├── eas.json                         # EAS build profiles
│
├── src/
│   ├── types/index.ts               # All TypeScript definitions (306 lines)
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx        # Auth-gated root stack
│   │   ├── MainTabNavigator.tsx     # 5-tab bottom nav
│   │   └── PostCreationNavigator.tsx # 8-step post creation flow
│   │
│   ├── screens/                     # 28 screens across 7 folders
│   │   ├── auth/                    # AuthScreen
│   │   ├── onboarding/              # Splash, Welcome, Permissions, ProfileSetup
│   │   ├── tabs/                    # Feed, Explore, Activity, Profile
│   │   ├── post-creation/           # 8 steps + VenmoRequests
│   │   ├── detail/                  # MealDetail, UserProfile, Restaurant, Comments, Edit
│   │   ├── playlists/               # CreatePlaylist, PlaylistDetail
│   │   ├── recommendations/         # RecommendationsScreen
│   │   └── settings/                # SettingsScreen
│   │
│   ├── components/
│   │   ├── ui/                      # Button, Avatar, RatingSlider, TagChip, EmptyState, etc.
│   │   └── post/                    # PostCard, PhotoCarousel, LikeButton, StarDishes
│   │
│   ├── stores/                      # Zustand state management
│   │   ├── authStore.ts             # Auth state & Supabase session
│   │   ├── socialStore.ts           # Feed, posts, likes, drafts
│   │   ├── billSplitterStore.ts     # Receipt, item assignment, breakdowns
│   │   ├── userProfileStore.ts      # Profile, follows, partners, playlists
│   │   ├── notificationsStore.ts    # Notifications & unread count
│   │   ├── settingsStore.ts         # Theme, tax/tip prefs, onboarding flag
│   │   └── splitHistoryStore.ts     # Persistent split history
│   │
│   ├── services/                    # Business logic & API calls
│   │   ├── auth-service.ts          # User profile CRUD
│   │   ├── post-service.ts          # Post CRUD, likes, comments
│   │   ├── user-service.ts          # Search, follows, frequent friends
│   │   ├── receipt-service.ts       # OCR, image compression, uploads
│   │   ├── recommendation-service.ts # Edge Function calls
│   │   └── venmo-service.ts         # Deep links & payment requests
│   │
│   ├── lib/
│   │   └── supabase.ts             # Supabase client (anon key + AsyncStorage)
│   │
│   ├── constants/
│   │   ├── config.ts                # Runtime config from expo-constants
│   │   ├── colors.ts                # Color palette
│   │   ├── shadows.ts               # iOS shadow utilities
│   │   └── tags.ts                  # Tag options (cuisine, meal type, occasion)
│   │
│   └── utils/
│       └── format.ts                # Formatting helpers
│
├── supabase/
│   ├── migrations/                  # SQL schema migrations
│   │   ├── 001_initial_schema.sql   # Core tables, RLS, indexes
│   │   ├── 002_vector_search_function.sql
│   │   ├── 003_photo_labels.sql
│   │   ├── 004_comment_count_functions.sql
│   │   └── 005_comment_likes.sql
│   │
│   └── functions/                   # Deno Edge Functions
│       ├── analyze-receipt/          # Google Vision + GPT-4o Mini
│       ├── generate-embedding/       # OpenAI embeddings + taste profiles
│       ├── get-recommendations/      # pgvector similarity search
│       └── upload-photo/             # Storage uploads (service role)
│
└── assets/                          # App icons, splash screen
```

---

## Navigation Architecture

```
RootNavigator (native-stack)
├── Splash
├── Auth
├── Onboarding (Welcome → Permissions → ProfileSetup)
└── Main (bottom-tabs)
    ├── Feed
    ├── Explore
    ├── PostCreation (nested stack, 8 steps)
    │   ├── Home (capture receipt)
    │   ├── ValidateReceipt
    │   ├── SelectFriends
    │   ├── AssignItems
    │   ├── Summary
    │   ├── RateMeal
    │   ├── AddCaption
    │   └── PostPrivacy
    ├── Activity
    └── Profile

Detail screens (modals over Main):
├── MealDetail
├── UserProfile
├── RestaurantDetail
├── Comments
├── EditPost / EditProfile
├── PlaylistDetail / CreatePlaylist
├── Settings
├── Recommendations
└── VenmoRequests
```

Auth gating: `RootNavigator` checks `useAuthStore()` and `useSettingsStore().hasCompletedOnboarding` to determine which stack to show.

---

## State Management

All state lives in Zustand stores. No Redux, no Context API (except navigation).

| Store | Responsibility | Persisted? |
|-------|---------------|-----------|
| `authStore` | User session, sign in/out | Supabase handles |
| `socialStore` | Feed posts, drafts, likes | No (fetched fresh) |
| `billSplitterStore` | Current receipt, item assignments, breakdowns | No (per-session) |
| `userProfileStore` | Profile, follows, partners, playlists | No (fetched fresh) |
| `notificationsStore` | Notifications, unread count | No (fetched fresh) |
| `settingsStore` | Theme, tip/tax prefs, onboarding | Yes (AsyncStorage) |
| `splitHistoryStore` | Who you've split with, how often | Yes (AsyncStorage) |

---

## Data Flow: Post Creation

```
1. User captures receipt image
2. Image compressed → sent to analyze-receipt Edge Function
3. Google Vision OCR → GPT-4o Mini structures → ReceiptData returned
4. User validates/edits receipt data
5. User selects friends, assigns items
6. billSplitterStore.calculateBreakdowns() computes per-person totals
7. User rates dishes, adds photos/caption
8. post-service.createPost() inserts:
   - posts row
   - receipt_items rows
   - dish_ratings rows
   - post_tagged_friends rows
9. generate-embedding Edge Function fires (async) for each rated dish
10. splitHistoryStore records the split
11. Venmo deep links available for payment requests
```

---

## Security Model

- **Client-side**: Only Supabase anon key exposed. All data access gated by Row Level Security (RLS).
- **Server-side**: API keys for Vision, OpenAI, and Yelp live exclusively in Edge Functions as environment secrets.
- **Auth**: Supabase Auth with JWT tokens, auto-refreshed via `@supabase/supabase-js`.
- **RLS policies**: Every table has policies ensuring users can only read/write appropriate data.

---

## Taste Intelligence (pgvector)

1. User rates a dish → `generate-embedding` Edge Function creates a 1536-dim vector
2. Vector weighted by `(rating/10)^2` — a 9/10 dish weighs 4x more than a 5/10
3. User's `user_taste_profiles` row updated with weighted average of all dish embeddings
4. `get-recommendations` uses cosine similarity to find dishes/restaurants matching the user's taste
5. For couples: centroids of both users' embeddings are averaged
