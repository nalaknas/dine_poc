import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '../../stores/authStore';
import { getOrCreateUserProfile } from '../../services/auth-service';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { Button } from '../../components/ui/Button';
import { trackSignUp, trackSignIn } from '../../lib/analytics';
import { Config } from '../../constants/config';
import type { RootStackParamList } from '../../types';

WebBrowser.maybeCompleteAuthSession();

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
  const { signIn, signUp, signInWithIdToken, isLoading } = useAuthStore();
  const { setProfile } = useUserProfileStore();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handlePostAuth = async (method: string) => {
    const { user } = useAuthStore.getState();
    if (user) {
      trackSignIn({ userId: user.id, loginMethod: method, success: true });
      const profile = await getOrCreateUserProfile(user.id, user.email);
      setProfile(profile);
    }
  };


  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert('Error', 'Apple Sign-In failed — no identity token received.');
        return;
      }

      await signInWithIdToken('apple', credential.identityToken);
      await handlePostAuth('apple');
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Error', friendlyError(err?.message ?? 'Apple Sign-In failed'));
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const redirectUri = 'https://auth.expo.io/@nalaknas/dine';
      const nonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Crypto.getRandomBytes(32).toString(),
      );

      // Build the Google OAuth URL manually
      const params = new URLSearchParams({
        client_id: Config.google.oauthClientId,
        redirect_uri: redirectUri,
        response_type: 'id_token',
        scope: 'openid profile email',
        nonce,
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        // Parse the id_token from the redirect URL fragment
        const url = result.url;
        const fragment = url.split('#')[1] ?? '';
        const fragParams = new URLSearchParams(fragment);
        const idToken = fragParams.get('id_token');

        if (idToken) {
          await signInWithIdToken('google', idToken);
          await handlePostAuth('google');
        } else {
          Alert.alert('Error', 'No ID token received from Google.');
        }
      }
    } catch (err: any) {
      console.log('[GoogleAuth] ERROR:', err);
      Alert.alert('Error', friendlyError(err?.message ?? 'Google Sign-In failed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
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

      const { user } = useAuthStore.getState();
      if (user) {
        const trimmedEmail = email.trim().toLowerCase();
        if (mode === 'signup') {
          trackSignUp({ userId: user.id, email: trimmedEmail, signupMethod: 'email' });
        } else {
          trackSignIn({ userId: user.id, loginMethod: 'email', success: true });
        }
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

            {/* Social Sign-In Buttons */}
            <View className="mb-6 gap-3">
              <TouchableOpacity
                onPress={handleAppleSignIn}
                disabled={isLoading}
                className="flex-row items-center justify-center bg-black rounded-xl py-3.5 px-4"
              >
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text className="text-white text-base font-semibold ml-2">
                  Continue with Apple
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={isLoading || googleLoading}
                className="flex-row items-center justify-center bg-white border border-border rounded-xl py-3.5 px-4"
              >
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text className="text-text-primary text-base font-semibold ml-2">
                  Continue with Google
                </Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View className="flex-row items-center mb-6">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-sm text-text-secondary mx-4">or</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* Email form — collapsed by default */}
            {!showEmailForm ? (
              <TouchableOpacity
                onPress={() => setShowEmailForm(true)}
                className="border border-border rounded-xl py-3.5 items-center mb-6"
              >
                <Text className="text-base font-semibold text-text-primary">
                  {mode === 'signin' ? 'Sign in with Email' : 'Sign up with Email'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View>
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
                  onPress={handleEmailSubmit}
                  loading={isLoading}
                  fullWidth
                  size="lg"
                />
              </View>
            )}

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
