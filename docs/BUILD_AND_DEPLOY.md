# Dine — Build, Run & Deploy Guide

## Prerequisites

```bash
# Install EAS CLI globally (if not already installed)
npm install -g eas-cli

# Log in to your Expo account
eas login

# Install project dependencies
npm install
```

---

## 1. Running on iOS Simulator

### Option A: Expo Go (quickest, no native build needed)

```bash
npx expo start
```

Then press **i** to open in the iOS Simulator.

### Option B: Development Build (needed for native modules like camera)

```bash
# Create a development build for the simulator
eas build --profile development --platform ios --local

# Or build on EAS servers (no local Xcode needed)
eas build --profile development --platform ios
```

Once the build finishes, install it on the simulator:

```bash
# If you built locally, the .app file will be in the output directory
# Drag-and-drop the .app onto the Simulator, or:
xcrun simctl install booted /path/to/build.app

# Then start the dev server and connect
npx expo start --dev-client
```

### Option C: Run directly with Xcode (requires Xcode installed)

```bash
npx expo run:ios
```

This compiles native code locally and launches the Simulator automatically.

---

## 2. Running on a Physical Device

```bash
# Start the dev server
npx expo start

# Scan the QR code with your iPhone camera (Expo Go)
# Or press Shift+i to select a specific device
```

For development builds on a physical device, you need to register the device first:

```bash
eas device:create

# Then build with the development profile
eas build --profile development --platform ios
```

---

## 3. Creating a New Build

### Development Build (for testing with dev tools)

```bash
eas build --profile development --platform ios
```

### Preview Build (internal distribution, no dev tools)

```bash
eas build --profile preview --platform ios
```

### Production Build (App Store / TestFlight)

```bash
eas build --profile production --platform ios
```

### Build Locally (saves EAS build minutes)

Add `--local` to any of the above:

```bash
eas build --profile production --platform ios --local
```

> **Note:** Local builds require Xcode and CocoaPods installed on your Mac.

### Check Build Status

```bash
eas build:list
```

---

## 4. Publishing to TestFlight

### Step 1: Create a production build

```bash
eas build --profile production --platform ios
```

### Step 2: Submit to App Store Connect

```bash
# Submit the latest production build
eas submit --platform ios

# Or submit a specific build by ID
eas submit --platform ios --id <build-id>
```

On first run, EAS will prompt you for:
- **Apple ID** — your Apple Developer account email
- **App Store Connect API Key** (recommended) or password
- **ASC App ID** — select or create the app in App Store Connect

### Step 3: Build + Submit in one command

```bash
eas build --profile production --platform ios --auto-submit
```

### Step 4: Enable TestFlight testing

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select the **Dine** app
3. Go to **TestFlight** tab
4. The build will appear once processing is complete (usually 5–15 minutes)
5. For **Internal Testing**: Add testers under the internal group — they get access immediately
6. For **External Testing**: Create an external testing group, add testers by email, and submit for Beta App Review (usually approved within 24–48 hours)

### Managing TestFlight Testers

- Internal testers: Up to 100 members of your App Store Connect team (no review needed)
- External testers: Up to 10,000 testers by email invite (requires Beta App Review on first build)

---

## 5. Over-the-Air (OTA) Updates

For JS-only changes (no native code modifications), you can push updates instantly without a new build:

```bash
# Publish an update to the default branch
eas update --branch production --message "description of changes"

# Preview the update before publishing
eas update --branch preview --message "testing new feature"
```

> **Note:** OTA updates only work for JavaScript/TypeScript changes. Any changes to native modules, `app.config.js` plugins, or `eas.json` require a new build.

---

## Quick Reference

| Task | Command |
|------|---------|
| Run on Simulator (Expo Go) | `npx expo start` then press `i` |
| Run on Simulator (native) | `npx expo run:ios` |
| Development build | `eas build --profile development --platform ios` |
| Preview build | `eas build --profile preview --platform ios` |
| Production build | `eas build --profile production --platform ios` |
| Submit to TestFlight | `eas submit --platform ios` |
| Build + submit combo | `eas build --profile production --platform ios --auto-submit` |
| OTA update | `eas update --branch production --message "..."` |
| List builds | `eas build:list` |
| Register device | `eas device:create` |
