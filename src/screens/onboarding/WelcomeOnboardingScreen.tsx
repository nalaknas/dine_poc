import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'receipt-outline' as const,
    title: 'Scan receipts, split instantly',
    description: 'AI-powered receipt scanning assigns items to friends in seconds. No more awkward math.',
    color: '#007AFF',
  },
  {
    icon: 'people-outline' as const,
    title: 'Share dining experiences',
    description: 'Post food photos, rate dishes, and let your friends discover where you eat.',
    color: '#10B981',
  },
  {
    icon: 'search-outline' as const,
    title: 'Discover through your network',
    description: 'See where your friends dine. Find restaurants based on their honest ratings.',
    color: '#F59E0B',
  },
  {
    icon: 'star-outline' as const,
    title: 'Build your taste profile',
    description: 'Rate dishes and get personalized restaurant recommendations — even for date nights.',
    color: '#EF4444',
  },
];

export function WelcomeOnboardingScreen() {
  const navigation = useNavigation<any>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setCurrentIndex(next);
    } else {
      navigation.navigate('Permissions');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width }} className="flex-1 items-center justify-center px-8">
            <View
              style={{ backgroundColor: slide.color + '20', width: 120, height: 120, borderRadius: 30 }}
              className="items-center justify-center mb-8"
            >
              <Ionicons name={slide.icon} size={56} color={slide.color} />
            </View>
            <Text className="text-2xl font-bold text-text-primary text-center mb-4">
              {slide.title}
            </Text>
            <Text className="text-base text-text-secondary text-center leading-6">
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots + button */}
      <View className="pb-12 px-8">
        <View className="flex-row justify-center mb-8">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentIndex ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === currentIndex ? '#007AFF' : '#E5E7EB',
                marginHorizontal: 4,
              }}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={goNext}
          className="bg-accent rounded-xl py-4 items-center"
        >
          <Text className="text-white text-base font-semibold">
            {currentIndex < SLIDES.length - 1 ? 'Next' : 'Get Started'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
