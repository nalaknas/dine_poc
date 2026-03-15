# Dine — API Reference

## Edge Functions

All Edge Functions are Deno-based and deployed to Supabase. They are invoked from the client via `supabase.functions.invoke()`.

---

### `analyze-receipt`

Scans receipt images using Google Vision OCR, then structures the data with GPT-4o Mini.

**Request:**
```typescript
{
  images: string[]  // base64-encoded JPEG images
}
```

**Response:**
```typescript
{
  restaurantName: string
  date: string          // YYYY-MM-DD
  time: string          // HH:MM AM/PM
  address: string
  city: string
  state: string
  items: Array<{
    id: string
    name: string
    price: number
  }>
  subtotal: number
  tax: number
  tip: number
  discount: number
  total: number
}
```

**Notes:**
- Supports multiple images (for long receipts)
- Images are compressed client-side before sending (1500px max, 0.6 quality)
- Quantities are expanded (e.g., "3x Coffee $12" becomes 3 separate items at $4 each)
- Cost: ~$0.002 per receipt (Vision $0.0015 + GPT-4o Mini $0.0003)

**Secrets required:** `GOOGLE_VISION_API_KEY`, `OPENAI_API_KEY`

---

### `generate-embedding`

Creates a taste embedding for a rated dish and updates the user's aggregate taste profile.

**Request:**
```typescript
{
  dishRatingId: string
  dishName: string
  rating: number      // 0-10
  notes?: string
  userId: string
}
```

**Response:**
```typescript
{ success: true }
```

**How it works:**
1. Creates enriched text from dish name + notes + rating context
2. Generates 1536-dim embedding via OpenAI `text-embedding-3-small`
3. Weights the embedding by `(rating/10)^2` — higher ratings have exponentially more influence
4. Stores embedding on the `dish_ratings` row
5. Recalculates user's `user_taste_profiles` as a weighted average of all their dish embeddings

**Secrets required:** `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

### `get-recommendations`

Returns personalized restaurant recommendations based on taste embeddings.

**Request:**
```typescript
{
  userId: string
  partnerIds?: string[]   // For couple/group recommendations
  mode?: string           // Recommendation mode
  city?: string           // Filter by city
  limit?: number          // Max results (default 10)
}
```

**Response:**
```typescript
{
  recommendations: Array<{
    restaurant_name: string
    match_score: number         // 0-1
    matched_dishes: Array<{
      dish_name: string
      similarity: number
    }>
    explanation: string
    yelp_data?: {               // Supplemental data
      rating: number
      review_count: number
      price: string
      url: string
      image_url: string
      location: object
    }
  }>
}
```

**How it works:**
1. Loads taste embeddings for the user (and partners, if provided)
2. Computes combined embedding (average for groups)
3. Runs pgvector cosine similarity via `find_similar_dishes()` SQL function
4. Groups results by restaurant, scores by best match
5. Supplements with Yelp API data when available

**Secrets required:** `OPENAI_API_KEY`, `YELP_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

### `upload-photo`

Uploads images to Supabase Storage using the service role key (bypasses RLS).

**Request:**
```typescript
{
  base64: string      // base64-encoded image
  bucket: string      // "avatars", "food-photos", or "receipts"
  path: string        // e.g., "userId/filename.jpg"
}
```

**Response:**
```typescript
{
  url: string         // Public URL of the uploaded image
}
```

**Secrets required:** `SUPABASE_SERVICE_ROLE_KEY`

---

## Client Services

These are the service modules in `src/services/` that wrap Supabase queries.

### Post Service (`src/services/post-service.ts`)

| Function | Description |
|----------|-------------|
| `getFeedPosts(userId, limit)` | Posts from self + following (public only) |
| `getUserPosts(userId, currentUserId?)` | User's posts (+ private if tagged) |
| `getTaggedPosts(userId)` | Posts where user is tagged |
| `getPost(postId, currentUserId?)` | Single post with like status |
| `createPost(draft, authorId, breakdowns)` | Full post creation (post + items + ratings + tags) |
| `updatePost(postId, updates)` | Update post fields |
| `deletePost(postId)` | Delete post and related data |
| `likePost(postId, userId)` / `unlikePost(...)` | Toggle likes with notifications |
| `getComments(postId)` | Fetch post comments |
| `addComment(postId, userId, text)` | Add comment with notification |
| `likeComment(...)` / `unlikeComment(...)` | Comment likes |

### User Service (`src/services/user-service.ts`)

| Function | Description |
|----------|-------------|
| `searchUsers(query)` | Search by username or display name (pg_trgm) |
| `getFrequentFriends(userId, limit)` | Most-tagged friends |
| `followUser(currentUserId, targetUserId)` | Follow + notification |
| `unfollowUser(currentUserId, targetUserId)` | Unfollow |
| `getFollowingIds(userId)` | List of followed user IDs |

### Auth Service (`src/services/auth-service.ts`)

| Function | Description |
|----------|-------------|
| `getOrCreateUserProfile(uid, email)` | Ensures user exists with generated username |
| `updateUserProfile(uid, updates)` | Profile mutations |
| `getUserById(userId)` | Fetch single user |

### Receipt Service (`src/services/receipt-service.ts`)

| Function | Description |
|----------|-------------|
| `compressForOCR(uri)` | Resize to 1500px, JPEG 0.6 quality |
| `analyzeReceipt(imageUris)` | Calls `analyze-receipt` Edge Function |
| `uploadReceiptImage(uri, userId)` | Upload to `receipts` bucket |
| `uploadFoodPhoto(uri, userId)` | Upload to `food-photos` bucket |
| `uploadAvatar(uri, userId)` | Upload to `avatars` bucket |

### Recommendation Service (`src/services/recommendation-service.ts`)

| Function | Description |
|----------|-------------|
| `getRecommendations(userId, partnerIds?, mode?, city?, limit?)` | Get restaurant recs |
| `generateDishEmbedding(dishRatingId, ...)` | Fire-and-forget embedding generation |
| `getTasteProfile(userId)` | User's top cuisines + rating count |

### Venmo Service (`src/services/venmo-service.ts`)

| Function | Description |
|----------|-------------|
| `openVenmoRequest(username, amount, note)` | Deep link with web fallback |
| `getVenmoableBreakdowns(breakdowns)` | Filter to friends with Venmo usernames |
| `buildMealNote(restaurantName, date)` | Standardized payment note |

---

## Database RPC Functions

These are PostgreSQL functions called via `supabase.rpc()`:

| Function | Description |
|----------|-------------|
| `increment_like_count(post_id)` | Atomically +1 like count |
| `decrement_like_count(post_id)` | Atomically -1 like count |
| `upsert_taste_profile(user_id, embedding, total_ratings)` | Insert or update taste vector |
| `find_similar_dishes(query_embedding, match_threshold, match_count, exclude_user_ids)` | pgvector cosine similarity search |

---

## External APIs

| API | Used In | Purpose |
|-----|---------|---------|
| Google Vision API | `analyze-receipt` Edge Function | Receipt OCR (DOCUMENT_TEXT_DETECTION) |
| OpenAI GPT-4o Mini | `analyze-receipt` Edge Function | Structure raw OCR text into JSON |
| OpenAI Embeddings | `generate-embedding` Edge Function | text-embedding-3-small (1536-dim) |
| Yelp Fusion API | `get-recommendations` Edge Function | Restaurant metadata supplement |
| Google Places API | Client-side (future) | Restaurant search and details |
| Venmo | Client-side deep links | `venmo://paycharge` URL scheme |
