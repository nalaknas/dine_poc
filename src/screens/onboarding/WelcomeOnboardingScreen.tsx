import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'receipt-outline' as const,
    title: 'Scan receipts, split instantly',
    description: 'AI-powered receipt scanning assigns items to friends in seconds. No more awkward math.',
    colors: ['#007AFF', '#5856D6'] as [string, string],
  },
  {
    icon: 'people-outline' as const,
    title: 'Share dining experiences',
    description: 'Post food photos, rate dishes, and let your friends discover where you eat.',
    colors: ['#10B981', '#059669'] as [string, string],
  },
  {
    icon: 'search-outline' as const,
    title: 'Discover through your network',
    description: 'See where your friends dine. Find restaurants based on their honest ratings.',
    colors: ['#F59E0B', '#D97706'] as [string, string],
  },
  {
    icon: 'star-outline' as const,
    title: 'Build your taste profile',
    description: 'Rate dishes and get personalized restaurant recommendations — even for date nights.',
    colors: ['#EF4444', '#DC2626'] as [string, string],
  },
];

export function WelcomeOnboardingScreen() {
  const navigation = useNavigation<any>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setCurrentIndex(next);
    } else {
      navigation.navigate('Permissions');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            {/* Double-layered gradient icon */}
            <View style={{ marginBottom: 32 }}>
              <LinearGradient
                colors={[slide.colors[0] + '15', slide.colors[0] + '05']}
                style={{ width: 140, height: 140, borderRadius: 35, alignItems: 'center', justifyContent: 'center' }}
              >
                <LinearGradient
                  colors={slide.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 100, height: 100, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name={slide.icon} size={48} color="#FFFFFF" />
                </LinearGradient>
              </LinearGradient>
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#1F2937', textAlign: 'center', marginBottom: 16 }}>
              {slide.title}
            </Text>
            <Text style={{ fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 }}>
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots + button */}
      <View style={{ paddingBottom: 48, paddingHorizontal: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 32 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === currentIndex ? '#007AFF' : '#E5E7EB',
                marginHorizontal: 4,
              }}
            />
          ))}
        </View>

        <Pressable onPress={goNext} style={{ borderRadius: 14, overflow: 'hidden' }}>
          <LinearGradient
            colors={['#007AFF', '#5856D6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>
              {currentIndex < SLIDES.length - 1 ? 'Next' : 'Get Started'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
