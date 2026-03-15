import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, Dimensions,
  TouchableOpacity, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { formatTimeAgo } from '../../utils/format';
import type { Post, DishRating, RootStackParamList } from '../../types';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = width / 3;

type RestaurantRoute = RouteProp<RootStackParamList, 'RestaurantDetail'>;

// ─── Dish classification heuristics ──────────────────────────────────────────

const APPETIZER_KEYWORDS = [
  'appetizer', 'starter', 'bruschetta', 'calamari', 'wings', 'nachos', 'dip',
  'hummus', 'spring roll', 'egg roll', 'edamame', 'gyoza', 'dumpling',
  'soup', 'salad', 'bread', 'flatbread', 'crostini', 'carpaccio', 'ceviche',
  'mozzarella stick', 'fries', 'tots', 'pretzel', 'guacamole', 'chips',
  'antipasto', 'mezze', 'tapas', 'empanada', 'samosa', 'pakora',
];

const DESSERT_KEYWORDS = [
  'dessert', 'cake', 'pie', 'ice cream', 'gelato', 'sorbet', 'brownie',
  'cookie', 'cheesecake', 'tiramisu', 'churro', 'donut', 'doughnut',
  'pudding', 'mousse', 'crème brûlée', 'creme brulee', 'flan', 'sundae',
  'macaron', 'pastry', 'cobbler', 'tart', 'waffle', 'pancake', 'crepe',
  'mochi', 'chocolate', 'cannoli', 'baklava', 'panna cotta',
];

const DRINK_KEYWORDS = [
  'drink', 'cocktail', 'margarita', 'martini', 'beer', 'wine', 'sake',
  'sangria', 'mojito', 'lemonade', 'tea', 'coffee', 'espresso', 'latte',
  'smoothie', 'juice', 'soda', 'water', 'spritz', 'negroni', 'old fashioned',
  'daiquiri', 'mimosa', 'bellini', 'kombucha', 'matcha', 'chai', 'boba',
];

type DishCategory = 'Appetizers & Sides' | 'Entrees' | 'Desserts' | 'Drinks' | 'Other';

function classifyDish(name: string): DishCategory {
  const lower = name.toLowerCase();
  if (APPETIZER_KEYWORDS.some((kw) => lower.includes(kw))) return 'Appetizers & Sides';
  if (DESSERT_KEYWORDS.some((kw) => lower.includes(kw))) return 'Desserts';
  if (DRINK_KEYWORDS.some((kw) => lower.includes(kw))) return 'Drinks';
  // Default: anything that doesn't match is likely an entree
  return 'Entrees';
}

const CATEGORY_ORDER: DishCategory[] = [
  'Appetizers & Sides',
  'Entrees',
  'Desserts',
  'Drinks',
  'Other',
];

const CATEGORY_ICONS: Record<DishCategory, string> = {
  'Appetizers & Sides': 'leaf-outline',
  'Entrees': 'restaurant-outline',
  'Desserts': 'ice-cream-outline',
  'Drinks': 'wine-outline',
  'Other': 'ellipsis-horizontal-outline',
};

// ─── Aggregated dish type ────────────────────────────────────────────────────

interface AggregatedDish {
  name: string;
  avgRating: number;
  reviewCount: number;
  isStarDish: boolean;
  photos: { uri: string; label?: string }[];
  category: DishCategory;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RestaurantDetailScreen() {
  const { params } = useRoute<RestaurantRoute>();
  const navigation = useNavigation<any>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Appetizers & Sides': true,
    'Entrees': true,
    'Desserts': true,
    'Drinks': true,
    'Other': true,
  });

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
      .limit(50);
    setPosts((data ?? []) as Post[]);
    setIsLoading(false);
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const avgRating = useMemo(() => {
    if (posts.length === 0) return 0;
    return posts.reduce((sum, p) => sum + (p.overall_rating ?? 0), 0) / posts.length;
  }, [posts]);

  const uniqueVisitors = useMemo(() => {
    const ids = new Set(posts.map((p) => p.author_id));
    return ids.size;
  }, [posts]);

  const avgPricePerPerson = useMemo(() => {
    const withPrice = posts.filter((p) => p.price_per_person && p.price_per_person > 0);
    if (withPrice.length === 0) return null;
    return withPrice.reduce((s, p) => s + (p.price_per_person ?? 0), 0) / withPrice.length;
  }, [posts]);

  const cuisineType = useMemo(() => {
    const types = posts.map((p) => p.cuisine_type).filter(Boolean);
    if (types.length === 0) return null;
    // Most common cuisine type
    const counts: Record<string, number> = {};
    types.forEach((t) => { counts[t!] = (counts[t!] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }, [posts]);

  const priceRange = useMemo(() => {
    const ranges = posts.map((p) => p.price_range).filter(Boolean);
    if (ranges.length === 0) return null;
    const counts: Record<string, number> = {};
    ranges.forEach((r) => { counts[r!] = (counts[r!] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }, [posts]);

  const address = useMemo(() => {
    return posts.find((p) => p.address)?.address ?? null;
  }, [posts]);

  const city = params.city ?? posts.find((p) => p.city)?.city;
  const state = posts.find((p) => p.state)?.state;

  const fullAddress = useMemo(() => {
    const parts = [address, city, state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [address, city, state]);

  // ── Aggregate dishes with ratings, photos, and categories ──────────────────

  const aggregatedDishes = useMemo(() => {
    const dishMap = new Map<string, {
      ratings: number[];
      isStarDish: boolean;
      photos: { uri: string; label?: string }[];
    }>();

    posts.forEach((post) => {
      // Collect dish ratings
      (post.dish_ratings ?? []).forEach((dr) => {
        const key = dr.dish_name.toLowerCase().trim();
        if (!dishMap.has(key)) {
          dishMap.set(key, { ratings: [], isStarDish: false, photos: [] });
        }
        const entry = dishMap.get(key)!;
        entry.ratings.push(dr.rating);
        if (dr.is_star_dish) entry.isStarDish = true;
      });

      // Attach labeled photos to dishes
      if (post.photo_labels && post.food_photos) {
        Object.entries(post.photo_labels).forEach(([idx, label]) => {
          const photoUri = post.food_photos[Number(idx)];
          if (!photoUri || !label) return;
          const key = label.toLowerCase().trim();
          if (!dishMap.has(key)) {
            dishMap.set(key, { ratings: [], isStarDish: false, photos: [] });
          }
          dishMap.get(key)!.photos.push({ uri: photoUri, label });
        });
      }
    });

    const dishes: AggregatedDish[] = [];
    dishMap.forEach((val, key) => {
      const displayName = val.photos[0]?.label
        ?? posts.flatMap((p) => p.dish_ratings ?? []).find((d) => d.dish_name.toLowerCase().trim() === key)?.dish_name
        ?? key;
      dishes.push({
        name: displayName,
        avgRating: val.ratings.length > 0
          ? val.ratings.reduce((a, b) => a + b, 0) / val.ratings.length
          : 0,
        reviewCount: val.ratings.length,
        isStarDish: val.isStarDish,
        photos: val.photos,
        category: classifyDish(key),
      });
    });

    // Sort by star dish first, then by avg rating desc
    dishes.sort((a, b) => {
      if (a.isStarDish !== b.isStarDish) return a.isStarDish ? -1 : 1;
      return b.avgRating - a.avgRating;
    });

    return dishes;
  }, [posts]);

  const dishesByCategory = useMemo(() => {
    const map: Record<DishCategory, AggregatedDish[]> = {
      'Appetizers & Sides': [],
      'Entrees': [],
      'Desserts': [],
      'Drinks': [],
      'Other': [],
    };
    aggregatedDishes.forEach((d) => map[d.category].push(d));
    return map;
  }, [aggregatedDishes]);

  // ── All labeled photos for gallery ─────────────────────────────────────────

  const labeledPhotos = useMemo(() => {
    const photos: { uri: string; label: string; postId: string }[] = [];
    posts.forEach((post) => {
      if (!post.photo_labels || !post.food_photos) return;
      Object.entries(post.photo_labels).forEach(([idx, label]) => {
        const uri = post.food_photos[Number(idx)];
        if (uri && label) photos.push({ uri, label, postId: post.id });
      });
    });
    return photos;
  }, [posts]);

  // ── Unlabeled photos (for the grid) ────────────────────────────────────────

  const allPhotos = useMemo(() => {
    const photos: { uri: string; label?: string; postId: string }[] = [];
    posts.forEach((post) => {
      post.food_photos.forEach((uri, idx) => {
        const label = post.photo_labels?.[String(idx)];
        photos.push({ uri, label, postId: post.id });
      });
    });
    return photos;
  }, [posts]);

  // ── Friends who've been ────────────────────────────────────────────────────

  const visitors = useMemo(() => {
    const seen = new Set<string>();
    return posts
      .filter((p) => p.author)
      .map((p) => p.author!)
      .filter((u) => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      })
      .slice(0, 10);
  }, [posts]);

  // ── Tags aggregation ──────────────────────────────────────────────────────

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => (p.tags ?? []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [posts]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openInMaps = useCallback(() => {
    const query = encodeURIComponent(`${params.name} ${fullAddress ?? ''}`);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url);
  }, [params.name, fullAddress]);

  const openGoogleMaps = useCallback(() => {
    const query = encodeURIComponent(`${params.name} ${fullAddress ?? ''}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  }, [params.name, fullAddress]);

  const toggleCategory = useCallback((cat: DishCategory) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  // ── Rating color helper ────────────────────────────────────────────────────

  const ratingColor = (r: number) => {
    if (r >= 8) return '#22C55E'; // green
    if (r >= 6) return '#F59E0B'; // gold
    if (r >= 4) return '#F97316'; // orange
    return '#EF4444'; // red
  };

  const ratingBg = (r: number) => {
    if (r >= 8) return 'bg-green-500/10';
    if (r >= 6) return 'bg-gold/10';
    if (r >= 4) return 'bg-orange-500/10';
    return 'bg-red-500/10';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero Header ───────────────────────────────────────────────── */}
        <View className="px-4 pt-4 pb-3">
          <Text className="text-2xl font-bold text-text-primary">{params.name}</Text>

          {/* Cuisine + Price badges */}
          <View className="flex-row items-center mt-2 flex-wrap gap-2">
            {cuisineType && (
              <View className="bg-accent/10 px-3 py-1 rounded-full">
                <Text className="text-xs font-semibold text-accent">{cuisineType}</Text>
              </View>
            )}
            {priceRange && (
              <View className="bg-green-500/10 px-3 py-1 rounded-full">
                <Text className="text-xs font-semibold text-green-600">{priceRange}</Text>
              </View>
            )}
            {avgPricePerPerson && (
              <View className="bg-background-secondary px-3 py-1 rounded-full">
                <Text className="text-xs font-semibold text-text-secondary">
                  ~${avgPricePerPerson.toFixed(0)}/person
                </Text>
              </View>
            )}
          </View>

          {/* Address + Maps links */}
          {fullAddress && (
            <View className="mt-3">
              <View className="flex-row items-start">
                <Ionicons name="location" size={15} color="#6B7280" style={{ marginTop: 2 }} />
                <Text className="text-sm text-text-secondary ml-1 flex-1">{fullAddress}</Text>
              </View>
              <View className="flex-row mt-2 gap-3">
                <TouchableOpacity
                  onPress={openInMaps}
                  className="flex-row items-center bg-accent/10 px-3 py-1.5 rounded-full"
                >
                  <Ionicons name="navigate-outline" size={14} color="#007AFF" />
                  <Text className="text-xs font-semibold text-accent ml-1">
                    {Platform.OS === 'ios' ? 'Apple Maps' : 'Maps'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={openGoogleMaps}
                  className="flex-row items-center bg-red-500/10 px-3 py-1.5 rounded-full"
                >
                  <Ionicons name="map-outline" size={14} color="#EF4444" />
                  <Text className="text-xs font-semibold text-red-500 ml-1">Google Maps</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Quick Stats Bar ────────────────────────────────────────────── */}
        <View className="mx-4 mb-4 bg-background-secondary rounded-2xl p-4 flex-row justify-around">
          <View className="items-center">
            <View className="flex-row items-center">
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text className="text-xl font-bold text-text-primary ml-1">
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </Text>
            </View>
            <Text className="text-xs text-text-secondary mt-0.5">Avg Rating</Text>
          </View>
          <View className="w-px bg-border" />
          <View className="items-center">
            <Text className="text-xl font-bold text-text-primary">{posts.length}</Text>
            <Text className="text-xs text-text-secondary mt-0.5">
              {posts.length === 1 ? 'Visit' : 'Visits'}
            </Text>
          </View>
          <View className="w-px bg-border" />
          <View className="items-center">
            <Text className="text-xl font-bold text-text-primary">{uniqueVisitors}</Text>
            <Text className="text-xs text-text-secondary mt-0.5">
              {uniqueVisitors === 1 ? 'Visitor' : 'Visitors'}
            </Text>
          </View>
          <View className="w-px bg-border" />
          <View className="items-center">
            <Text className="text-xl font-bold text-text-primary">{aggregatedDishes.length}</Text>
            <Text className="text-xs text-text-secondary mt-0.5">Dishes Rated</Text>
          </View>
        </View>

        {/* ── Tags ───────────────────────────────────────────────────────── */}
        {topTags.length > 0 && (
          <View className="px-4 mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {topTags.map((tag) => (
                  <View key={tag} className="bg-background-secondary px-3 py-1 rounded-full">
                    <Text className="text-xs text-text-secondary">#{tag}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Menu by Category ───────────────────────────────────────────── */}
        {aggregatedDishes.length > 0 && (
          <View className="mb-4">
            <View className="px-4 mb-3 flex-row items-center">
              <Ionicons name="book-outline" size={18} color="#007AFF" />
              <Text className="text-lg font-bold text-text-primary ml-2">Menu</Text>
              <Text className="text-xs text-text-secondary ml-2">
                based on {posts.length} {posts.length === 1 ? 'review' : 'reviews'}
              </Text>
            </View>

            {CATEGORY_ORDER.map((category) => {
              const dishes = dishesByCategory[category];
              if (dishes.length === 0) return null;
              const isExpanded = expandedCategories[category];

              return (
                <View key={category} className="mb-2">
                  {/* Category header */}
                  <TouchableOpacity
                    onPress={() => toggleCategory(category)}
                    className="mx-4 flex-row items-center justify-between py-2 border-b border-border"
                  >
                    <View className="flex-row items-center">
                      <Ionicons
                        name={CATEGORY_ICONS[category] as any}
                        size={16}
                        color="#6B7280"
                      />
                      <Text className="text-sm font-semibold text-text-primary ml-2">
                        {category}
                      </Text>
                      <View className="bg-background-secondary rounded-full px-2 py-0.5 ml-2">
                        <Text className="text-xs text-text-secondary">{dishes.length}</Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#6B7280"
                    />
                  </TouchableOpacity>

                  {/* Dishes */}
                  {isExpanded && dishes.map((dish, i) => (
                    <View
                      key={`${category}-${i}`}
                      className="mx-4 py-3 border-b border-border/50"
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-3">
                          <View className="flex-row items-center">
                            {dish.isStarDish && (
                              <Ionicons name="star" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                            )}
                            <Text className="text-sm font-medium text-text-primary">
                              {dish.name}
                            </Text>
                          </View>
                          <Text className="text-xs text-text-secondary mt-0.5">
                            {dish.reviewCount} {dish.reviewCount === 1 ? 'review' : 'reviews'}
                          </Text>
                        </View>

                        {/* Rating pill */}
                        {dish.avgRating > 0 && (
                          <View
                            className={`flex-row items-center px-2.5 py-1 rounded-full ${ratingBg(dish.avgRating)}`}
                          >
                            <Text
                              className="text-sm font-bold"
                              style={{ color: ratingColor(dish.avgRating) }}
                            >
                              {dish.avgRating.toFixed(1)}
                            </Text>
                            <Text className="text-xs text-text-secondary ml-0.5">/10</Text>
                          </View>
                        )}
                      </View>

                      {/* Dish photos (horizontal scroll) */}
                      {dish.photos.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          className="mt-2"
                        >
                          <View className="flex-row gap-2">
                            {dish.photos.map((photo, pi) => (
                              <View key={pi} className="rounded-lg overflow-hidden">
                                <Image
                                  source={{ uri: photo.uri }}
                                  style={{ width: 100, height: 100 }}
                                  resizeMode="cover"
                                />
                              </View>
                            ))}
                          </View>
                        </ScrollView>
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Photo Gallery (labeled) ────────────────────────────────────── */}
        {labeledPhotos.length > 0 && (
          <View className="mb-4">
            <View className="px-4 mb-3 flex-row items-center">
              <Ionicons name="camera-outline" size={18} color="#007AFF" />
              <Text className="text-lg font-bold text-text-primary ml-2">Food Photos</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
              <View className="flex-row gap-2">
                {labeledPhotos.map((photo, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => navigation.navigate('MealDetail', { postId: photo.postId })}
                    className="rounded-xl overflow-hidden"
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={{ width: 160, height: 160 }}
                      resizeMode="cover"
                    />
                    {/* Label overlay */}
                    <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5">
                      <Text className="text-white text-xs font-semibold" numberOfLines={1}>
                        {photo.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Friends Who've Been ────────────────────────────────────────── */}
        {visitors.length > 0 && (
          <View className="mx-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="people-outline" size={18} color="#007AFF" />
              <Text className="text-lg font-bold text-text-primary ml-2">Who's Been Here</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3">
                {visitors.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
                    className="items-center"
                  >
                    {user.avatar_url ? (
                      <Image
                        source={{ uri: user.avatar_url }}
                        className="w-14 h-14 rounded-full"
                      />
                    ) : (
                      <View className="w-14 h-14 rounded-full bg-accent/20 items-center justify-center">
                        <Text className="text-lg font-bold text-accent">
                          {user.display_name?.[0]?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                    )}
                    <Text className="text-xs text-text-secondary mt-1 max-w-[60px]" numberOfLines={1}>
                      {user.display_name?.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Recent Posts ───────────────────────────────────────────────── */}
        {posts.length > 0 && (
          <View className="mb-4">
            <View className="px-4 mb-3 flex-row items-center">
              <Ionicons name="newspaper-outline" size={18} color="#007AFF" />
              <Text className="text-lg font-bold text-text-primary ml-2">Recent Posts</Text>
            </View>
            {posts.slice(0, 5).map((post) => (
              <TouchableOpacity
                key={post.id}
                onPress={() => navigation.navigate('MealDetail', { postId: post.id })}
                className="mx-4 mb-3 bg-background-secondary rounded-xl p-3"
              >
                <View className="flex-row items-center">
                  {/* Author avatar */}
                  {post.author?.avatar_url ? (
                    <Image
                      source={{ uri: post.author.avatar_url }}
                      className="w-9 h-9 rounded-full"
                    />
                  ) : (
                    <View className="w-9 h-9 rounded-full bg-accent/20 items-center justify-center">
                      <Text className="text-sm font-bold text-accent">
                        {post.author?.display_name?.[0]?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                  )}
                  <View className="ml-2 flex-1">
                    <Text className="text-sm font-semibold text-text-primary">
                      {post.author?.display_name ?? 'Unknown'}
                    </Text>
                    <Text className="text-xs text-text-secondary">{formatTimeAgo(post.created_at)}</Text>
                  </View>
                  <View className="flex-row items-center bg-gold/10 px-2 py-1 rounded-full">
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text className="text-xs font-bold text-gold ml-0.5">
                      {post.overall_rating.toFixed(1)}
                    </Text>
                  </View>
                </View>
                {post.caption ? (
                  <Text className="text-sm text-text-primary mt-2" numberOfLines={2}>
                    {post.caption}
                  </Text>
                ) : null}
                {/* Mini photo strip */}
                {post.food_photos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                    <View className="flex-row gap-1.5">
                      {post.food_photos.slice(0, 4).map((uri, i) => (
                        <Image
                          key={i}
                          source={{ uri }}
                          className="w-16 h-16 rounded-lg"
                          resizeMode="cover"
                        />
                      ))}
                      {post.food_photos.length > 4 && (
                        <View className="w-16 h-16 rounded-lg bg-black/50 items-center justify-center">
                          <Text className="text-white text-xs font-bold">
                            +{post.food_photos.length - 4}
                          </Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── All Photos Grid ────────────────────────────────────────────── */}
        {allPhotos.length > 0 && (
          <View className="mb-4">
            <View className="px-4 mb-3 flex-row items-center">
              <Ionicons name="grid-outline" size={18} color="#007AFF" />
              <Text className="text-lg font-bold text-text-primary ml-2">All Photos</Text>
              <Text className="text-xs text-text-secondary ml-2">
                {allPhotos.length} {allPhotos.length === 1 ? 'photo' : 'photos'}
              </Text>
            </View>
            <View className="flex-row flex-wrap">
              {allPhotos.map((photo, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => navigation.navigate('MealDetail', { postId: photo.postId })}
                  style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, padding: 1 }}
                >
                  <View className="flex-1 relative">
                    <Image
                      source={{ uri: photo.uri }}
                      style={{ flex: 1 }}
                      resizeMode="cover"
                    />
                    {photo.label && (
                      <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
                        <Text className="text-white text-[10px] font-medium" numberOfLines={1}>
                          {photo.label}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {posts.length === 0 && (
          <View className="items-center py-20 px-8">
            <Ionicons name="restaurant-outline" size={48} color="#D1D5DB" />
            <Text className="text-base text-text-secondary text-center mt-3">
              No one has posted about this restaurant yet. Be the first!
            </Text>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
