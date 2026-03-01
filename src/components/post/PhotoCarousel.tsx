import React, { useState, useRef } from 'react';
import { View, Image, ScrollView, Dimensions, Text } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PhotoCarouselProps {
  photos: string[];
  aspectRatio?: number;
}

export function PhotoCarousel({ photos, aspectRatio = 1 }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const height = SCREEN_WIDTH / aspectRatio;

  if (photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <Image
        source={{ uri: photos[0] }}
        style={{ width: SCREEN_WIDTH, height }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={{ width: SCREEN_WIDTH, height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(idx);
        }}
        scrollEventThrottle={16}
      >
        {photos.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{ width: SCREEN_WIDTH, height }}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      {/* Dot indicators */}
      <View className="absolute bottom-2 left-0 right-0 flex-row justify-center">
        {photos.map((_, i) => (
          <View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.5)',
              marginHorizontal: 3,
            }}
          />
        ))}
      </View>
      {/* Counter badge */}
      <View className="absolute top-2 right-2 bg-black/50 rounded-full px-2 py-0.5">
        <Text className="text-white text-xs font-medium">
          {currentIndex + 1}/{photos.length}
        </Text>
      </View>
    </View>
  );
}
