import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { createNotification } from './user-service';

const MENTION_REGEX = /@(\w+)/g;

const MAX_MENTIONS_PER_TEXT = 10;

/** Search users by username or display_name prefix for autocomplete. */
export async function searchUsersForMention(
  query: string,
  limit = 10,
): Promise<Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>[]> {
  if (!query.trim()) return [];

  // Sanitize query to prevent PostgREST filter injection
  const sanitized = query.replace(/[%_,.()"'\\]/g, '');
  if (!sanitized) return [];

  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .or(`username.ilike.${sanitized}%,display_name.ilike.${sanitized}%`)
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** Extract @usernames from text. Returns an array of username strings (without @). */
export function parseMentions(text: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  return matches;
}

/** Resolve usernames to user IDs. Returns a map of username → userId. */
export async function resolveUsernames(
  usernames: string[],
): Promise<Record<string, string>> {
  if (usernames.length === 0) return {};

  const { data } = await supabase
    .from('users')
    .select('id, username')
    .in('username', usernames);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.username as string] = row.id as string;
  }
  return map;
}

/** Create mention notifications for all @mentioned users in text (max 10). */
export async function createMentionNotifications(
  text: string,
  fromUserId: string,
  postId: string,
): Promise<void> {
  const usernames = parseMentions(text).slice(0, MAX_MENTIONS_PER_TEXT);
  if (usernames.length === 0) return;

  const usernameToId = await resolveUsernames(usernames);

  await Promise.allSettled(
    Object.values(usernameToId)
      .filter((userId) => userId !== fromUserId)
      .map((userId) =>
        createNotification({
          userId,
          type: 'tag',
          fromUserId,
          postId,
          message: 'mentioned you',
        }),
      ),
  );
}
