# Dine — Project Setup

## Prerequisites

- **Node.js** 18+ (recommend using `nvm`)
- **Xcode** 15+ (for iOS Simulator and native builds)
- **CocoaPods** (`sudo gem install cocoapods`)
- **Expo CLI** (`npm install -g expo-cli`)
- **EAS CLI** (`npm install -g eas-cli`)
- **Supabase CLI** (optional, for local dev): `brew install supabase/tap/supabase`

---

## 1. Clone & Install

```bash
git clone <repo-url>
cd dine_poc
npm install
```

---

## 2. Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Server-side only (used in Edge Functions, NOT in the client)
GOOGLE_VISION_API_KEY=your-google-vision-key
GOOGLE_PLACES_API_KEY=your-google-places-key
OPENAI_API_KEY=your-openai-key
YELP_API_KEY=your-yelp-key

# OAuth
GOOGLE_OAUTH_CLIENT_ID=your-oauth-client-id

# EAS (optional override)
EAS_PROJECT_ID=a11c2f5e-73df-446c-b361-cc1f36bf4cdf
```

**How env vars flow:**
```
.env → app.config.js (extra) → expo-constants → src/constants/config.ts
```

Only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_PLACES_API_KEY`, `YELP_API_KEY`, and `GOOGLE_OAUTH_CLIENT_ID` are exposed client-side. All other API keys (Vision, OpenAI) live exclusively in Supabase Edge Functions.

---

## 3. Start Development

```bash
# Start the Expo dev server
npx expo start

# Press 'i' to open iOS Simulator
```

For a native development build (required for camera, image picker, etc.):

```bash
npx expo run:ios
```

---

## 4. Verify Setup

After launching the app you should see:
1. **Splash screen** with the Dine logo
2. **Auth screen** (sign up / sign in)
3. After signing in: **Onboarding flow** (first time) or **Feed tab**

If you see errors:
- Missing env vars → Check `.env` file exists and is populated
- Metro bundler errors → Try `npx expo start --clear`
- Native build errors → Run `cd ios && pod install && cd ..`

---

## 5. Key Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Build and run on iOS (native) |
| `npm test` | Run Jest tests |

---

## 6. IDE Setup

**VSCode recommended extensions:**
- ES7+ React/React Native Snippets
- Tailwind CSS IntelliSense (works with NativeWind)
- Prettier
- ESLint

**Path aliases** are configured in `tsconfig.json`:
```json
"@/*": ["src/*"]
```

So you can import like:
```typescript
import { PostCard } from '@/components/post/PostCard';
```
