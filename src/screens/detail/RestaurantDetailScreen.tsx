import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, FlatList, Image, Dimensions,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { formatTimeAgo } from '../../utils/format';
import type { Post, RootStackParamList } from '../../types';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = width / 3;

type RestaurantRoute = RouteProp<RootStackParamList, 'RestaurantDetail'>;

export function RestaurantDetailScreen() {
  const { params } = useRoute<RestaurantRoute>();
  const navigation = useNavigation<any>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    load();
  }, [params.name]);

  const load = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, author:users!posts_author_id_fkey(*), dish_ratings(*)')
      .ilike('restaurant_name', `%${params.name}%`)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(30);
    setPosts((data ?? []) as Post[]);
    setIsLoading(false);
  };

  const avgRating =
    posts.length > 0
      ? posts.reduce((sum, p) => sum + (p.overall_rating ?? 0), 0) / posts.length
      : 0;

  const allStarDishes = posts.flatMap((p) =>
    (p.dish_ratings ?? []).filter((d) => d.is_star_dish)
  );
  const topDishes = [...new Map(allStarDishes.map((d) => [d.dish_name, d])).values()].slice(0, 5);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-4 py-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-text-primary">{params.name}</Text>
                {params.city && (
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="location" size={13} color="#6B7280" />
                    <Text className="text-sm text-text-secondary ml-0.5">{params.city}</Text>
                  </View>
                )}
              </View>
              {avgRating > 0 && (
                <View className="items-center bg-background-secondary px-3 py-2 rounded-xl">
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text className="text-xl font-bold text-text-primary ml-1">
                      {avgRating.toFixed(1)}
                    </Text>
                  </View>
                  <Text className="text-xs text-text-secondary">{posts.length} post{posts.length !== 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Star dishes */}
          {topDishes.length > 0 && (
            <View className="mx-4 mb-4 bg-gold/10 border border-gold/30 rounded-xl p-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text className="text-sm font-semibold text-text-primary ml-1">Most Loved Dishes</Text>
              </View>
              {topDishes.map((dish, i) => (
                <View key={i} className="flex-row justify-between py-0.5">
                  <Text className="text-sm text-text-primary">{dish.dish_name}</Text>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text className="text-xs font-semibold text-gold ml-0.5">{dish.rating.toFixed(1)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Post grid */}
          <View className="px-4 mb-3">
            <Text className="text-base font-semibold text-text-primary">Posts from this restaurant</Text>
          </View>
          <View className="flex-row flex-wrap">
            {posts.filter((p) => p.food_photos.length > 0).map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => navigation.navigate('MealDetail', { postId: p.id })}
                style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, padding: 1 }}
              >
                <Image source={{ uri: p.food_photos[0] }} style={{ flex: 1 }} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
