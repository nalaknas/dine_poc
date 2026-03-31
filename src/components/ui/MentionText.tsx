import React, { useCallback } from 'react';
import { Text, type TextStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { resolveUsernames } from '../../services/mention-service';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MENTION_PART_REGEX = /(@\w+)/g;

interface MentionTextProps {
  text: string;
  style?: TextStyle;
  /** Pre-resolved username → userId map (optional, saves DB calls). */
  userMap?: Record<string, string>;
}

/**
 * Renders text with @mentions as tappable blue links.
 * Tapping a mention navigates to that user's profile.
 */
export function MentionText({ text, style, userMap }: MentionTextProps) {
  const navigation = useNavigation<Nav>();
  const [resolvedMap, setResolvedMap] = React.useState<Record<string, string>>(userMap ?? {});

  // Lazy-resolve usernames on first render if no userMap provided
  React.useEffect(() => {
    if (userMap) return;
    const mentions = text.match(MENTION_PART_REGEX);
    if (!mentions || mentions.length === 0) return;

    const usernames = mentions.map((m) => m.slice(1)); // strip @
    resolveUsernames(usernames).then(setResolvedMap).catch(() => {});
  }, [text, userMap]);

  const handleMentionPress = useCallback(
    (username: string) => {
      const userId = resolvedMap[username];
      if (userId) {
        navigation.navigate('UserProfile', { userId });
      }
    },
    [navigation, resolvedMap],
  );

  const parts = text.split(MENTION_PART_REGEX);

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1) {
          const username = part.slice(1);
          return (
            <Text
              key={i}
              style={{ color: '#007AFF', fontWeight: '600' }}
              onPress={() => handleMentionPress(username)}
            >
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}
