import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const taglineY = useSharedValue(20);
  const taglineOpacity = useSharedValue(0);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: taglineY.value }],
    opacity: taglineOpacity.value,
  }));

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    logoOpacity.value = withTiming(1, { duration: 500 });
    taglineY.value = withDelay(400, withSpring(0, { damping: 14 }));
    taglineOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));

    const timer = setTimeout(() => {
      navigation.replace('Auth');
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={['#0A0A0A', '#1A1A2E', '#0A0A0A']}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={[{ alignItems: 'center' }, logoStyle]}>
        <Image
          source={require('../../../assets/splash-logo.png')}
          style={{ width: 220, height: 220 }}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View style={taglineStyle}>
        <Text style={{ color: '#F59E0B', fontSize: 16, fontWeight: '500', marginTop: 12 }}>
          Split. Share. Relive.
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}
