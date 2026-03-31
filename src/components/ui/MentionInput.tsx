import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, TextInput, FlatList, TouchableOpacity, Text,
  type TextInputProps, type NativeSyntheticEvent, type TextInputSelectionChangeEventData,
} from 'react-native';
import { Avatar } from './Avatar';
import { searchUsersForMention } from '../../services/mention-service';
import type { User } from '../../types';

type MentionUser = Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;

interface MentionInputProps extends Omit<TextInputProps, 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
}

export function MentionInput({ value, onChangeText, ...inputProps }: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const cursorRef = useRef(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      cursorRef.current = e.nativeEvent.selection.end;
    },
    [],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);

      // Find the @ trigger near the cursor
      const cursor = Math.min(cursorRef.current, text.length);
      const textBeforeCursor = text.slice(0, cursor);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        const query = atMatch[1];
        setMentionQuery(query);

        // Debounce search
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (query.length > 0) {
          searchTimeoutRef.current = setTimeout(async () => {
            try {
              const results = await searchUsersForMention(query);
              setSuggestions(results);
            } catch {
              setSuggestions([]);
            }
          }, 200);
        } else {
          setSuggestions([]);
        }
      } else {
        setMentionQuery(null);
        setSuggestions([]);
      }
    },
    [onChangeText],
  );

  const handleSelectUser = useCallback(
    (selectedUser: MentionUser) => {
      if (mentionQuery === null) return;

      const cursor = Math.min(cursorRef.current, value.length);
      const textBeforeCursor = value.slice(0, cursor + 1);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex === -1) return;

      const before = value.slice(0, atIndex);
      const after = value.slice(atIndex + 1 + (mentionQuery?.length ?? 0));
      const insertion = `@${selectedUser.username} `;
      const newText = `${before}${insertion}${after}`;

      // Update cursor to end of inserted mention
      cursorRef.current = atIndex + insertion.length;
      onChangeText(newText);
      setSuggestions([]);
      setMentionQuery(null);
    },
    [value, mentionQuery, onChangeText],
  );

  return (
    <View>
      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && (
        <View className="bg-background border border-border rounded-xl mb-2" style={{ maxHeight: 180 }}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="always"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectUser(item)}
                className="flex-row items-center px-3 py-2 border-b border-border-light"
              >
                <Avatar uri={item.avatar_url} displayName={item.display_name} size={28} />
                <View className="ml-2">
                  <Text className="text-sm font-semibold text-text-primary">@{item.username}</Text>
                  <Text className="text-xs text-text-secondary">{item.display_name}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <TextInput
        value={value}
        onChangeText={handleChangeText}
        onSelectionChange={handleSelectionChange}
        {...inputProps}
      />
    </View>
  );
}
