# Dine — Feature Guide

## Overview

Dine is a social dining app that combines Instagram-style food sharing with intelligent receipt scanning and bill splitting. Below is a breakdown of every major feature.

---

## 1. Authentication & Onboarding

### Sign Up / Sign In
- Email + password authentication via Supabase Auth
- Google OAuth support
- Persistent sessions via AsyncStorage (auto-refresh tokens)

### Onboarding (first launch only)
1. **Splash** — Logo animation
2. **Welcome Tour** — 4 swipeable cards explaining features
3. **Permissions** — Camera, photo library, contacts (optional), notifications (optional)
4. **Profile Setup** — Avatar, display name, dietary preferences
5. **Complete** — Enter the main app

The `settingsStore.hasCompletedOnboarding` flag prevents re-showing onboarding.

---

## 2. Post Creation (8-Step Flow)

The core user journey, accessed via the center "+" tab button.

### Step 1: Capture Receipt
- Take a photo or select from library
- Supports multiple images for long receipts
- Images compressed to 1500px / 0.6 JPEG before upload

### Step 2: Validate Receipt
- `analyze-receipt` Edge Function runs Google Vision OCR + GPT-4o Mini
- User reviews and edits: restaurant name, date, address, line items, totals
- Can add/remove/rename items, adjust prices

### Step 3: Select Friends
- Search from frequent friends (based on split history)
- Search all app users
- Add manual (non-app) friends with name and optional Venmo username
- Friends are stored in `billSplitterStore.selectedFriends`

### Step 4: Assign Items
- **Family Style toggle**: All items split equally among everyone
- **Per-item assignment**: Tap each item to assign to specific people
- Items can be shared (split between multiple people)
- Real-time per-person totals update as you assign

### Step 5: Summary
- Review each person's breakdown:
  - Items assigned to them
  - Their share of tax (proportional or equal, per settings)
  - Their share of tip (proportional or equal, per settings)
  - Total owed

### Step 6: Rate the Meal
- Overall restaurant rating (0-10 slider)
- Per-dish ratings (0-10 each, optional notes)
- Dishes rated 7+ automatically become "Star Dishes"

### Step 7: Add Caption & Photos
- Upload up to 10 food photos
- Write a caption
- Select tags: meal type, cuisine, occasion

### Step 8: Privacy & Publish
- Choose Public (appears in feed) or Private (journal only)
- Creates post + receipt_items + dish_ratings + tagged_friends
- Fires off embedding generation for rated dishes (async)
- Records split in history store

---

## 3. Social Feed

### Feed Tab
- Shows posts from people you follow + your own posts
- Instagram-style post cards with:
  - Author info and restaurant name
  - Photo carousel (swipeable)
  - Like button, comment count, share
  - Caption and tags
  - Star Dishes section (dishes rated 7+)
  - Tagged friends
  - Timestamp
- Pull-to-refresh
- Empty state prompts you to follow friends

### Likes
- Tap heart for optimistic like toggle
- Creates a notification for the post author
- Like count updated atomically via RPC

### Comments
- View all comments on a post
- Add comments with notifications to the post author
- Like individual comments

---

## 4. Star Dishes

Dishes rated 7+ out of 10 are highlighted as "Star Dishes" on post cards. Only the top 3 are shown.

- Displayed with gold/amber styling
- Helps friends know what to order
- Each star dish shows the dish name and rating

---

## 5. User Profiles

### Your Profile (Profile Tab)
- Avatar, display name, username, bio
- Stats: total meals, restaurants visited, cities explored
- Follower/following counts
- Grid of your posts
- Your restaurant playlists
- Edit profile option

### Other User Profiles
- Same layout as your profile
- Follow/unfollow button
- Only public posts visible (unless you're tagged in a private one)

---

## 6. Explore & Discovery

### Explore Tab
- Search users by username or display name
- Uses PostgreSQL `pg_trgm` for fuzzy matching
- Quick follow buttons on results

---

## 7. Activity & Notifications

### Activity Tab
- Chronological list of notifications
- Types: like, comment, comment_like, tag, follow, recommendation
- Unread badge on the tab icon
- Mark individual or all as read
- Tap to navigate to the relevant post or profile

---

## 8. Bill Splitting

### Calculation Logic

**Per-item assignment:**
```
personItemsTotal = sum(item.price / item.assignedTo.length) for their items
personTaxShare = tax * (personItemsTotal / subtotal)  [proportional]
              OR tax / numPeople                       [equal]
personTipShare = tip * (personItemsTotal / subtotal)   [proportional]
              OR tip / numPeople                       [equal]
personTotal = personItemsTotal + personTaxShare + personTipShare
```

**Family style:**
- All items split equally among all friends
- Tax and tip also split equally

### Settings
- Tax split method: equal or proportional (in `settingsStore`)
- Tip split method: equal or proportional
- Default tip percentage

---

## 9. Venmo Integration

- Users can set their Venmo username on their profile
- After a post, the Venmo Requests screen shows each friend's total
- One-tap to open Venmo with pre-filled:
  - Recipient username
  - Amount
  - Note (e.g., "Dine split: Restaurant Name - 03/15/2026")
- Deep link: `venmo://paycharge?txn=charge&recipients={username}&amount={amount}&note={note}`
- Falls back to Venmo web profile if the app isn't installed

---

## 10. Restaurant Playlists

- Create named collections (e.g., "Date Night Spots", "Want to Try")
- Add restaurants from posts or search
- Public or private playlists
- Each entry can have notes, Google Place ID, Yelp ID

---

## 11. Taste Intelligence & Recommendations

### How Taste Profiles Work
1. You rate dishes in your posts
2. Each rated dish gets a 1536-dim embedding (OpenAI text-embedding-3-small)
3. Embeddings are weighted by `(rating/10)^2` — a 9/10 matters 4x more than a 5/10
4. Your taste profile = weighted average of all your dish embeddings

### Recommendations
- Personalized restaurant suggestions based on your taste profile
- Couple mode: averages your embedding with your partner's
- Uses pgvector cosine similarity to find similar dishes in the database
- Supplemented with Yelp API data (rating, reviews, price, photos)

---

## 12. Settings

- **Theme**: Light / Dark / System
- **Tax split method**: Equal / Proportional
- **Tip split method**: Equal / Proportional
- **Default tip percentage**
- **Sign out**
- **Delete account**
