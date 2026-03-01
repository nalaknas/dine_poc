import React, { useEffect } from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    <View className="flex-1 bg-background items-center justify-center">
      <Animated.View style={{ opacity, transform: [{ scale }] }} className="items-center">
        <View className="w-24 h-24 bg-accent rounded-3xl items-center justify-center mb-6 shadow-lg">
          <Ionicons name="restaurant" size={48} color="#fff" />
        </View>
        <Text className="text-4xl font-bold text-text-primary">Dine</Text>
        <Text className="text-base text-text-secondary mt-2">Eat. Share. Connect.</Text>
      </Animated.View>
    </View>
  );
}
