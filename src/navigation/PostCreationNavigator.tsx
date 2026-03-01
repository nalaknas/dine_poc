import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/post-creation/HomeScreen';
import { ValidateReceiptScreen } from '../screens/post-creation/ValidateReceiptScreen';
import { SelectFriendsScreen } from '../screens/post-creation/SelectFriendsScreen';
import { AssignItemsScreen } from '../screens/post-creation/AssignItemsScreen';
import { SummaryScreen } from '../screens/post-creation/SummaryScreen';
import { RateMealScreen } from '../screens/post-creation/RateMealScreen';
import { AddCaptionScreen } from '../screens/post-creation/AddCaptionScreen';
import { PostPrivacyScreen } from '../screens/post-creation/PostPrivacyScreen';
import type { PostCreationParamList } from '../types';

const Stack = createNativeStackNavigator<PostCreationParamList>();

export function PostCreationNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
        headerTintColor: '#007AFF',
        headerTitleStyle: { fontWeight: '700', color: '#1F2937' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'New Post' }} />
      <Stack.Screen name="ValidateReceipt" component={ValidateReceiptScreen} options={{ title: 'Confirm Receipt' }} />
      <Stack.Screen name="SelectFriends" component={SelectFriendsScreen} options={{ title: 'Who was there?' }} />
      <Stack.Screen name="AssignItems" component={AssignItemsScreen} options={{ title: 'Split the Bill' }} />
      <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Summary' }} />
      <Stack.Screen name="RateMeal" component={RateMealScreen} options={{ title: 'Rate the Meal' }} />
      <Stack.Screen name="AddCaption" component={AddCaptionScreen} options={{ title: 'Share it' }} />
      <Stack.Screen name="PostPrivacy" component={PostPrivacyScreen} options={{ title: 'Almost done!' }} />
    </Stack.Navigator>
  );
}
