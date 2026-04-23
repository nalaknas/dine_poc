import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { HomeScreen } from '../screens/post-creation/HomeScreen';
import { ValidateReceiptScreen } from '../screens/post-creation/ValidateReceiptScreen';
import { SelectFriendsScreen } from '../screens/post-creation/SelectFriendsScreen';
import { AssignItemsScreen } from '../screens/post-creation/AssignItemsScreen';
import { SummaryScreen } from '../screens/post-creation/SummaryScreen';
import { RateMealScreen } from '../screens/post-creation/RateMealScreen';
import { ReviewComposerScreen } from '../screens/post-creation/ReviewComposerScreen';
import { PostPrivacyScreen } from '../screens/post-creation/PostPrivacyScreen';
import { QuickPostScreen } from '../screens/post-creation/QuickPostScreen';
import { useBillSplitterStore } from '../stores/billSplitterStore';
import { useSocialStore } from '../stores/socialStore';
import { trackPostCreationStep, trackPostAbandoned } from '../lib/analytics';
import type { PostCreationParamList } from '../types';

const Stack = createNativeStackNavigator<PostCreationParamList>();

const STEPS: (keyof PostCreationParamList)[] = [
  'Home', 'ValidateReceipt', 'SelectFriends', 'AssignItems',
  'Summary', 'RateMeal', 'ReviewComposer', 'PostPrivacy',
];

function ProgressBar({ routeName }: { routeName: string }) {
  const stepIndex = STEPS.indexOf(routeName as any);
  const progress = stepIndex >= 0 ? (stepIndex + 1) / STEPS.length : 0;

  return (
    <View style={{ backgroundColor: '#FFFFFF' }}>
      <View style={{ height: 3, backgroundColor: '#F3F4F6' }}>
        <LinearGradient
          colors={['#007AFF', '#5856D6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 3, width: `${progress * 100}%`, borderRadius: 1.5 }}
        />
      </View>
      <View style={{ alignItems: 'center', paddingVertical: 4 }}>
        <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' }}>
          Step {stepIndex + 1} of {STEPS.length}
        </Text>
      </View>
    </View>
  );
}

export function PostCreationNavigator() {
  return (
    <Stack.Navigator
      screenListeners={{
        focus: (e) => {
          const routeName = e.target?.split('-')[0] as keyof PostCreationParamList;
          if (routeName) {
            const stepIndex = STEPS.indexOf(routeName);
            if (stepIndex >= 0) trackPostCreationStep(routeName, stepIndex, 'full');
            if (routeName !== 'Home') {
              useBillSplitterStore.getState().persistDraft(routeName);
              useSocialStore.getState().persistDraft();
            }
          }
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: true,
        headerBackTitle: 'Back',
        headerTintColor: '#007AFF',
        headerTitleStyle: { fontWeight: '700', color: '#1F2937' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerBottom: () => <ProgressBar routeName={route.name} />,
      })}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'New Post',
          headerLeft: () => (
            <TouchableOpacity onPress={() => {
              // Track abandonment — the current route is always 'Home' here (step 0)
              // but the user may have navigated back, so track from Home
              trackPostAbandoned('Home', 0, 'full');
              useBillSplitterStore.getState().reset();
              useSocialStore.getState().clearDraftPost();
              navigation.getParent()?.navigate('Feed');
            }}>
              <Text style={{ color: '#007AFF', fontSize: 17 }}>Cancel</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="ValidateReceipt" component={ValidateReceiptScreen} options={{ title: 'Confirm Receipt' }} />
      <Stack.Screen name="SelectFriends" component={SelectFriendsScreen} options={{ title: 'Who was there?' }} />
      <Stack.Screen name="AssignItems" component={AssignItemsScreen} options={{ title: 'Split the Bill' }} />
      <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Summary' }} />
      <Stack.Screen name="RateMeal" component={RateMealScreen} options={{ title: 'Rate the Meal' }} />
      <Stack.Screen name="ReviewComposer" component={ReviewComposerScreen} options={{ title: 'Share it' }} />
      <Stack.Screen name="PostPrivacy" component={PostPrivacyScreen} options={{ title: 'Almost done!' }} />
      <Stack.Screen
        name="QuickPost"
        component={QuickPostScreen}
        options={{
          title: 'Quick Post',
        }}
      />
    </Stack.Navigator>
  );
}
