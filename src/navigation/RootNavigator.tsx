import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, LinkingOptions, NavigationState, useNavigationContainerRef } from '@react-navigation/native';
import { identifyUser, resetAnalytics, trackScreen } from '../lib/analytics';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUserProfileStore } from '../stores/userProfileStore';
import { getOrCreateUserProfile } from '../services/auth-service';
import { MainTabNavigator } from './MainTabNavigator';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { SplashScreen, shouldSkipSplash, markSplashPlayed } from '../screens/onboarding/SplashScreen';
import { PhoneVerifyScreen } from '../screens/onboarding/PhoneVerifyScreen';
import { PhoneBackfillScreen } from '../screens/onboarding/PhoneBackfillScreen';
import { WelcomeOnboardingScreen } from '../screens/onboarding/WelcomeOnboardingScreen';
import { TastePickerScreen } from '../screens/onboarding/TastePickerScreen';
import { FollowFriendsScreen } from '../screens/onboarding/FollowFriendsScreen';
import { PermissionsOnboardingScreen } from '../screens/onboarding/PermissionsOnboardingScreen';
import { MealDetailScreen } from '../screens/detail/MealDetailScreen';
import { UserProfileScreen } from '../screens/detail/UserProfileScreen';
import { RestaurantDetailScreen } from '../screens/detail/RestaurantDetailScreen';
import { CommentsScreen } from '../screens/detail/CommentsScreen';
import { EditPostScreen } from '../screens/detail/EditPostScreen';
import { TaggedRateScreen } from '../screens/detail/TaggedRateScreen';
import { EditProfileScreen } from '../screens/detail/EditProfileScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { NotificationPreferencesScreen } from '../screens/settings/NotificationPreferencesScreen';
import { VenmoRequestsScreen } from '../screens/post-creation/VenmoRequestsScreen';
import { PaymentRequestScreen } from '../screens/detail/PaymentRequestScreen';
import { SplitHistoryScreen } from '../screens/detail/SplitHistoryScreen';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['dine://', 'https://joindine.app'],
  config: {
    screens: {
      Main: {
        screens: {
          Feed: 'feed',
          Explore: 'explore',
          Profile: 'my-profile',
        },
      },
      MealDetail: 'post/:postId',
      TaggedRate: 'rate/:postId',
      UserProfile: 'profile/:userId',
      RestaurantDetail: 'restaurant/:name',
      VenmoRequests: 'split/:splitId',
      PaymentRequest: 'r/:token',
    },
  },
};

export function RootNavigator() {
  const { user, isInitialized, initialize } = useAuthStore();
  const { hasCompletedOnboarding, loadSettings } = useSettingsStore();
  const { profile, setProfile } = useUserProfileStore();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  // Gates ENG-148's PhoneBackfill navigate effect — without this, the effect
  // can fire before NavigationContainer mounts on cold start and warn
  // "navigation object hasn't been initialized yet".
  const [navReady, setNavReady] = useState(false);

  // Splash plays first on cold-start, regardless of auth state. In prod we
  // only play once per JS session (ENG-133); in dev we always play so Metro
  // reloads remain observable.
  const [splashDone, setSplashDone] = useState(() => shouldSkipSplash());
  const handleSplashComplete = useCallback(() => {
    markSplashPlayed();
    setSplashDone(true);
  }, []);

  // Capture deep-link URLs that arrive before the auth stack can render
  // the target screen. React Navigation's built-in `linking` only handles
  // links when the target screen is in the current stack — unauthed users
  // don't have MealDetail / VenmoRequests / etc mounted, so we store the
  // URL and replay it after onboarding completes.
  const pendingDeepLink = useRef<string | null>(null);
  const [urlCaptureDone, setUrlCaptureDone] = useState(false);
  useEffect(() => {
    // Cold-start sources: (1) a Universal Link / dine:// URL captured by
    // Linking.getInitialURL, (2) a push notification tap that launched the
    // app — that one needs getLastNotificationResponseAsync because expo-
    // notifications doesn't pump push data through Linking.
    Promise.all([
      Linking.getInitialURL(),
      Notifications.getLastNotificationResponseAsync().then(
        (resp) => (resp?.notification?.request?.content?.data?.url as string | undefined) ?? null,
      ),
    ])
      .then(([linkUrl, pushUrl]) => {
        const url = linkUrl ?? pushUrl;
        if (url) pendingDeepLink.current = url;
      })
      .finally(() => setUrlCaptureDone(true));

    // While unauthed, subsequent URLs would otherwise be dropped. Store
    // them; once authed, React Navigation's built-in linking takes over
    // and this branch is a no-op.
    const sub = Linking.addEventListener('url', ({ url }) => {
      const { user: currentUser } = useAuthStore.getState();
      const { hasCompletedOnboarding: onboarded } = useSettingsStore.getState();
      if (!currentUser || !onboarded) {
        pendingDeepLink.current = url;
      }
    });
    return () => sub.remove();
  }, []);

  // Shared deep-link router used by both pending-link replay (cold start
  // unauthed) and push-notification-tap (warm taps while authed).
  const routeDeepLink = useCallback((url: string) => {
    const path = url
      .replace(/^dine:\/\//, '')
      .replace(/^https?:\/\/dine\.app\/?/, '');

    const split = path.match(/^split\/([^/?#]+)/);
    const post = path.match(/^post\/([^/?#]+)/);
    const rate = path.match(/^rate\/([^/?#]+)/);
    const userProfile = path.match(/^profile\/([^/?#]+)/);
    const restaurant = path.match(/^restaurant\/([^/?#]+)/);
    const paymentRequest = path.match(/^r\/([^/?#]+)/);

    if (split) {
      navigationRef.navigate('VenmoRequests', { splitId: split[1] });
    } else if (paymentRequest) {
      navigationRef.navigate('PaymentRequest', { token: paymentRequest[1] });
    } else if (rate) {
      navigationRef.navigate('TaggedRate', { postId: rate[1] });
    } else if (post) {
      navigationRef.navigate('MealDetail', { postId: post[1] });
    } else if (userProfile) {
      navigationRef.navigate('UserProfile', { userId: userProfile[1] });
    } else if (restaurant) {
      navigationRef.navigate('RestaurantDetail', { name: restaurant[1] });
    }
    // Unknown paths fall through to the default Feed; no crash.
  }, [navigationRef]);

  // Replay pending deep link once auth + onboarding are complete. Gated on
  // navReady too — cold-start via push tap can flip urlCaptureDone before
  // NavigationContainer.onReady fires, and navigating against an
  // uninitialized navigationRef logs "navigation hasn't been initialized".
  useEffect(() => {
    if (!navReady || !urlCaptureDone || !user || !hasCompletedOnboarding) return;
    const url = pendingDeepLink.current;
    if (!url) return;
    pendingDeepLink.current = null;
    routeDeepLink(url);
  }, [navReady, urlCaptureDone, user, hasCompletedOnboarding, routeDeepLink]);

  // Route warm push-notification taps. The OS-level cold-start path goes
  // through Linking.getInitialURL() (handled by the pendingDeepLink replay
  // above), but foregrounded/backgrounded taps land here. We use
  // navigationRef directly rather than Linking.openURL so the navigation
  // happens in-process without bouncing through the system URL handler.
  useEffect(() => {
    if (!navReady || !user || !hasCompletedOnboarding) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url) routeDeepLink(url);
    });
    return () => sub.remove();
  }, [navReady, user, hasCompletedOnboarding, routeDeepLink]);

  useEffect(() => {
    loadSettings().then(() => initialize());
  }, []);

  // Auto-load profile when user is authenticated but profile isn't loaded yet.
  // Note: AuthScreen is the one that sets `hasCompletedOnboarding` based on
  // wasCreated — this effect only fires for existing sessions (app restart),
  // where the onboarding flag is already persisted correctly from the last run.
  useEffect(() => {
    if (user && !profile) {
      getOrCreateUserProfile(user.id, user.email)
        .then(({ profile }) => setProfile(profile))
        .catch(console.error);
    }
  }, [user, profile]);

  // ENG-148: nudge existing users (those who finished onboarding before phone
  // verification was required) to add a phone. Once profile loads and we can
  // see they have no `phone_verified_at`, present PhoneBackfill modally over
  // whatever they're on. Skipped while the user is still in initial
  // onboarding (handled by ENG-147's PhoneVerify), and skipped if the modal
  // is already showing — without that guard, any subsequent profile mutation
  // would re-navigate and stack PhoneBackfill on top of itself. Gated on
  // navReady so cold-start ordering doesn't fire navigate() before the
  // NavigationContainer mounts.
  useEffect(() => {
    if (!navReady) return;
    if (!user || !hasCompletedOnboarding || !profile) return;
    if (profile.phone_verified_at) return;
    const currentRoute = navigationRef.getCurrentRoute?.()?.name;
    if (currentRoute === 'PhoneBackfill') return;
    navigationRef.navigate('PhoneBackfill');
  }, [navReady, user, hasCompletedOnboarding, profile, navigationRef]);

  // Identify user for analytics when authenticated
  useEffect(() => {
    if (user) {
      identifyUser(user.id, {
        email: user.email ?? undefined,
        name: profile?.display_name ?? undefined,
        avatar_url: profile?.avatar_url ?? undefined,
      });
    } else {
      resetAnalytics();
    }
  }, [user, profile]);

  // Track screen views on navigation state change
  const routeNameRef = useRef<string | undefined>(undefined);

  const getActiveRouteName = (state: NavigationState | undefined): string | undefined => {
    if (!state) return undefined;
    const route = state.routes[state.index];
    if (route.state) return getActiveRouteName(route.state as NavigationState);
    return route.name;
  };

  const onNavigationStateChange = useCallback((state: NavigationState | undefined) => {
    const currentRouteName = getActiveRouteName(state);
    if (currentRouteName && currentRouteName !== routeNameRef.current) {
      trackScreen(currentRouteName);
      routeNameRef.current = currentRouteName;
    }
  }, []);

  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onStateChange={onNavigationStateChange}
      onReady={() => setNavReady(true)}
    >
      <Stack.Navigator screenOptions={{
        headerShown: false,
        headerTintColor: '#007AFF',
        headerTitleStyle: { fontWeight: '700', color: '#1F2937' },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}>
        {!user ? (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
          </>
        ) : (
          <>
            {!hasCompletedOnboarding && (
              <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
            )}
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="MealDetail"
              component={MealDetailScreen}
              options={{
                headerShown: true,
                title: 'Post',
                headerStyle: { backgroundColor: '#FAF8F4' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="TaggedRate"
              component={TaggedRateScreen}
              options={{
                headerShown: true,
                title: 'Rate Dishes',
                headerStyle: { backgroundColor: '#FAF8F4' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
              options={{ headerShown: true, title: '' }}
            />
            <Stack.Screen
              name="RestaurantDetail"
              component={RestaurantDetailScreen}
              options={{ headerShown: true, title: '' }}
            />
            <Stack.Screen
              name="Comments"
              component={CommentsScreen}
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="EditPost"
              component={EditPostScreen}
              options={{ headerShown: true, title: 'Edit Post' }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ headerShown: true, title: 'Edit Profile' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: 'Settings' }}
            />
            <Stack.Screen
              name="NotificationPreferences"
              component={NotificationPreferencesScreen}
              options={{ headerShown: true, title: 'Notifications' }}
            />
            <Stack.Screen
              name="VenmoRequests"
              component={VenmoRequestsScreen}
              options={{ headerShown: true, title: 'Collect Payment' }}
            />
            <Stack.Screen
              name="PaymentRequest"
              component={PaymentRequestScreen}
              options={{ headerShown: true, title: 'Payment Request' }}
            />
            <Stack.Screen
              name="SplitHistory"
              component={SplitHistoryScreen}
              options={{ headerShown: true, title: 'Sent Requests' }}
            />
            {/* ENG-148: full-screen non-dismissible backfill prompt for users
                who completed onboarding before phone verification was required.
                Triggered by an effect, not user action; no header / no swipe-
                to-dismiss / no user-facing exit besides completing OTP. */}
            <Stack.Screen
              name="PhoneBackfill"
              component={PhoneBackfillScreen}
              options={{
                presentation: 'fullScreenModal',
                gestureEnabled: false,
                headerShown: false,
                animation: 'slide_from_bottom',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Inline onboarding stack to keep RootNavigator clean.
// Flow (ENG-147): PhoneVerify → Welcome → TastePicker → FollowFriends → Permissions → Main.
// PhoneVerify gates everything else (one phone per account, verified via OTP).
// Permissions is the step that flips `hasCompletedOnboarding = true`.
const OnboardingStack = createNativeStackNavigator();
function OnboardingNavigator() {
  const { profile } = useUserProfileStore();
  // Pre-pick the entry point so users who already verified (force-quit between
  // PhoneVerify success and Permissions finish) don't see the phone screen
  // again on relaunch. PhoneVerifyScreen has its own redirect as a backstop
  // for the case where profile loads asynchronously after this mounts.
  const initialRoute = profile?.phone_verified_at ? 'Welcome' : 'PhoneVerify';
  return (
    <OnboardingStack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <OnboardingStack.Screen name="PhoneVerify" component={PhoneVerifyScreen} />
      <OnboardingStack.Screen name="Welcome" component={WelcomeOnboardingScreen} />
      <OnboardingStack.Screen name="TastePicker" component={TastePickerScreen} />
      <OnboardingStack.Screen name="FollowFriends" component={FollowFriendsScreen} />
      <OnboardingStack.Screen name="Permissions" component={PermissionsOnboardingScreen} />
    </OnboardingStack.Navigator>
  );
}
