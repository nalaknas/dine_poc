import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
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
import { WelcomeOnboardingScreen } from '../screens/onboarding/WelcomeOnboardingScreen';
import { PermissionsOnboardingScreen } from '../screens/onboarding/PermissionsOnboardingScreen';
import { ProfileSetupOnboardingScreen } from '../screens/onboarding/ProfileSetupOnboardingScreen';
import { MealDetailScreen } from '../screens/detail/MealDetailScreen';
import { UserProfileScreen } from '../screens/detail/UserProfileScreen';
import { RestaurantDetailScreen } from '../screens/detail/RestaurantDetailScreen';
import { CommentsScreen } from '../screens/detail/CommentsScreen';
import { EditPostScreen } from '../screens/detail/EditPostScreen';
import { EditProfileScreen } from '../screens/detail/EditProfileScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { NotificationPreferencesScreen } from '../screens/settings/NotificationPreferencesScreen';
import { VenmoRequestsScreen } from '../screens/post-creation/VenmoRequestsScreen';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['dine://', 'https://dine.app'],
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
      UserProfile: 'profile/:userId',
      RestaurantDetail: 'restaurant/:name',
      VenmoRequests: 'split/:splitId',
    },
  },
};

export function RootNavigator() {
  const { user, isInitialized, initialize } = useAuthStore();
  const { hasCompletedOnboarding, loadSettings } = useSettingsStore();
  const { profile, setProfile } = useUserProfileStore();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

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
    Linking.getInitialURL()
      .then((url) => {
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

  // Replay pending deep link once auth + onboarding are complete.
  useEffect(() => {
    if (!urlCaptureDone || !user || !hasCompletedOnboarding) return;
    const url = pendingDeepLink.current;
    if (!url) return;
    pendingDeepLink.current = null;

    const path = url
      .replace(/^dine:\/\//, '')
      .replace(/^https?:\/\/dine\.app\/?/, '');

    const split = path.match(/^split\/([^/?#]+)/);
    const post = path.match(/^post\/([^/?#]+)/);
    const userProfile = path.match(/^profile\/([^/?#]+)/);
    const restaurant = path.match(/^restaurant\/([^/?#]+)/);

    if (split) {
      navigationRef.navigate('VenmoRequests', { splitId: split[1] });
    } else if (post) {
      navigationRef.navigate('MealDetail', { postId: post[1] });
    } else if (userProfile) {
      navigationRef.navigate('UserProfile', { userId: userProfile[1] });
    } else if (restaurant) {
      navigationRef.navigate('RestaurantDetail', { name: restaurant[1] });
    }
    // Unknown paths fall through to the default Feed; no crash.
  }, [urlCaptureDone, user, hasCompletedOnboarding, navigationRef]);

  useEffect(() => {
    loadSettings().then(() => initialize());
  }, []);

  // Auto-load profile when user is authenticated but profile isn't loaded yet
  useEffect(() => {
    if (user && !profile) {
      getOrCreateUserProfile(user.id, user.email)
        .then(setProfile)
        .catch(console.error);
    }
  }, [user, profile]);

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
    <NavigationContainer ref={navigationRef} linking={linking} onStateChange={onNavigationStateChange}>
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
              options={{ headerShown: true, title: 'Post' }}
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Inline onboarding stack to keep RootNavigator clean
const OnboardingStack = createNativeStackNavigator();
function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Welcome" component={WelcomeOnboardingScreen} />
      <OnboardingStack.Screen name="Permissions" component={PermissionsOnboardingScreen} />
      <OnboardingStack.Screen name="ProfileSetup" component={ProfileSetupOnboardingScreen} />
    </OnboardingStack.Navigator>
  );
}
