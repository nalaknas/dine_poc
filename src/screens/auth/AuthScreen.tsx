import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { getOrCreateUserProfile } from '../../services/auth-service';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { Button } from '../../components/ui/Button';
import type { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Mode = 'signin' | 'signup';

const ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Invalid email or password',
  'User already registered': 'An account with this email already exists',
  'Password should be at least 6 characters': 'Password must be at least 6 characters',
  'Email rate limit exceeded': 'Too many attempts. Please try again later.',
};

function friendlyError(message: string): string {
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(key)) return value;
  }
  return message;
}

export function AuthScreen() {
  const navigation = useNavigation<Nav>();
  const { signIn, signUp, isLoading } = useAuthStore();
  const { setProfile } = useUserProfileStore();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }

    try {
      if (mode === 'signup') {
        await signUp(email.trim().toLowerCase(), password);
      } else {
        await signIn(email.trim().toLowerCase(), password);
      }

      // Fetch/create profile after auth
      const { user } = useAuthStore.getState();
      if (user) {
        const profile = await getOrCreateUserProfile(user.id, user.email);
        setProfile(profile);
      }
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err?.message ?? 'Something went wrong'));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-12">
            {/* Logo / Brand */}
            <View className="items-center mb-10">
              <View className="w-16 h-16 bg-accent rounded-2xl items-center justify-center mb-4">
                <Ionicons name="restaurant" size={32} color="#fff" />
              </View>
              <Text className="text-4xl font-bold text-text-primary">Dine</Text>
              <Text className="text-base text-text-secondary mt-1">
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </Text>
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-text-primary mb-1.5">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
              />
            </View>

            {/* Password */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-text-primary mb-1.5">Password</Text>
              <View className="bg-background-secondary border border-border rounded-xl px-4 py-3 flex-row items-center">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 text-base text-text-primary"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit */}
            <Button
              title={mode === 'signin' ? 'Sign In' : 'Create Account'}
              onPress={handleSubmit}
              loading={isLoading}
              fullWidth
              size="lg"
            />

            {/* Toggle mode */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-base text-text-secondary">
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
                <Text className="text-base font-semibold text-accent">
                  {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
