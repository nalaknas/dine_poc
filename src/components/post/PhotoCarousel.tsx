import React, { useState } from 'react';
import { View, Image, ScrollView, Dimensions, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function PhotoLabel({ label }: { label: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <BlurView intensity={60} tint="dark" style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{label}</Text>
      </BlurView>
    </View>
  );
}

interface PhotoCarouselProps {
  photos: string[];
  photoLabels?: Record<string, string>;
  aspectRatio?: number;
}

function FadeInImage({ uri, width, height }: { uri: string; width: number; height: number }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ width, height, backgroundColor: '#F3F4F6' }}>
      <Image
        source={{ uri }}
        style={{ width, height }}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
      {loaded && (
        <Animated.View
          entering={FadeIn.duration(250)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
    </View>
  );
}

export function PhotoCarousel({ photos, photoLabels, aspectRatio = 1 }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const height = SCREEN_WIDTH / aspectRatio;

  if (photos.length === 0) return null;

  if (photos.length === 1) {
    const label = photoLabels?.['0'];
    return (
      <View style={{ position: 'relative' }}>
        <FadeInImage uri={photos[0]} width={SCREEN_WIDTH} height={height} />
        {label && <PhotoLabel label={label} />}
      </View>
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
          <View key={i} style={{ width: SCREEN_WIDTH, height, position: 'relative' }}>
            <FadeInImage uri={uri} width={SCREEN_WIDTH} height={height} />
            {photoLabels?.[String(i)] && <PhotoLabel label={photoLabels[String(i)]} />}
          </View>
        ))}
      </ScrollView>
      {/* Dot indicators */}
      <View
        style={{
          position: 'absolute',
          bottom: 10,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
        }}
      >
        {photos.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === currentIndex ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === currentIndex ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
              marginHorizontal: 3,
            }}
          />
        ))}
      </View>
      {/* Counter badge with blur */}
      <View
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <BlurView intensity={60} tint="dark" style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>
            {currentIndex + 1}/{photos.length}
          </Text>
        </BlurView>
      </View>
    </View>
  );
}
