import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { FeedScreen } from '../screens/tabs/FeedScreen';
import { ExploreScreen } from '../screens/tabs/ExploreScreen';
import { ActivityScreen } from '../screens/tabs/ActivityScreen';
import { ProfileScreen } from '../screens/tabs/ProfileScreen';
import { PostCreationNavigator } from './PostCreationNavigator';
import { useNotificationsStore } from '../stores/notificationsStore';
import type { TabParamList } from '../types';

const Tab = createBottomTabNavigator<TabParamList>();

export function MainTabNavigator() {
  const unreadCount = useNotificationsStore((s) => s.unreadCount);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          borderTopColor: '#E5E7EB',
          borderTopWidth: 0.5,
          backgroundColor: '#FFFFFF',
          paddingBottom: 8,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, [string, string]> = {
            Feed: ['home', 'home-outline'],
            Explore: ['search', 'search-outline'],
            PostCreation: ['add-circle', 'add-circle-outline'],
            Activity: ['heart', 'heart-outline'],
            Profile: ['person', 'person-outline'],
          };
          const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ tabBarLabel: 'Explore' }} />
      <Tab.Screen
        name="PostCreation"
        component={PostCreationNavigator}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={32}
              color="#007AFF"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#EF4444', fontSize: 10 },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
