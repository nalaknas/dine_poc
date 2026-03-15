# Dine — Contributing & Code Conventions

## Branch Strategy

- **`main`** — Production-ready code
- **Feature branches** — `name/eng-<ticket>-<description>` (e.g., `sankalans/eng-28-draft-persistence`)
- Create PRs against `main`

---

## Development Workflow

```bash
# 1. Create a feature branch
git checkout -b yourname/eng-XX-feature-description

# 2. Make changes, test locally
npx expo start

# 3. Commit with descriptive messages
git add <files>
git commit -m "Add receipt validation error handling"

# 4. Push and create PR
git push -u origin yourname/eng-XX-feature-description
gh pr create --title "Add receipt validation" --body "..."
```

---

## Project Conventions

### File & Folder Naming
- **Screens**: `PascalCase` + `Screen` suffix (e.g., `FeedScreen.tsx`, `MealDetailScreen.tsx`)
- **Components**: `PascalCase` (e.g., `PostCard.tsx`, `RatingSlider.tsx`)
- **Stores**: `camelCase` + `Store` suffix (e.g., `authStore.ts`, `socialStore.ts`)
- **Services**: `kebab-case` + `-service` suffix (e.g., `post-service.ts`, `receipt-service.ts`)
- **Screen folders**: `kebab-case` (e.g., `post-creation/`, `detail/`)

### Component Structure
```typescript
// Imports
import React from 'react';
import { View, Text } from 'react-native';

// Types (if component-specific)
interface Props {
  title: string;
  onPress: () => void;
}

// Component
export function MyComponent({ title, onPress }: Props) {
  return (
    <View className="p-4">
      <Text className="text-lg font-bold">{title}</Text>
    </View>
  );
}
```

### Styling
- Use **NativeWind** (TailwindCSS classes) via `className` prop
- Brand colors defined in `tailwind.config.js`: `accent` (#007AFF), `gold` (#F59E0B), etc.
- Use `colors.ts` constants for programmatic color access
- Use `shadows.ts` for iOS shadow styles

### State Management
- Use **Zustand** stores — no Redux, no Context (except navigation)
- Keep stores focused: one store per domain
- Persist only what's needed (settings, split history) via AsyncStorage
- Use optimistic updates for social actions (likes, follows)

### Types
- All shared types live in `src/types/index.ts`
- Navigation param lists defined there too
- Use strict TypeScript (`tsconfig.json` has strict mode on)

### Imports
- Use path aliases: `@/components/...`, `@/stores/...`, `@/services/...`
- Group imports: React → React Native → third-party → local

---

## Adding a New Screen

1. Create the screen file in the appropriate `src/screens/` subfolder
2. Add navigation types to `RootStackParamList` or relevant param list in `src/types/index.ts`
3. Register the screen in the appropriate navigator (`RootNavigator.tsx`, `MainTabNavigator.tsx`, or `PostCreationNavigator.tsx`)

---

## Adding a New Edge Function

```bash
# Create the function
supabase functions new my-function

# Implement in supabase/functions/my-function/index.ts

# Test locally
supabase functions serve my-function

# Deploy
supabase functions deploy my-function

# Set any required secrets
supabase secrets set MY_API_KEY=value
```

Edge Functions use Deno runtime. Import from `https://esm.sh/` for npm packages.

---

## Adding a Database Migration

```bash
# Create a new migration file
supabase migration new description_of_change

# Edit the generated file in supabase/migrations/

# Apply locally
supabase db reset

# Push to remote
supabase db push
```

Follow the existing naming convention: `NNN_description.sql` (e.g., `006_add_reports_table.sql`).

---

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npx jest path/to/test.ts
```

Test framework: Jest + React Native Testing Library.
