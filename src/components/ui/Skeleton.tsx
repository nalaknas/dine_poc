import React from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

/* ───── primitives ───── */

function usePulse() {
  const opacity = useSharedValue(1);
  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

interface RectProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
}

export function SkeletonRect({ width = '100%', height = 16, borderRadius = 8 }: RectProps) {
  const pulse = usePulse();
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#E5E7EB' },
        pulse,
      ]}
    />
  );
}

interface CircleProps {
  size?: number;
}

export function SkeletonCircle({ size = 40 }: CircleProps) {
  const pulse = usePulse();
  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: '#E5E7EB' },
        pulse,
      ]}
    />
  );
}

interface TextProps {
  lines?: number;
  lastWidth?: DimensionValue;
}

export function SkeletonText({ lines = 3, lastWidth = '60%' }: TextProps) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonRect
          key={i}
          width={i === lines - 1 ? lastWidth : '100%'}
          height={12}
        />
      ))}
    </View>
  );
}

/* ───── composites ───── */

export function PostCardSkeleton() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SkeletonCircle size={36} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonRect width="40%" height={12} />
          <SkeletonRect width="25%" height={10} />
        </View>
      </View>
      <SkeletonRect width="100%" height={200} borderRadius={12} />
      <SkeletonText lines={2} lastWidth="50%" />
    </View>
  );
}

export function FeedSkeleton() {
  return (
    <View style={{ paddingTop: 8 }}>
      {[0, 1, 2].map((i) => (
        <PostCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <SkeletonCircle size={80} />
        <SkeletonRect width="35%" height={16} />
        <SkeletonRect width="50%" height={12} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ alignItems: 'center', gap: 4 }}>
            <SkeletonRect width={40} height={20} />
            <SkeletonRect width={50} height={10} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonRect key={i} width="48%" height={120} borderRadius={12} />
        ))}
      </View>
    </View>
  );
}

export function ActivitySkeleton() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SkeletonCircle size={40} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonRect width="70%" height={12} />
            <SkeletonRect width="40%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ExploreSkeleton() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <SkeletonRect width="100%" height={44} borderRadius={12} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRect key={i} width={80} height={32} borderRadius={16} />
        ))}
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SkeletonRect width={60} height={60} borderRadius={8} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonRect width="60%" height={12} />
            <SkeletonRect width="40%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}
