import React, { useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import { NavigationContainer, LinkingOptions, NavigationState } from '@react-navigation/native';
import { identifyUser, resetAnalytics, trackScreen } from '../lib/analytics';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUserProfileStore } from '../stores/userProfileStore';
import { getOrCreateUserProfile } from '../services/auth-service';
import { MainTabNavigator } from './MainTabNavigator';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { SplashScreen } from '../screens/onboarding/SplashScreen';
import { WelcomeOnboardingScreen } from '../screens/onboarding/WelcomeOnboardingScreen';
import { PermissionsOnboardingScreen } from '../screens/onboarding/PermissionsOnboardingScreen';
import { ProfileSetupOnboardingScreen } from '../screens/onboarding/ProfileSetupOnboardingScreen';
import { MealDetailScreen } from '../screens/detail/MealDetailScreen';
import { UserProfileScreen } from '../screens/detail/UserProfileScreen';
import { RestaurantDetailScreen } from '../screens/detail/RestaurantDetailScreen';
import { CommentsScreen } from '../screens/detail/CommentsScreen';
import { EditPostScreen } from '../screens/detail/EditPostScreen';
import { TaggedRateScreen } from '../screens/detail/TaggedRateScreen';
import { EditProfileScreen } from '../screens/detail/EditProfileScreen';
import { PlaylistDetailScreen } from '../screens/playlists/PlaylistDetailScreen';
import { CreatePlaylistScreen } from '../screens/playlists/CreatePlaylistScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { NotificationPreferencesScreen } from '../screens/settings/NotificationPreferencesScreen';
import { RecommendationsScreen } from '../screens/recommendations/RecommendationsScreen';
import { VenmoRequestsScreen } from '../screens/post-creation/VenmoRequestsScreen';
import { CreditDashboardScreen } from '../screens/credits/CreditDashboardScreen';
import { SavedRestaurantsScreen } from '../screens/profile/SavedRestaurantsScreen';
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

  // Capture deep link URLs that arrive before auth is ready.
  // TODO: implement post-auth replay by reading pendingDeepLink.current
  //       in a useEffect that watches `user`, then navigate programmatically.
  const pendingDeepLink = useRef<string | null>(null);
  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url) pendingDeepLink.current = url;
    });
  }, []);

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

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking} onStateChange={onNavigationStateChange}>
      <Stack.Navigator screenOptions={{
        headerShown: false,
        headerTintColor: '#007AFF',
        headerTitleStyle: { fontWeight: '700', color: '#1F2937' },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}>
        {!user ? (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
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
              name="TaggedRate"
              component={TaggedRateScreen}
              options={{ headerShown: true, title: 'Rate This Meal' }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ headerShown: true, title: 'Edit Profile' }}
            />
            <Stack.Screen
              name="PlaylistDetail"
              component={PlaylistDetailScreen}
              options={{ headerShown: true, title: '' }}
            />
            <Stack.Screen
              name="CreatePlaylist"
              component={CreatePlaylistScreen}
              options={{
                headerShown: true,
                title: 'New Playlist',
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
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
              name="Recommendations"
              component={RecommendationsScreen}
              options={{ headerShown: true, title: 'For You' }}
            />
            <Stack.Screen
              name="VenmoRequests"
              component={VenmoRequestsScreen}
              options={{ headerShown: true, title: 'Collect Payment' }}
            />
            <Stack.Screen
              name="CreditDashboard"
              component={CreditDashboardScreen}
              options={{ headerShown: true, title: 'Credits' }}
            />
            <Stack.Screen
              name="SavedRestaurants"
              component={SavedRestaurantsScreen}
              options={{ headerShown: true, title: 'Saved Restaurants' }}
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
