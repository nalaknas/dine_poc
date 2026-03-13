import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { FeedScreen } from '../screens/tabs/FeedScreen';
import { ExploreScreen } from '../screens/tabs/ExploreScreen';
import { ActivityScreen } from '../screens/tabs/ActivityScreen';
import { ProfileScreen } from '../screens/tabs/ProfileScreen';
import { PostCreationNavigator } from './PostCreationNavigator';
import { useNotificationsStore } from '../stores/notificationsStore';
import { Shadows, glowShadow } from '../constants/shadows';
import type { TabParamList } from '../types';

const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, [string, string]> = {
    Feed: ['home', 'home-outline'],
    Explore: ['search', 'search-outline'],
    Activity: ['heart', 'heart-outline'],
    Profile: ['person', 'person-outline'],
  };
  const [active, inactive] = icons[name] ?? ['ellipse', 'ellipse-outline'];
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Ionicons
        name={(focused ? active : inactive) as any}
        size={24}
        color={focused ? '#007AFF' : '#9CA3AF'}
      />
      {focused && (
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#007AFF',
          }}
        />
      )}
    </View>
  );
}

export function MainTabNavigator() {
  const unreadCount = useNotificationsStore((s) => s.unreadCount);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          height: Platform.OS === 'ios' ? 88 : 68,
          ...Shadows.tabBar,
        },
        tabBarButton: ({ style, children, onPress, ...rest }) => (
          <Pressable
            onPress={(e) => {
              Haptics.selectionAsync();
              onPress?.(e as any);
            }}
            accessibilityRole={rest.accessibilityRole}
            accessibilityState={rest.accessibilityState}
            testID={rest.testID}
            style={style}
          >
            {children}
          </Pressable>
        ),
        tabBarBackground: () => (
          <BlurView
            intensity={80}
            tint="light"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderTopWidth: 0.5,
              borderTopColor: 'rgba(0,0,0,0.06)',
            }}
          />
        ),
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Feed" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Explore" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="PostCreation"
        component={PostCreationNavigator}
        options={{
          tabBarIcon: () => null,
          tabBarButton: ({ style: _style, children: _children, ...rest }) => (
            <Pressable
              onPress={(e) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                rest.onPress?.(e);
              }}
              onLongPress={rest.onLongPress}
              accessibilityRole={rest.accessibilityRole}
              accessibilityState={rest.accessibilityState}
              testID={rest.testID}
              style={{
                top: -16,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View style={glowShadow('#007AFF')}>
                <LinearGradient
                  colors={['#007AFF', '#5856D6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="add" size={28} color="#FFFFFF" />
                </LinearGradient>
              </View>
            </Pressable>
          ),
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Activity" focused={focused} />,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            fontSize: 10,
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
