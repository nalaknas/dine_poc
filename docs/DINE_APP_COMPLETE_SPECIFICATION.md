# DINE - Complete App Specification
## For AI-Assisted App Rebuilding

---

# PART 1: CORE CONCEPT

## What is Dine?

**Dine** is a social dining and bill-splitting mobile app that combines Instagram-style social features with intelligent receipt scanning. Think of it as "Instagram for food" meets "Splitwise" with AI-powered receipt scanning.

### The Problem It Solves:
1. **Bill Splitting Pain**: Splitting restaurant bills fairly among friends is tedious
2. **Food Discovery**: People want to discover restaurants through trusted friends, not algorithms
3. **Dining Memories**: No good way to track and remember great meals/dishes

### Core Value Propositions:
- Scan a receipt with AI and instantly split the bill item-by-item
- Share dining experiences with friends through posts with photos and ratings
- Discover restaurants through a social feed of people you follow
- Track your dining history and rate dishes for future reference

---

# PART 2: USER FLOWS

## Authentication Flow
1. User opens app → Splash screen with logo
2. Sign up with email/password OR Google OAuth
3. Create profile: display name, username, avatar, dietary preferences
4. Feature tour walkthrough
5. Contacts permission → Find friends already in app
6. Enter main app

## Main Post Creation Flow (7 Steps)
This is the core user journey:

### Step 1: Capture Receipt
- User taps "+" button in bottom tab bar
- Modal appears: "Take Photo" | "Upload from Library" | "Enter Manually"
- Select 1 or more receipt images (for long receipts)

### Step 2: Validate Receipt (AI Processing)
- System uses hybrid OCR: Google Vision API extracts text → GPT-4o Mini structures data
- Shows extracted data for user to verify/edit:
  - Restaurant name
  - Date/time
  - Address
  - Line items (name + price)
  - Subtotal, tax, tip, discount, total

### Step 3: Select Friends
- Choose who was at the meal
- Search from saved friends list
- Add new manual friends on the fly

### Step 4: Assign Items
- Toggle "Family Style" for equal split
- OR tap each item to assign to specific people
- Items can be shared between multiple people
- Real-time calculation shows each person's total

### Step 5: Rate the Meal
- Overall restaurant rating (0-10 slider)
- Rate individual dishes (0-10 each, optional notes)
- Dishes with 7+ rating become "Star Dishes"

### Step 6: Add Caption & Photos
- Upload food photos (up to 10)
- Write a caption
- Tag photos to specific menu items
- Select tags: meal type, cuisine, occasion

### Step 7: Privacy & Publish
- Choose: Public (appears in feed) OR Private (journal only)
- Publish post to database
- Navigate to Venmo request screen if friends owe money

## Social Feed Flow
1. User sees posts only from people they follow
2. Can like, comment, share posts
3. Tap user avatar → View their profile
4. Tap restaurant name → View restaurant details
5. Pull down to refresh feed

---

# PART 3: SCREENS & NAVIGATION

## Bottom Tab Navigation (5 tabs)
```
[ Feed ] [ Explore ] [ + Post ] [ Activity ] [ Profile ]
   |         |           |           |           |
  Home    Search     Create       Notifs      Me
```

## Screen List

### Main Tabs
1. **FeedScreen** - Instagram-style feed of posts from followed users
2. **ExploreScreen** - Search users, discover restaurants, find friends
3. **ActivityScreen** - Notifications (likes, comments, tags, follows)
4. **ProfileScreen** - Your profile, posts grid, playlists, settings

### Post Creation Stack
5. **HomeScreen** - Entry point: pick receipt images
6. **ValidateReceiptScreen** - Review/edit OCR results
7. **SelectFriendsScreen** - Choose friends at meal
8. **AssignItemsScreen** - Split items among friends
9. **SummaryScreen** - Review final bill split
10. **RateMealScreen** - Rate restaurant and dishes
11. **AddCaptionScreen** - Photos, caption, tags
12. **PostPrivacyScreen** - Public vs private
13. **VenmoRequestsScreen** - Send payment requests

### Detail Screens
14. **MealDetailScreen** - Full post view with comments
15. **UserProfileScreen** - Other user's profile
16. **RestaurantDetailScreen** - Restaurant info and posts
17. **CommentsScreen** - Comment thread
18. **EditPostScreen** - Modify existing post
19. **EditProfileScreen** - Edit your profile

### Playlist/Collections
20. **PlaylistDetailScreen** - Restaurant wishlist
21. **CreatePlaylistScreen** - Create new collection

### Settings & Auth
22. **SettingsScreen** - App settings
23. **AuthScreen** - Sign in/sign up

### Onboarding (first launch only)
24. **SplashScreen** - Logo animation
25. **WelcomeOnboardingScreen** - Feature intro
26. **PermissionsOnboardingScreen** - Request permissions
27. **ProfileSetupOnboardingScreen** - Initial profile
28. **OnboardingCompleteScreen** - Enter app

---

# PART 4: DATA MODELS

## User Profile
```typescript
{
  id: string;              // Firebase UID
  email: string;
  displayName: string;
  username: string;        // Unique, lowercase
  avatar?: string;         // URL to image
  bio?: string;
  phoneNumber?: string;
  venmoUsername?: string;
  location?: { city: string; state: string };
  stats: {
    totalMeals: number;
    restaurantsVisited: number;
    citiesExplored: number;
    followersCount: number;
    followingCount: number;
  };
  preferences?: {
    cuisineTypes: string[];
    dietaryRestrictions: string[];
  };
  followers: string[];     // User IDs
  following: string[];     // User IDs
  createdAt: string;       // ISO timestamp
}
```

## Meal Post
```typescript
{
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;

  // Restaurant
  restaurantName: string;
  location: { city: string; state: string; address?: string };

  // Content
  foodPhotos: string[];     // Up to 10 photo URLs
  caption: string;
  overallRating: number;    // 0-10 scale
  dishRatings?: [{ dishName: string; rating: number; notes?: string }];

  // Categorization
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  pricePerPerson?: number;
  tags: string[];           // ["dinner", "italian", "date-night"]
  cuisineType?: string;

  // Social
  taggedFriends: TaggedFriend[];
  likes: string[];          // User IDs who liked
  commentCount: number;
  isPublic: boolean;

  // Receipt Data (stored but not always displayed)
  receiptData?: {
    items: [{ id: string; name: string; price: number; assignedTo: string[] }];
    subtotal: number;
    tax: number;
    tip: number;
    discount: number;
    total: number;
    personBreakdowns: PersonBreakdown[];
  };

  // Timestamps
  mealDate?: string;        // YYYY-MM-DD (when meal happened)
  mealTime?: string;        // HH:MM AM/PM
  timestamp: string;        // When post was created
  createdAt: string;
}
```

## Tagged Friend
```typescript
{
  friendId: string;
  userId?: string;          // If they have an account
  username: string;
  displayName: string;
  avatar?: string;
  venmoUsername?: string;
  amountOwed?: number;
  items?: string[];         // Item names assigned to them
}
```

## Notification
```typescript
{
  id: string;
  userId: string;           // Recipient
  type: 'like' | 'comment' | 'tag' | 'follow';
  fromUserId: string;
  fromUserName: string;
  fromUserUsername: string;
  fromUserAvatar?: string;
  postId?: string;
  message: string;
  isRead: boolean;
  timestamp: string;
}
```

## Restaurant Playlist
```typescript
{
  id: string;
  userId: string;
  name: string;             // "Want to Eat", "Date Night Spots"
  description?: string;
  isPublic: boolean;
  restaurants: [{
    restaurantId: string;
    restaurantName: string;
    location: { city: string; state: string };
    cuisineType?: string;
    notes?: string;
    addedAt: string;
  }];
  createdAt: string;
}
```

---

# PART 5: DESIGN SYSTEM

## Color Palette

### Light Mode
- **Background**: #FFFFFF (white)
- **Secondary BG**: #F9FAFB (gray-50)
- **Primary Text**: #1F2937 (gray-800)
- **Secondary Text**: #6B7280 (gray-500)
- **Borders**: #F3F4F6 (gray-100), #E5E7EB (gray-200)
- **Accent Blue**: #007AFF (iOS blue)
- **Success Green**: #10B981 (emerald-500)
- **Error Red**: #EF4444 (red-500)
- **Warning Amber**: #F59E0B (amber-500)
- **Star/Rating Gold**: #F59E0B

### Dark Mode
- **Background**: #111827 (gray-900)
- **Secondary BG**: #1F2937 (gray-800)
- **Primary Text**: #FFFFFF (white)
- **Secondary Text**: #9CA3AF (gray-400)
- **Borders**: #374151 (gray-700)
- **Accent Blue**: #007AFF (same)

## Typography

### Font Sizes (in pixels)
```
xs:   10px  - Timestamps, minor labels
sm:   12px  - Secondary text, tags
base: 14px  - Body text, inputs
lg:   18px  - Subheadings
xl:   20px  - Section titles
2xl:  24px  - Screen titles
3xl:  32px  - Large headers
4xl:  40px  - Hero text
```

### Font Weights
- Regular: Normal body text
- Medium: Labels, subtle emphasis
- Semibold: Usernames, buttons
- Bold: Headings, restaurant names

## UI Component Patterns

### Post Card (Instagram-style)
```
┌─────────────────────────────────────┐
│ [Avatar] Username                    │
│ [Restaurant Icon] Restaurant Name    │
│   📍 City • $$ • ⭐ 8.5             │
├─────────────────────────────────────┤
│                                     │
│         [Food Photo(s)]             │
│         Square aspect ratio         │
│         Swipeable carousel          │
│                                     │
├─────────────────────────────────────┤
│ ❤️ 12    💬 3    ➤                  │
│ 12 likes                            │
│ username Caption text here...       │
│ ┌─────────────────────────────────┐ │
│ │ ⭐ Star Dishes                   │ │
│ │ Margherita Pizza    ⭐ 9.0      │ │
│ │ Tiramisu            ⭐ 8.5      │ │
│ └─────────────────────────────────┘ │
│ #italian #dinner #datenight         │
│ with John, Sarah                    │
│ View all 3 comments                 │
│ 2h ago                              │
└─────────────────────────────────────┘
```

### Bottom Tab Bar
- 5 equally spaced tabs
- Center tab (+) is prominent action
- Active tab: Blue icon and label
- Inactive tab: Gray icon
- Badge on Activity tab for unread notifications

### Screen Header
```
┌─────────────────────────────────────┐
│ Screen Title                   [⚙️] │
└─────────────────────────────────────┘
```
- Left-aligned bold title
- Right action icon(s)
- Safe area respected at top

### Empty States
- Large icon (gray, 48px)
- Title text (semibold)
- Description text (secondary color)
- Primary CTA button
- Optional secondary CTA

### Loading States
- Centered ActivityIndicator
- Blue color (#007AFF)
- Optional "Loading..." text below

## Icons (Ionicons)
```
Feed:        home / home-outline
Explore:     search / search-outline
Post:        add-circle / add-circle-outline
Activity:    heart / heart-outline
Profile:     person / person-outline
Restaurant:  restaurant (blue)
Location:    location
Like:        heart / heart-outline (red when active)
Comment:     chatbubble-outline
Share:       paper-plane-outline
Star:        star (gold)
Camera:      camera
Image:       image
Settings:    settings-outline
Back:        chevron-back
Forward:     chevron-forward
```

---

# PART 6: TECHNICAL ARCHITECTURE

## Tech Stack
- **Framework**: React Native 0.76+ with Expo SDK 53
- **Styling**: NativeWind (TailwindCSS for React Native)
- **State Management**: Zustand + AsyncStorage for persistence
- **Navigation**: React Navigation 7 (native-stack + bottom-tabs)
- **Database**: Firebase Firestore (REST API, not SDK)
- **Auth**: Firebase Authentication (email/password + Google OAuth)
- **Storage**: Firebase Storage (images)
- **AI/OCR**: Google Vision API + OpenAI GPT-4o Mini

## State Management Architecture

### Zustand Stores

**authStore** - User authentication
```typescript
{
  user: { uid, email, idToken, refreshToken } | null;
  isLoading: boolean;
  signUp, signIn, signInWithGoogle, signOut, refreshToken, deleteAccount
}
```

**socialStore** - Posts and feed
```typescript
{
  feedPosts: MealPost[];
  myPosts: MealPost[];
  taggedPosts: MealPost[];
  draftPost: CreatePostInput | null;
  setFeedPosts, addFeedPost, likePost, unlikePost
}
```

**userProfileStore** - Current user's profile
```typescript
{
  profile: User | null;
  updateProfile, incrementMealCount, followUser, unfollowUser
}
```

**notificationsStore** - Notifications
```typescript
{
  notifications: Notification[];
  unreadCount: number;
  addNotification, markAsRead, markAllAsRead
}
```

**billSplitterStore** - Receipt and bill splitting
```typescript
{
  currentReceipt: ReceiptData | null;
  selectedFriends: Friend[];
  savedFriends: Friend[];
  isFamilyStyle: boolean;
  mealHistory: MealHistory[];
}
```

**settingsStore** - User preferences
```typescript
{
  themePreference: 'light' | 'dark' | 'system';
  taxSplitMethod: 'equal' | 'proportional';
  tipSplitMethod: 'equal' | 'proportional';
  defaultTipPercentage: number;
}
```

## API Services

### Firebase Auth (firebase-auth.ts)
- `signUpWithEmail(email, password)` → { idToken, refreshToken, uid }
- `signInWithEmail(email, password)` → { idToken, refreshToken, uid }
- `signInWithGoogleToken(idToken)` → { idToken, refreshToken, uid }
- `refreshAuthToken(refreshToken)` → { idToken, refreshToken }
- `deleteUserAccount(idToken)`

### Firestore (firestore.ts)
- `createDocument(collection, data, idToken, docId?)` → Document
- `getDocument(collection, docId, idToken)` → Document
- `updateDocument(collection, docId, data, idToken, updateMask?)` → Document
- `deleteDocument(collection, docId, idToken)`
- `listDocuments(collection, idToken, pageSize?, pageToken?)` → Documents[]
- `runQuery(collection, fieldPath, operator, value, idToken)` → Documents[]

### User Service (user-service.ts)
- `getOrCreateUserProfile(uid, email, idToken)` → User
- `updateUserProfile(uid, updates, idToken)` → User
- `getUserPosts(userId, idToken)` → MealPost[]
- `getTaggedPosts(userId, idToken)` → MealPost[]
- `getFeedPosts(idToken, limit?)` → MealPost[]
- `createPost(postData, idToken)` → MealPost
- `updatePost(postId, updates, idToken)` → MealPost
- `deletePost(postId, idToken)`
- `followUser(currentUserId, targetUserId, idToken)`
- `unfollowUser(currentUserId, targetUserId, idToken)`
- `searchUsers(query, idToken)` → User[]
- `getUserNotifications(userId, idToken)` → Notification[]

### Receipt Analysis (receipt-analyzer.ts)
**Hybrid OCR Approach (93% cost savings):**

Step 1: Google Vision API extracts raw text from receipt image ($0.0015)
Step 2: GPT-4o Mini parses text into structured JSON ($0.0003)
Total: ~$0.002 per receipt vs $0.03-0.05 with GPT-4o Vision

```typescript
analyzeReceipt(imageUris: string[]) → {
  items: [{ id, name, price }];
  subtotal: number;
  tax: number;
  tip: number;
  discount: number;
  total: number;
  restaurantName: string;
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM AM/PM
  city: string;
  state: string;
  address: string;
}
```

### Firebase Storage (firebase-storage.ts)
- `uploadImage(uri, path, idToken)` → downloadURL
- Path format: `profiles/{userId}/{fileName}` or `posts/{userId}/{fileName}`

## Database Collections (Firestore)

```
/users/{userId}
  - Profile data, followers, following, stats

/posts/{postId}
  - Meal posts with all content, ratings, receipt data

/notifications/{notificationId}
  - User notifications (likes, comments, tags, follows)

/playlists/{playlistId}
  - Restaurant wishlists/collections
```

---

# PART 7: FEATURE DETAILS

## Receipt Scanning & Bill Splitting

### OCR Processing Flow
1. User selects 1+ receipt images
2. Convert images to base64
3. Send to Google Vision API for text detection
4. Combine all text blocks
5. Send text to GPT-4o Mini with structured prompt
6. Parse JSON response into receipt data
7. Display for user validation

### Bill Split Calculation
```
For each person:
  - itemsTotal = sum of (item.price / item.assignedTo.length) for items assigned to them
  - taxShare = tax * (itemsTotal / subtotal) OR tax / numPeople (if equal split)
  - tipShare = tip * (itemsTotal / subtotal) OR tip / numPeople (if equal split)
  - total = itemsTotal + taxShare + tipShare
```

### Family Style Mode
When enabled:
- All items split equally among all selected friends
- Tax and tip also split equally
- Quick and fair for shared plates

## Social Features

### Follow System
- Users can follow/unfollow other users
- Feed shows only posts from followed users + own posts
- Profile shows follower/following counts
- Following list stored on user document as array

### Likes & Notifications
- Tap heart to like/unlike post
- Like creates notification for post author
- Notification includes: who liked, which post, timestamp
- Badge appears on Activity tab for unread

### Star Dishes
- Dishes rated 7+ out of 10 appear in "Star Dishes" section
- Highlighted with amber/gold styling
- Helps friends see what to order

## Discovery Features

### User Search
- Search by username or email
- Shows mutual connections count
- Quick follow button

### Restaurant Discovery
- Trending restaurants (from post volume)
- Cuisine-based recommendations
- Add restaurants to playlists/wishlists

### Contact Matching
- Request contacts permission
- Match phone numbers to existing users
- Suggest friends to follow
- Invite non-users via SMS/email

## Venmo Integration
- Store venmoUsername on user profile
- Generate Venmo request URLs with amount prefilled
- One-tap to open Venmo app
- Format: `venmo://paycharge?txn=charge&recipients={username}&amount={amount}&note={note}`

---

# PART 8: PREDEFINED DATA

## Tag Categories

### Meal Types
breakfast, brunch, lunch, dinner, dessert, snack

### Cuisines
italian, mexican, chinese, japanese, thai, indian, american, french, mediterranean, korean, vietnamese, greek, spanish, middle-eastern, pizza, sushi, bbq, seafood, steakhouse, vegan, vegetarian

### Occasions
date-night, family, celebration, birthday, casual, business, romantic, group

### Dietary Restrictions
vegetarian, vegan, pescatarian, gluten-free, dairy-free, nut-free, shellfish-free, soy-free, egg-free, halal, kosher, keto, paleo, low-carb, low-sodium

---

# PART 9: ERROR HANDLING

## Error Types
```typescript
type ErrorType =
  | 'NETWORK_ERROR'      // No internet
  | 'AUTH_ERROR'         // Token expired, unauthorized
  | 'VALIDATION_ERROR'   // Invalid input
  | 'NOT_FOUND'          // Resource doesn't exist
  | 'SERVER_ERROR'       // Backend error
  | 'UNKNOWN_ERROR';     // Catch-all
```

## User-Friendly Messages
- NETWORK_ERROR: "Please check your internet connection"
- AUTH_ERROR: "Your session has expired. Please sign in again."
- EMAIL_EXISTS: "An account with this email already exists"
- INVALID_LOGIN_CREDENTIALS: "Invalid email or password"
- WEAK_PASSWORD: "Password must be at least 6 characters"
- TOO_MANY_ATTEMPTS: "Too many attempts. Please try again later."

## Retry Strategy
- Auto-retry network requests up to 3 times
- 1 second delay between retries
- On 401 errors: refresh token and retry once
- Show error banner with "Retry" button for user-initiated retry

---

# PART 10: ONBOARDING FLOW

## First Launch Sequence

### 1. Splash Screen
- App logo centered
- Fade in animation
- Lottie animation optional

### 2. Welcome/Feature Tour
- 3-4 swipeable cards explaining features:
  - "Scan receipts and split bills instantly"
  - "Share dining experiences with friends"
  - "Discover restaurants through your network"
  - "Rate dishes and build your dining journal"

### 3. Permissions
- Camera (for receipt photos)
- Photo Library (for food photos)
- Contacts (optional, for finding friends)
- Notifications (optional)

### 4. Profile Setup
- Upload avatar (camera or library)
- Enter display name
- Choose dietary preferences

### 5. Find Friends
- If contacts granted: Show friends already in app
- Suggest popular users to follow
- Skip option available

### 6. Complete
- "You're all set!" message
- Enter main app on Feed tab

---

# PART 11: EDGE CASES & BEHAVIORS

## Empty States

### Feed (No Posts)
- "No posts yet"
- "Follow friends to see their dining experiences"
- CTA: "Discover Friends" → Explore tab

### Profile (No Posts)
- "No meals yet"
- "Create your first post!"
- CTA: "Add Meal" → Post creation

### Notifications (Empty)
- "No notifications yet"
- "Interact with posts to see activity"

### Search (No Results)
- "No results found"
- "Try a different search term"

## Loading States
- Initial load: Full-screen spinner with "Loading..."
- Pull-to-refresh: Standard iOS refresh control
- Pagination: Bottom spinner when loading more
- Post submission: Overlay with "Posting..." text

## Offline Behavior
- Show cached data if available
- Banner: "You're offline. Some features may be limited."
- Queue changes for sync when online
- Retry automatically when connection restored

---

# PART 12: SECURITY CONSIDERATIONS

## Authentication
- Store tokens securely in AsyncStorage (encrypted on device)
- Refresh tokens before expiration
- Clear all user data on sign out
- Rate limit auth attempts

## Data Privacy
- Users control post visibility (public/private)
- Receipt data stored but not publicly displayed
- Friends only see their assigned portion

## API Security
- All requests include auth token in Authorization header
- Token validated on every Firestore request
- Firestore security rules restrict access to own data

---

# SUMMARY: WHAT MAKES DINE UNIQUE

1. **Hybrid OCR** - Uses Google Vision + GPT for 93% cheaper receipt scanning
2. **Item-Level Splitting** - Assign specific items to specific people, not just equal split
3. **Social + Utility** - Combines Instagram-style social with practical bill splitting
4. **Rating System** - 0-10 scale with individual dish ratings and "Star Dishes"
5. **Following-Only Feed** - Shows posts from people you follow, like Instagram
6. **Restaurant Playlists** - Save restaurants to try later in collections
7. **Venmo Integration** - One-tap payment requests

---

This specification should allow any AI tool or developer to rebuild the complete Dine app with full feature parity. All data models, UI patterns, navigation flows, and technical architecture are documented above.
