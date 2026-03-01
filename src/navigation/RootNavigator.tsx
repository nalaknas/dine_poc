import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
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
import { EditProfileScreen } from '../screens/detail/EditProfileScreen';
import { PlaylistDetailScreen } from '../screens/playlists/PlaylistDetailScreen';
import { CreatePlaylistScreen } from '../screens/playlists/CreatePlaylistScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { RecommendationsScreen } from '../screens/recommendations/RecommendationsScreen';
import { VenmoRequestsScreen } from '../screens/post-creation/VenmoRequestsScreen';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, isInitialized, initialize } = useAuthStore();
  const { hasCompletedOnboarding, loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings().then(() => initialize());
  }, []);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
              options={{ headerShown: true, title: 'Comments' }}
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
              name="PlaylistDetail"
              component={PlaylistDetailScreen}
              options={{ headerShown: true, title: '' }}
            />
            <Stack.Screen
              name="CreatePlaylist"
              component={CreatePlaylistScreen}
              options={{ headerShown: true, title: 'New Playlist' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: 'Settings' }}
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
