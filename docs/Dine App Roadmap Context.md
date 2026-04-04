# Dine — Product Roadmap & Strategic Context
> Internal planning document. Use this to draw up Linear tickets, prioritize sprints, and align on product direction.
> Last updated: April 2026

---

## Table of Contents
1. [Product Vision](#1-product-vision)
2. [Target User](#2-target-user)
3. [The Core Loop](#3-the-core-loop)
4. [Strategic Pillars](#4-strategic-pillars)
5. [Layer 1 — Beta Readiness (NYC Launch)](#5-layer-1--beta-readiness-nyc-launch)
6. [Layer 2 — Restaurant Partnerships & Automation](#6-layer-2--restaurant-partnerships--automation)
7. [Layer 3 — Agent, B2B & Full Automation](#7-layer-3--agent-b2b--full-automation)
8. [Data Pipeline — Pre-Launch Lift](#8-data-pipeline--pre-launch-lift)
9. [Taste Intelligence System](#9-taste-intelligence-system)
10. [Credit & Tier System — Full Vision](#10-credit--tier-system--full-vision)
11. [Monetization Strategy](#11-monetization-strategy)
12. [Ticket Backlog by Layer](#12-ticket-backlog-by-layer)

---

## 1. Product Vision

**"The dining OS — from finding a restaurant to splitting the bill to knowing exactly what to order, all powered by your actual taste."**

Dine closes the full loop of the dining experience:
- **Before** the meal: AI agent finds restaurants matched to your (and your friends') actual taste profiles, surfaces what to order, books the table
- **During** the meal: frictionless bill splitting via POS integration or receipt scan, no phone required
- **After** the meal: dish ratings that compound into increasingly accurate taste intelligence

The long-term defensible moat is **the taste embedding data** — personal, compounding, and impossible to replicate without time and real meals.

---

## 2. Target User

Two personas that must coexist in the same city for the network to work:

### The Social Diner
- Age 20-40, goes out in groups regularly
- Primary need: split bills fairly, remember where they ate
- Hook: bill splitting. Everything else is a bonus.
- Needs frictionless above all else
- Generates the data volume

### The Foodie Micro-Influencer
- Even with 10 followers, self-identifies as a tastemaker
- Primary need: track and share their food identity, be the person friends ask for recs
- Hook: tier system, attribution score, influence credentials
- Will put in effort to rate dishes properly
- Gives the data credibility

**The Social Diner generates data. The Micro-Influencer makes it credible.**
Neither works without the other in the same city.

### Go-To-Market: City by City
- Launch city: **New York City**
- Initial neighborhood focus: West Village / Lower East Side / Williamsburg (where the beta friend network actually goes)
- Success metric for city one before expanding: 500-1000 highly active users, 10+ restaurant partners
- Why density matters: scattered national data is worth nothing to B2B buyers. Dense city data is worth a lot.

---

## 3. The Core Loop

```
Discover restaurant via Dine map / agent
        ↓
Book (via Resy/OpenTable embed or preferred table perk)
        ↓
Check in at table (NFC/QR tag — Layer 2)
        ↓
Eat — POS auto-captures itemized bill (Layer 2)
   or  scan receipt (Layer 1)
        ↓
Split bill → Venmo requests sent automatically
        ↓
Rate dishes (in-app or via voice log)
        ↓
Taste profile updates → recommendations improve
        ↓
Agent gets smarter → better next discovery
```

**The loop compounds.** Every meal makes the next recommendation better. The more friends use it together, the better group matching gets. This compounding value is what's very hard for a competitor to replicate.

---

## 4. Strategic Pillars

### Pillar 1 — Frictionless Dining Utility
Bill splitting and post creation must be near-zero effort. This is the primary retention mechanism for the Social Diner persona. If it's harder than Venmo + a text, they won't use it.

### Pillar 2 — Taste Intelligence That Feels Like Magic
The first recommendation needs to feel eerily accurate. Cold start must be solved at onboarding with a taste calibration flow that seeds the embedding before the first post. The comparison/calibration engine (Elo ranking within cuisine categories) adds ongoing calibration depth.

### Pillar 3 — Social Credentials for Tastemakers
The tier system must translate into real-world value — not just badges. Platinum/Black users need visible status (on restaurant pages, on their profile) and tangible perks (preferred tables, comp meals, early access). This creates aspiration and retention for the Micro-Influencer persona.

### Pillar 4 — Restaurant Data Network
Every restaurant page is a community-verified data asset. Dish-level sentiment, visitor demographics, social proof. This is the foundation of the B2B business. Build the consumer data first, monetize it second.

---

## 5. Layer 1 — Beta Readiness (NYC Launch)

These are the features required before sharing the beta with the NYC friend network. Sequenced by priority.

### 5.1 Non-Negotiables (Blockers)

#### Apple Sign-In
- Currently Google OAuth only. App Store guidelines require Apple Sign-In when offering social login on iOS.
- Meaningful conversion impact — a significant share of the target demo will bounce at Google-only.
- **Effort: 1-2 days**

#### Collapse the Post Creation Flow
- 7 steps is too many. The split and the post need to be decoupled.
- New frame: **scan receipt → tag friends → done in under 2 minutes.** Everything else (dish ratings, captions, privacy) is async, surfaced later via notification.
- Venmo requests should go out the moment items are assigned. Rating and captioning are optional enrichment steps.
- **Effort: 3-5 days**

#### Non-Dine User Split Experience (Web)
- First demo will immediately involve splitting with someone not on the app.
- The web split invite must be polished — fast load, clear item assignment, Venmo pay button, soft but compelling join prompt.
- This is the single best acquisition surface. Treat it like a landing page, not an afterthought.
- **Effort: 3-5 days**

### 5.2 Wow Features (What Creates Word of Mouth)

#### Taste Calibration Onboarding
New users must not get generic recommendations. Seed the embedding at onboarding with a 3-round calibration flow:

**Round 1 — The Gut Check (3 binary questions, 15 seconds)**
Forces commit on high-information splits:
- Hole in the wall vs. beautiful room
- Adventurous and new vs. reliable and familiar
- Sharing plates vs. your own plate

**Round 2 — The Dish Swipe (12-15 dishes, Tinder-style)**
Full-screen dish photos, swipe right/left. No labels — capture visceral visual reaction not intellectual preference. Mix protein types, preparation styles, cuisine signals, and price signals in the plating.

**Round 3 — The Akinator Questions (3-4 smart questions)**
Dynamically served based on Round 1+2 results. High-information questions that cut remaining population most efficiently:
- "When someone asks where to eat, you say: 'Let me look it up' / 'I know a place' / 'I don't mind, you pick'"
- "Ideal Friday night: big group dinner / intimate dinner for two / quick bite / solo at the bar"
- "Pick the dish that sounds most like you" → 4 options mapping to distinct taste embedding coordinates

**The Payoff: Taste Identity Reveal**
Before entering the app, show a taste identity card:
> *"You're an Adventurous Purist. You seek bold flavors in humble settings and care more about what's on the plate than what's on the walls. Your city has 47 restaurants that match your profile."*
Immediately followed by 3 personalized restaurant recommendations. First moment in the app should feel like it already knows them.
- **Effort: 1 week**

#### Phone Number Backfill (The Magic Moment)
When a user creates an account, any meal they've previously been tagged in (via phone number) should auto-populate their profile. Their feed isn't empty. Their restaurant history isn't empty. Their friend connections are partially formed already.

The pre-signup experience: non-Dine users tagged in a split receive a web link framed as their profile stub — "Jake tagged you in a meal at Carbone. See what you had." When they sign up it becomes real.

This is the single most powerful retention hook in the product. An app that already has your history feels like home, not a new thing to populate.
- **Effort: 3-4 days**

#### Rich Restaurant Pages with Social Proof
The restaurant detail screen should feel like the definitive community guide to that place. Must show:
- Top rated dishes from Dine users (or editorial data pre-launch)
- Which friends have been here and what they ordered
- "What to order based on your taste profile" — personalized per user
- Editorial pull quotes (Infatuation, Eater) where available pre-launch

This differentiates from Yelp immediately. It's not just reviews — it's personalized, friend-sourced intelligence.
- **Effort: 1 week**

#### Taste Profile as Identity Feature
The profile screen should show someone's food identity back to them visually and in a shareable format:
- Top cuisines and dish types
- Restaurants discovered first (discoverer badge)
- Cities eaten in
- Most rated dishes
- Taste archetype label from onboarding

Something they'd screenshot and send to friends. Currently profiles feel like stats. They should feel like personality.
- **Effort: 3-4 days**

#### Elo Comparison Engine (Taste Calibration v2)
After a user has rated 5+ restaurants in the same cuisine, trigger a calibration prompt:
> "You've been to 8 ramen spots. Rank them to sharpen your recommendations."

Tinder-style comparison cards showing two of their past experiences head-to-head, including their own previous ratings. Each choice runs an Elo update on both restaurants.

**Why this matters:**
- Humans are bad at absolute ratings (what does 7/10 mean?) but excellent at relative comparison
- The delta between Elo ranking and original rating is itself signal — reveals preferences the number couldn't capture
- After 10-15 comparisons, produces a calibrated relative ranking within a cuisine category
- Feeds directly into taste embedding with more accurate weighting

**Post-comparison reveal:**
> "Across your 8 ramen visits you've never picked a shoyu broth over a tonkotsu. We found 3 spots you'd probably love."

This moment — where the app tells you something true about yourself — is the shareable magic moment.
- **Effort: 1 week**

#### Google Maps Saved Places Import
Let users import their Google Maps saved restaurants and review history. Many people in the target demo have hundreds of saved places. Importing this populates restaurant history and partially seeds taste profile before they've posted anything on Dine.
- **Effort: 2-3 days**

### 5.3 Contacts
- Apple Sign-In → ENG-XXX
- Collapse post creation flow → ENG-XXX
- Non-Dine web split experience polish → ENG-XXX
- Taste calibration onboarding (3-round flow) → ENG-XXX
- Phone number backfill for new signups → ENG-XXX
- Restaurant page social proof layer → ENG-XXX
- Taste profile identity screen → ENG-XXX
- Elo comparison engine → ENG-XXX
- Google Maps import → ENG-XXX

---

## 6. Layer 2 — Restaurant Partnerships & Automation

**Do not build until city one has 500+ active users.** Without the users, there's no leverage to get restaurants to partner. With real user data about their restaurant, the pitch writes itself.

### 6.1 Restaurant Page Auto-Generation (Ghost Pages)
Every restaurant a user posts about gets a Dine page auto-generated from Google Places + Yelp data. Restaurant doesn't need to do anything. Their page grows organically as users post. This is how Yelp bootstrapped inventory.

### 6.2 Claim Your Page Flow
When a restaurant hits a threshold (e.g. 5+ posts, real dish ratings), send an automated email:
> "Your restaurant has been reviewed by X Dine users in the last 30 days. Here's what they're saying about your [top dish]. Claim your page to see full analytics."

Claim flow: verify via business email or Google Business Profile match. Simple.

### 6.3 POS Integration (Toast / Clover)
**This is the most important Layer 2 feature.**

The vision: restaurant is a Dine partner → installs Dine integration on Toast/Clover → when a table closes, POS fires a webhook to Dine with itemized receipt → Dine matches table to party → users get push notification "Your bill at Nobu is ready — tap to split."

Nobody takes their phone out. No receipt photo. No OCR. Clean structured data straight from the POS.

**Table-to-user matching options:**
- Reservation was made through or linked to Dine (know automatically)
- Host checks in the party through Dine restaurant portal when seated
- NFC/QR tag on table (user taps when seated, see 6.4)

**APIs available:**
- Toast Partner Connect — reads order data, table status, itemized checks
- Clover App Marketplace — build integration running inside their POS
- Square has similar open APIs

**The pitch to restaurants:** Dine users book more, spend more, and you get dish-level analytics you can't get anywhere else. Performance-based, no upfront cost.

### 6.4 NFC / QR Table Check-In
NFC sticker or QR code on every table at partner restaurants. User taps/scans when seated → Dine opens, knows they're at Table 7 at this restaurant → when bill comes through POS it routes to them automatically.

For solo diners: tap the tag, restaurant and meal context pre-loaded, receipt comes in automatically, rate the dishes. No photos required unless desired.

**QR is the pragmatic launch version** (no hardware required, every phone reads it, restaurants understand from COVID menus). Upgrade to NFC as partnerships deepen.

### 6.5 Preferred Table Perk
Dine doesn't need to build a reservation system. Work around existing lock-in:

**For restaurants on OpenTable/Resy:** Embed their booking widget directly in the Dine restaurant detail screen. Dine is the discovery and identity layer, not the booking infrastructure.

**The preferred table mechanic:**
- Gold/Platinum/Black tier users tap "I want to visit" on a restaurant page
- Restaurant gets notified through Dine restaurant portal with user's tier and taste profile
- Restaurant manually holds a house table (most restaurants keep tables outside OpenTable for VIPs)
- No reservation API needed. Just a portal notification and a relationship.

**Longer term:** As more restaurants commit to Dine directly, preferred tables become a genuine perk tied to tier. This is a relationship business built city by city.

### 6.6 Voice Post Logging (Siri / Widget)
Low-friction post capture at the highest-signal moment — walking out of the restaurant.

**Flow:**
1. User says "Hey Siri, log a meal on Dine" OR taps microphone widget on lock screen
2. Records 30-60 second voice note describing the meal
3. Whisper API transcribes → GPT-4o Mini extracts structured data:
   - Restaurant name
   - Dishes tried with inferred ratings from language ("absolutely insane" = 9.5, "fine but not worth it" = 6)
   - Friends mentioned (cross-referenced against contacts/social graph for auto-tagging)
   - Overall sentiment
4. Processed in background → push notification: "Your meal at Carbone is ready to review"
5. User opens draft, confirms/edits, publishes in one tap

**Why voice data is better data:**
- Captures sensory memory before it fades
- Sentiment inferred from natural language is more honest than deliberate numerical rating
- Rich linguistic data ("the broth was so deeply savory") creates better embedding signal than a number
- Over time, the voice corpus is training data for making agent recommendations sound natural and personal

**Technical stack:**
- iOS App Intents API for Siri shortcut
- iOS Widget with microphone button
- OpenAI Whisper for transcription (Edge Function)
- GPT-4o Mini for NLP extraction (Edge Function)
- Draft confirmation screen before any publishing

---

## 7. Layer 3 — Agent, B2B & Full Automation

**Do not build until Layer 2 has 10+ active restaurant partners in city one.**

### 7.1 The Dine Agent
The feature that defines what Dine actually is in 3 years.

**User input:** "Find somewhere for me, Sarah and Mike this weekend, nothing we've been to, under $80pp, lower east side"

**Agent does:**
1. Pulls taste profiles for all three users
2. Computes multi-profile taste match — finds overlap in all three embeddings
3. Surfaces 3 restaurant options with "why you'll love it" tailored per person
4. Highlights specific dishes each person should order based on their individual profile
5. Books via Resy/OpenTable API (or triggers preferred table request at Dine partners)
6. Sends group notification with restaurant, time, and personalized dossier of what to order

**After the meal:**
Post creation, split, and rating auto-initiated. Agent closes the loop.

**Required integrations for full version:**
- OpenTable API (booking)
- Resy API (booking)
- Google Reserve

**Why nobody else can build this:**
- They don't have individual dish-level taste profiles
- They don't have the social graph of who eats with whom
- They don't have historical group dining context
- The recommendations compound with every meal — can't be replicated without the data history

### 7.2 B2B Restaurant Analytics Dashboard

**What you're sitting on:** dish-level sentiment data that doesn't exist anywhere else. Yelp knows people liked a restaurant. Dine knows people loved the miso black cod but thought the ramen was overpriced. That's a fundamentally different and more valuable signal.

**Product: Restaurant Analytics Dashboard (sold as SaaS)**
- Average dish ratings and trend over time
- Demographic breakdown of visitors (age range, dining frequency, tier level)
- "What's resonating" — top performing dishes by rating and reorder rate
- Competitive context — how you compare to similar restaurants in your neighborhood
- High-influence visitor alerts — notify restaurant when a Gold+ tier user bookmarks or visits

**Pricing model:** Monthly SaaS, tiered by restaurant size. Entry level for independent restaurants, premium for groups.

### 7.3 Alternative Data Sales

**The longer-term, higher-value B2B play:**

Foot traffic signals and dish sentiment trends at scale are valuable to:
- Hedge funds and private equity (restaurant chain performance signals before they appear in earnings)
- CPG brands (which flavors and ingredients are trending in real dining, not just social media)
- Restaurant groups (market research for new concepts, competitive intelligence)
- Real estate (food scene density as a neighborhood health signal)

**Requirements before this is viable:**
- Minimum 10,000 active users in a single city
- Clean anonymization pipeline (legal requirement, not optional)
- Separation of operational DB from analytical layer (Supabase → BigQuery pipeline)

**Do not build the data sales infrastructure now.** Build the consumer product. The data accumulates automatically. When you have density, the sales motion follows.

### 7.4 Quantified Influence Economy

**The core idea:** if your posts reliably drive 20 people per month to a restaurant, that's a measurable dollar value to that restaurant. Dine should capture and surface that value — creating a food critic economy at scale.

**The framework:**

Attribution score — already have `post_engagements` tracking. Extend to track downstream visits. When someone discovers a restaurant through your post and posts about it themselves, that attribution chain has dollar value.

Influence tier as a product to restaurants — a Platinum/Black user is a verified micro-influencer with quantified reach within the Dine network. Restaurants pay to offer them a comp meal or discount in exchange for a post.

**Critical integrity rule:** perks unlock AFTER posting, never before. Perks are tied to visit frequency and influence score, not rating scores. The moment users feel ratings are influenced by perks, the trust layer collapses and the data becomes worthless — including to B2B buyers.

**The visible influence layer (build this in Layer 1/2):**
- Tier badge visible on user's public profile
- When a Gold+ user posts about a restaurant, their post gets a "verified tastemaker" badge on that restaurant's page
- Restaurant portal shows when a high-tier user has bookmarked or visited them
- Shareable "influence card" showing tier, cities eaten in, dishes rated, restaurants discovered first

---

## 8. Data Pipeline — Pre-Launch Lift

These are one-time scripts run before beta launch. NOT Edge Functions — run locally or on a cheap VM (Railway, $5/month DigitalOcean droplet). Goal: populate the app with rich NYC restaurant data before a single user posts anything.

### Architecture Overview

```
External Sources          One-Time Scripts         Supabase Tables
─────────────────         ────────────────         ───────────────────
Google Places API    →    Lift 1 (1 day)      →    restaurants
Yelp Fusion API      →    Lift 2 (1 day)      →    restaurants (enriched)
GPT-4o Mini NLP      →    Lift 3 (1-2 days)   →    restaurant_dishes
OpenAI Embeddings    →    Lift 4 (half day)   →    restaurant_dishes.embedding
Infatuation/Eater    →    Lift 5 (1-2 days)   →    restaurant_editorial

User Actions              Edge Functions           Supabase
─────────────────         ──────────────           ────────────────────
Post dish rating     →    generate-embedding  →    dish_ratings + taste profiles
Map view             →    get-recommendations →    pgvector similarity query
New user signup      →    backfill-check      →    tagged meals populated
```

### New Tables Required

```sql
-- Enriched restaurant registry
restaurants (
  id uuid primary key,
  google_place_id text unique,
  yelp_id text,
  name text,
  address text,
  city text,
  state text,
  lat float,
  lng float,
  cuisine_type text,
  price_range int,           -- 1-4
  google_rating float,
  yelp_rating float,
  composite_score float,     -- weighted blend, pre-computed
  photo_urls text[],
  hours jsonb,
  is_claimed boolean default false,
  dine_post_count int default 0,
  created_at timestamp
)

-- Dish-level data per restaurant
restaurant_dishes (
  id uuid primary key,
  restaurant_id uuid references restaurants,
  dish_name text,
  source text,               -- 'yelp_review' | 'editorial' | 'google' | 'user'
  sentiment_score float,
  mention_count int,
  embedding vector(1536),    -- pgvector
  editorial_quote text,
  created_at timestamp
)

-- Editorial content from Infatuation, Eater, NYT
restaurant_editorial (
  id uuid primary key,
  restaurant_id uuid references restaurants,
  source text,               -- 'infatuation' | 'eater' | 'nyt'
  headline text,
  recommended_dishes text[],
  editorial_blurb text,
  source_url text,
  created_at timestamp
)

-- User Elo scores within cuisine categories
restaurant_elo_scores (
  id uuid primary key,
  user_id uuid references users,
  restaurant_id uuid references restaurants,
  cuisine_category text,
  elo_score float default 1000,
  comparison_count int default 0,
  updated_at timestamp
)

-- Comparison history for calibration engine
taste_comparisons (
  id uuid primary key,
  user_id uuid references users,
  winner_restaurant_id uuid references restaurants,
  loser_restaurant_id uuid references restaurants,
  cuisine_category text,
  winner_previous_rating float,
  loser_previous_rating float,
  created_at timestamp
)
```

### Lift Sequence

**Lift 1 — Google Places Bulk Pull (1 day)**
Pull all restaurants in NYC via Nearby Search (paginated, expanding radius from Manhattan center). Target: 15,000-20,000 restaurants. Populate `restaurants` table as ghost pages.

**Lift 2 — Yelp Enrichment (1 day)**
Match top 2,000 restaurants (by Google rating + review count) to Yelp by name+address fuzzy match. Pull rating, review count, category tags, 3 review snippets per restaurant.

**Lift 3 — Dish Extraction via GPT-4o Mini (1-2 days)**
For top 2,000 restaurants, feed review snippets to GPT-4o Mini. Extract structured dish data: dish name, sentiment, mention count, representative quote. Populate `restaurant_dishes`.

Prompt structure:
```
Extract all dishes mentioned in these reviews.
For each return: dish_name (standardized), sentiment (positive/negative/neutral),
mention_count, representative_quote (under 10 words).
Return JSON only, no preamble.
```

**Lift 4 — Generate Dish Embeddings (half day)**
Batch all extracted dish names through OpenAI text-embedding-3-small. Store in pgvector column on `restaurant_dishes`. Use batch endpoint with exponential backoff. Estimated: a few thousand dishes processed in under an hour.

**Lift 5 — Editorial Data (1-2 days)**
Parse Infatuation NYC and Eater NYC for:
- Restaurant name → fuzzy match to `restaurants` table
- Specific dish recommendations ("order the duck")
- One-line restaurant description

Populate `restaurant_editorial`. On restaurant pages, surface "The Infatuation recommends the black cod" with attribution link. Legally clean (attribution, not reproduction). Credible on day one.

### Map Implementation Notes

- Use `react-native-maps` with Google Maps provider (already paying for Places API, data alignment is cleaner)
- Add PostGIS extension to Supabase for geographic bounding box queries (restaurant viewport fetch)
- Use `react-native-map-clustering` — NYC has 20,000 restaurants, clustering is essential
- Pin visual logic: gold ring = Dine user has posted here, blue ring = friend has been here, size = match score, gray = base data only
- Target map load time: under 500ms via pgvector index + bounding box spatial query

### Nightly Refresh (Post-Launch)
Small Python script on Railway cron ($5/month). Pulls new restaurants added to Google Places in NYC since last run. Keeps ghost pages current without manual work.

### Future: B2B Data Pipeline
When selling restaurant analytics, add nightly export from Supabase to BigQuery (free tier, 10GB/month). Run analytical queries there — never against production DB. Keeps app performance clean and data legally separated.

---

## 9. Taste Intelligence System

### Current Architecture
- Each dish rating → OpenAI embedding (text-embedding-3-small, 1536 dims)
- User taste profile = weighted centroid of all their dish embeddings
- Weight = `(rating/10)^2` (a 9/10 dish counts ~4x more than a 5/10 dish)
- Couple recommendations = centroid of two users' embeddings

### Improvements Planned

**Cold Start (Onboarding)**
Seed embedding at onboarding via 3-round calibration flow (see section 5.2). Day-one recommendations feel accurate before first post.

**Absolute Rating Noise Reduction (Elo Engine)**
Human absolute ratings are noisy and inconsistent. Add relative comparison layer within cuisine categories. Elo updates provide calibrated signal that absolute ratings miss. The delta between Elo ranking and original rating is itself a signal that updates the embedding.

**Voice Sentiment Layer**
Voice post logs provide natural language sentiment. "Absolutely insane" is more honest signal than a deliberate 9/10. Build parallel confidence score on ratings — a 9/10 with enthusiastic voice description carries more embedding weight than a solo 9/10 entered manually.

**Cross-Category Occasion Matching**
After rich enough dining history, enable occasion-based comparisons:
> "For a date night, which would you go back to — Carbone or Don Angie?"
Builds occasion preference data on top of cuisine data. Powers agent recommendations that are contextually correct — not just "you like Italian" but "you prefer Don Angie for dates and Carbone for groups."

---

## 10. Credit & Tier System — Full Vision

### Current State
Credits earned for: post quality, streaks, discovery, referrals, attribution.
Tiers: Rock → Bronze (100) → Silver (500) → Gold (2000) → Platinum (10000) → Black (50000)

### The Gap
Tiers currently have no real-world value beyond badges. A loyalty program with no rewards is just a scoreboard.

### Full Vision — Tier Benefits

| Tier | Benefit |
|------|---------|
| Bronze | Early access to new Dine features |
| Silver | Saved restaurants surfaced to restaurant partners when you bookmark them |
| Gold | Preferred table requests at Dine partner restaurants. Restaurant notified of visit. |
| Platinum | Comp meal offers from partner restaurants (perk unlocks AFTER visit + post). Attribution score visible to restaurants. |
| Black | Verified tastemaker badge on posts. Direct relationship with restaurant partners. Access to invite-only dining events. |

### Visible Influence Layer
- Tier badge on public profile
- Gold+ posts get "verified tastemaker" badge on restaurant's Dine page
- Restaurant portal shows when Gold+ user bookmarks or visits
- Shareable influence card (tier, cities, dishes rated, restaurants discovered first)

### Integrity Rules (Non-Negotiable)
- Perks unlock AFTER posting, never before
- Perks tied to visit frequency and influence score, not rating scores
- Ratings must never be influenced by pending perks — the trust layer is the core product
- If the review data feels corrupted, the B2B data business collapses

---

## 11. Monetization Strategy

### Phase 1 — Consumer (Now through city one density)
No monetization. Focus entirely on user growth and data density. Every monetization decision before density is a distraction.

### Phase 2 — Restaurant Partnerships (Layer 2)
**Claim your page** — free, drives restaurant awareness of Dine
**Analytics dashboard** — monthly SaaS fee. Entry level for independents, premium for groups.
**Preferred table placement** — restaurants pay to be notified of high-tier user intent signals and to offer perks

### Phase 3 — Influence Marketplace (Layer 3)
Performance-based deals between Platinum/Black users and restaurant partners. Structured trade: verified visit + authentic post = comp meal or credit. Dine takes a platform fee.

### Phase 4 — Alternative Data
Anonymized, aggregated foot traffic and sentiment data sold to:
- Financial firms (restaurant chain performance)
- CPG brands (flavor and ingredient trend signals)
- Restaurant groups (competitive intelligence)
Requires BigQuery analytical layer and legal/anonymization infrastructure. Do not build until Phase 2 is generating revenue.

---

## 12. Ticket Backlog by Layer

Use this section to generate Linear tickets. Prefix with `ENG-` and assign to appropriate sprint.

### Layer 1 Tickets — Beta Blockers

```
[ ] Apple Sign-In implementation
    Priority: P0
    Effort: S (1-2 days)
    Notes: Required for App Store compliance. Implement via expo-apple-authentication.

[ ] Collapse post creation flow (7 steps → 2 minutes)
    Priority: P0
    Effort: M (3-5 days)
    Notes: Decouple split from post. Split = scan + tag friends + done.
           Rating/caption/privacy become async notifications after the fact.
           Venmo requests go out immediately on item assignment.

[ ] Non-Dine user web split experience
    Priority: P0
    Effort: M (3-5 days)
    Notes: Treat as a landing page. Fast load, clear items, Venmo CTA,
           soft join prompt. This is primary acquisition surface.

[ ] Taste calibration onboarding — Round 1 (Gut Check)
    Priority: P1
    Effort: S (1-2 days)
    Notes: 3 binary forced-choice questions. No "both" option.

[ ] Taste calibration onboarding — Round 2 (Dish Swipe)
    Priority: P1
    Effort: M (3-4 days)
    Notes: Full-screen dish photos, swipe R/L. 12-15 dishes. No labels.
           Results generate seed embedding.

[ ] Taste calibration onboarding — Round 3 (Smart Questions + Reveal)
    Priority: P1
    Effort: M (3-4 days)
    Notes: Dynamic questions based on R1+R2. Taste identity card reveal.
           3 immediate recommendations before entering main app.

[ ] Phone number backfill on signup
    Priority: P1
    Effort: M (3-4 days)
    Notes: Auto-populate meals/history when phone number matches
           previously tagged split. Pre-signup web stub experience.

[ ] Restaurant page social proof layer
    Priority: P1
    Effort: M (4-5 days)
    Notes: Top rated dishes, friend visit history, "what to order for you",
           editorial pull quotes from Lift 5 data.

[ ] Taste profile identity screen
    Priority: P1
    Effort: S (3-4 days)
    Notes: Visual food identity card. Top cuisines, discoverer badges,
           cities eaten, taste archetype. Shareable format.

[ ] Elo comparison engine
    Priority: P2
    Effort: L (1 week)
    Notes: Trigger after 5+ ratings in same cuisine. Tinder-style
           head-to-head. Elo update algorithm. Post-session insight reveal.
           New tables: restaurant_elo_scores, taste_comparisons.

[ ] Google Maps saved places import
    Priority: P2
    Effort: M (2-3 days)
    Notes: Import saved restaurants + reviews. Partial taste profile seed.
```

### Layer 1 Data Pipeline Tickets

```
[ ] Lift 1: Google Places NYC bulk pull
    Priority: P0 (before beta)
    Effort: M (1 day)
    Notes: Python script. Pull all NYC restaurants. Populate restaurants table.
           New schema migration required.

[ ] Lift 2: Yelp enrichment for top 2000
    Priority: P0 (before beta)
    Effort: S (1 day)
    Notes: Fuzzy name+address match. Pull rating, snippets, categories.

[ ] Lift 3: Dish extraction via GPT-4o Mini
    Priority: P0 (before beta)
    Effort: M (1-2 days)
    Notes: Batch process review snippets. Structured dish extraction.
           Populate restaurant_dishes table. New schema migration.

[ ] Lift 4: Generate dish embeddings
    Priority: P0 (before beta)
    Effort: S (half day)
    Notes: Batch OpenAI embeddings for all extracted dishes.
           Store in pgvector. Add index.

[ ] Lift 5: Editorial data parse (Infatuation + Eater NYC)
    Priority: P1
    Effort: M (1-2 days)
    Notes: Parse "what to order" from editorial sources.
           Populate restaurant_editorial table. New schema migration.

[ ] Map implementation with clustering
    Priority: P1
    Effort: L (1 week)
    Notes: react-native-maps + Google Maps provider.
           react-native-map-clustering. PostGIS extension on Supabase.
           Pin visual logic. Taste match score on viewport load.
```

### Layer 2 Tickets (Post-Beta, After 500+ Active Users)

```
[ ] Restaurant claim your page flow
[ ] Restaurant portal MVP (analytics dashboard)
[ ] Toast POS integration (webhook + itemized receipt)
[ ] Clover POS integration
[ ] QR table check-in
[ ] NFC table check-in
[ ] Preferred table request flow
[ ] Voice post logging (Siri shortcut + Whisper + GPT extraction)
[ ] iOS widget (microphone button)
[ ] Tier benefit implementation (Gold → preferred table, Platinum → perk unlock)
[ ] Visible influence layer (tastemaker badge, influence card)
```

### Layer 3 Tickets (After 10+ Restaurant Partners)

```
[ ] Dine Agent v1 (recommendation only, no booking)
[ ] Dine Agent v2 (with Resy/OpenTable booking API)
[ ] Multi-user taste profile group matching
[ ] Restaurant analytics dashboard v1 (B2B)
[ ] Influence marketplace (perk deal flow)
[ ] Supabase → BigQuery nightly pipeline
[ ] Alternative data anonymization layer
[ ] Occasion-based taste calibration (date night vs. group vs. solo)
```

---

*This document is a living planning artifact. Update it as features ship and strategy evolves. When creating Linear tickets, copy the ticket description, add acceptance criteria, and assign effort points based on team velocity.*
