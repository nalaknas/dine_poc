import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getUserPlaylists, createPlaylist, addRestaurantToPlaylist, removeRestaurantFromPlaylist,
} from '../../services/bookmark-service';
import type { Playlist } from '../../types';

interface PlaylistPickerModalProps {
  visible: boolean;
  userId: string;
  restaurantName: string;
  city?: string;
  state?: string;
  cuisineType?: string;
  onDismiss: () => void;
}

export function PlaylistPickerModal({
  visible, userId, restaurantName, city, state, cuisineType, onDismiss,
}: PlaylistPickerModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getUserPlaylists(userId);
      setPlaylists(data);

      // Pre-select playlists that contain this restaurant
      const ids = new Set<string>();
      for (const p of data) {
        const hasRestaurant = (p.restaurants ?? []).some(
          (r) => r.restaurant_name.toLowerCase() === restaurantName.toLowerCase(),
        );
        if (hasRestaurant) ids.add(p.id);
      }
      setSelectedIds(ids);
    } finally {
      setIsLoading(false);
    }
  }, [userId, restaurantName]);

  useEffect(() => {
    if (visible) loadPlaylists();
  }, [visible, loadPlaylists]);

  const handleToggle = async (playlistId: string) => {
    const wasSelected = selectedIds.has(playlistId);
    const next = new Set(selectedIds);

    if (wasSelected) {
      next.delete(playlistId);
      setSelectedIds(next);
      await removeRestaurantFromPlaylist(playlistId, restaurantName);
    } else {
      next.add(playlistId);
      setSelectedIds(next);
      await addRestaurantToPlaylist(playlistId, {
        restaurant_name: restaurantName,
        city,
        state,
        cuisine_type: cuisineType,
      });
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      const playlist = await createPlaylist(userId, newName.trim());
      await addRestaurantToPlaylist(playlist.id, {
        restaurant_name: restaurantName,
        city,
        state,
        cuisine_type: cuisineType,
      });
      setPlaylists((prev) => [...prev, playlist]);
      setSelectedIds((prev) => new Set(prev).add(playlist.id));
      setNewName('');
      setShowCreate(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/40">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: '70%' }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-border-light">
              <Text className="text-lg font-bold text-text-primary">Save to Playlist</Text>
              <TouchableOpacity onPress={onDismiss} className="p-1">
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View className="py-12 items-center">
                <ActivityIndicator color="#007AFF" />
              </View>
            ) : (
              <FlatList
                data={playlists}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <TouchableOpacity
                      onPress={() => handleToggle(item.id)}
                      className={`flex-row items-center p-3 rounded-xl mb-2 border ${
                        isSelected ? 'border-accent bg-accent/5' : 'border-border bg-background-secondary'
                      }`}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isSelected ? '#007AFF' : '#9CA3AF'}
                      />
                      <View className="flex-1 ml-3">
                        <Text className="text-base font-semibold text-text-primary">{item.name}</Text>
                        <Text className="text-xs text-text-secondary">
                          {(item.restaurants ?? []).length} restaurant{(item.restaurants ?? []).length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListFooterComponent={
                  <View className="mt-2">
                    {showCreate ? (
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <TextInput
                          value={newName}
                          onChangeText={setNewName}
                          placeholder="Playlist name"
                          placeholderTextColor="#9CA3AF"
                          autoFocus
                          className="flex-1 bg-background-secondary border border-border rounded-xl px-3 py-2 text-base text-text-primary"
                        />
                        <TouchableOpacity
                          onPress={handleCreate}
                          disabled={isSaving || !newName.trim()}
                          className="bg-accent rounded-xl px-4 py-2"
                        >
                          {isSaving ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text className="text-white font-semibold">Add</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setShowCreate(true)}
                        className="flex-row items-center p-3"
                      >
                        <Ionicons name="add-circle-outline" size={22} color="#007AFF" />
                        <Text className="text-accent font-semibold ml-2">New Playlist</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
