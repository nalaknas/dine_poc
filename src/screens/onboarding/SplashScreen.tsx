import React, { useEffect } from 'react';
import { View, Text, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const opacity = new Animated.Value(0);
  const scale = new Animated.Value(0.8);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      navigation.replace('Auth');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 bg-black items-center justify-center">
      <Animated.View style={{ opacity, transform: [{ scale }] }} className="items-center">
        <Image
          source={require('../../../assets/splash-logo.png')}
          style={{ width: 220, height: 220 }}
          resizeMode="contain"
        />
        <Text style={{ color: '#F59E0B', fontSize: 16, fontWeight: '500', marginTop: 12 }}>
          Split. Share. Relive.
        </Text>
      </Animated.View>
    </View>
  );
}
