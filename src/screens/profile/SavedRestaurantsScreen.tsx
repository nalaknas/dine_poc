import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../stores/authStore';
import {
  getUserPlaylists, deletePlaylist, removeRestaurantFromPlaylist,
} from '../../services/bookmark-service';
import type { Playlist, PlaylistRestaurant, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Section {
  title: string;
  playlistId: string;
  data: PlaylistRestaurant[];
}

export function SavedRestaurantsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const playlists = await getUserPlaylists(user.id);
      const s: Section[] = playlists.map((p) => ({
        title: p.name,
        playlistId: p.id,
        data: p.restaurants ?? [],
      }));
      setSections(s);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRemoveRestaurant = (playlistId: string, restaurantName: string) => {
    Alert.alert('Remove Restaurant', `Remove "${restaurantName}" from this playlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeRestaurantFromPlaylist(playlistId, restaurantName);
          await loadData();
        },
      },
    ]);
  };

  const handleDeletePlaylist = (playlistId: string, name: string) => {
    if (name === 'Saved') {
      Alert.alert('Cannot Delete', 'The default Saved playlist cannot be deleted.');
      return;
    }
    Alert.alert('Delete Playlist', `Delete "${name}" and all saved restaurants in it?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePlaylist(playlistId);
          await loadData();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-center justify-between mb-2 mt-4">
            <View className="flex-row items-center">
              <Ionicons name="list" size={18} color="#1F2937" />
              <Text className="text-base font-bold text-text-primary ml-2">{section.title}</Text>
              <View className="bg-border rounded-full px-2 py-0.5 ml-2">
                <Text className="text-xs text-text-secondary">{section.data.length}</Text>
              </View>
            </View>
            {section.title !== 'Saved' && (
              <TouchableOpacity onPress={() => handleDeletePlaylist(section.playlistId, section.title)}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item, section }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('RestaurantDetail', {
              name: item.restaurant_name,
              city: item.city,
            })}
            className="flex-row items-center bg-background-secondary border border-border rounded-xl p-3 mb-2"
          >
            <View className="w-10 h-10 bg-accent/10 rounded-xl items-center justify-center mr-3">
              <Ionicons name="restaurant" size={20} color="#007AFF" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-text-primary">{item.restaurant_name}</Text>
              {(item.city || item.cuisine_type) && (
                <Text className="text-xs text-text-secondary">
                  {[item.cuisine_type, item.city].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleRemoveRestaurant(section.playlistId, item.restaurant_name)}
              className="p-2"
            >
              <Ionicons name="close-circle-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <View className="py-6 items-center">
              <Text className="text-sm text-text-secondary">No restaurants saved yet</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              glyph="◌"
              title="No saves yet."
              description="Tap the heart on any post — saves are private until you share them."
              actionLabel="Explore feed"
              onAction={() => navigation.navigate('Main' as never)}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
