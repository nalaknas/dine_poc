import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  Alert, AppState, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { openVenmoApp, isValidVenmoUsername, cleanVenmoUsername } from '../../services/venmo-service';

interface VenmoConnectButtonProps {
  currentUsername?: string;
  onUsernameConfirmed: (username: string) => void;
  onDisconnect?: () => void;
}

const USERNAME_PATTERN = /^@?[a-zA-Z0-9_-]{1,30}$/;

export function VenmoConnectButton({ currentUsername, onUsernameConfirmed, onDisconnect }: VenmoConnectButtonProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [input, setInput] = useState('');
  const [clipboardHint, setClipboardHint] = useState(false);
  const [venmoInstalled, setVenmoInstalled] = useState(true);
  const appStateRef = useRef(AppState.currentState);

  // Check if Venmo is installed on mount
  useEffect(() => {
    Linking.canOpenURL('venmo://').then(setVenmoInstalled);
  }, []);

  // When modal opens, check clipboard for a username-like string
  useEffect(() => {
    if (modalVisible) {
      checkClipboard();
    }
  }, [modalVisible]);

  // Listen for app returning from background (after opening Venmo)
  useEffect(() => {
    if (!modalVisible) return;

    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        checkClipboard();
      }
      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, [modalVisible]);

  const checkClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && USERNAME_PATTERN.test(text.trim())) {
        const cleaned = cleanVenmoUsername(text);
        setInput(cleaned);
        setClipboardHint(true);
      }
    } catch {
      // Clipboard access denied — ignore
    }
  };

  const handleOpen = () => {
    setInput(currentUsername ?? '');
    setClipboardHint(false);
    setModalVisible(true);
  };

  const handleOpenVenmo = async () => {
    const opened = await openVenmoApp();
    if (!opened) {
      Alert.alert('Venmo Not Found', 'The Venmo app is not installed on this device.');
    }
  };

  const handleConfirm = () => {
    const cleaned = cleanVenmoUsername(input);
    if (!cleaned) {
      Alert.alert('Required', 'Please enter your Venmo username.');
      return;
    }
    if (!isValidVenmoUsername(cleaned)) {
      Alert.alert('Invalid Username', 'Venmo usernames can only contain letters, numbers, hyphens, and underscores.');
      return;
    }
    onUsernameConfirmed(cleaned);
    setModalVisible(false);
  };

  const handleDisconnect = () => {
    onDisconnect?.();
    setModalVisible(false);
  };

  return (
    <>
      {/* Button */}
      {currentUsername ? (
        <TouchableOpacity onPress={handleOpen} className="flex-row items-center bg-green-50 border border-green-200 rounded-xl px-4 py-3.5">
          <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
          <View className="ml-3 flex-1">
            <Text className="text-xs text-green-700 font-medium">Venmo Connected</Text>
            <Text className="text-base text-green-900 font-semibold">@{currentUsername}</Text>
          </View>
          <Text className="text-sm text-green-600 font-medium">Change</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={handleOpen} className="flex-row items-center justify-center bg-[#008CFF] rounded-xl px-4 py-3.5">
          <Ionicons name="logo-venmo" size={20} color="#fff" />
          <Text className="text-white text-base font-semibold ml-2">Connect Venmo</Text>
        </TouchableOpacity>
      )}

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-3xl px-6 pt-6 pb-10">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-text-primary">Connect Venmo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Instructions */}
            <Text className="text-sm text-text-secondary mb-4">
              Enter your Venmo username exactly as it appears in your Venmo profile.
            </Text>

            {/* Open Venmo button */}
            {venmoInstalled && (
              <TouchableOpacity
                onPress={handleOpenVenmo}
                className="flex-row items-center justify-center bg-background-secondary border border-border rounded-xl px-4 py-3 mb-4"
              >
                <Ionicons name="open-outline" size={18} color="#007AFF" />
                <Text className="text-accent text-sm font-semibold ml-2">Open Venmo to Copy Username</Text>
              </TouchableOpacity>
            )}

            {/* Input */}
            <View className="flex-row items-center bg-background-secondary border border-border rounded-xl px-4 py-3 mb-2">
              <Text className="text-base text-text-secondary mr-1">@</Text>
              <TextInput
                value={input}
                onChangeText={(t) => {
                  setInput(cleanVenmoUsername(t));
                  setClipboardHint(false);
                }}
                placeholder="username"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 text-base text-text-primary"
              />
            </View>

            {/* Clipboard hint */}
            {clipboardHint && (
              <Text className="text-xs text-text-secondary mb-4">Pasted from clipboard</Text>
            )}
            {!clipboardHint && <View className="mb-4" />}

            {/* Confirm */}
            <TouchableOpacity onPress={handleConfirm} className="bg-accent rounded-xl py-4 items-center mb-3">
              <Text className="text-white text-base font-semibold">Confirm</Text>
            </TouchableOpacity>

            {/* Disconnect (only if already connected) */}
            {currentUsername && onDisconnect && (
              <TouchableOpacity onPress={handleDisconnect} className="items-center py-2">
                <Text className="text-sm text-error font-medium">Disconnect Venmo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
