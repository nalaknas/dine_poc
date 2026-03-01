import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import type { Playlist, RootStackParamList } from '../../types';

type PlaylistRoute = RouteProp<RootStackParamList, 'PlaylistDetail'>;

export function PlaylistDetailScreen() {
  const { params } = useRoute<PlaylistRoute>();
  const navigation = useNavigation<any>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    load();
  }, [params.playlistId]);

  const load = async () => {
    const { data } = await supabase
      .from('playlists')
      .select('*, restaurants:playlist_restaurants(*)')
      .eq('id', params.playlistId)
      .single();
    setPlaylist(data as Playlist);
    setIsLoading(false);
  };

  if (isLoading) {
    return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  if (!playlist) {
    return <View className="flex-1 items-center justify-center"><Text>Playlist not found</Text></View>;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="px-4 py-3 border-b border-border-light">
        <Text className="text-2xl font-bold text-text-primary">{playlist.name}</Text>
        {playlist.description && <Text className="text-sm text-text-secondary mt-1">{playlist.description}</Text>}
        <Text className="text-xs text-text-secondary mt-1">
          {playlist.restaurants.length} restaurant{playlist.restaurants.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={playlist.restaurants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('RestaurantDetail', { name: item.restaurant_name, city: item.city })}
            className="flex-row items-center bg-background-secondary rounded-xl p-4 mb-3"
          >
            <View className="w-10 h-10 bg-accent/10 rounded-xl items-center justify-center mr-3">
              <Ionicons name="restaurant" size={20} color="#007AFF" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-text-primary">{item.restaurant_name}</Text>
              {item.city && <Text className="text-xs text-text-secondary">{item.city}{item.state ? `, ${item.state}` : ''}</Text>}
              {item.cuisine_type && <Text className="text-xs text-text-secondary">{item.cuisine_type}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="map-outline" size={48} color="#D1D5DB" />
            <Text className="text-base font-semibold text-text-primary mt-3">No restaurants yet</Text>
            <Text className="text-sm text-text-secondary mt-1">Add restaurants to this playlist from any restaurant page.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
