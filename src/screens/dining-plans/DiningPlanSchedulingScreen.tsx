import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { DateOptionCard } from '../../components/dining-plans/DateOptionCard';
import {
  fetchDateResults,
  fetchMyDateVotes,
  addDateOption,
  castDateVote,
  fetchPlanDetail,
} from '../../services/dining-plan-service';
import { useAuthStore } from '../../stores/authStore';
import type { RootStackParamList, DiningPlanDateOption, DiningPlanMember } from '../../types';

type SchedulingRoute = RouteProp<RootStackParamList, 'DiningPlanScheduling'>;

/** Quick-pick date offset options for convenience */
const QUICK_PICKS = [
  { label: 'Tomorrow', daysFromNow: 1 },
  { label: 'This Weekend', daysFromNow: (() => { const d = new Date().getDay(); return d <= 5 ? 6 - d : 7; })() },
  { label: 'Next Week', daysFromNow: 7 },
];

export function DiningPlanSchedulingScreen() {
  const { params } = useRoute<SchedulingRoute>();
  const { user } = useAuthStore();

  const [dateOptions, setDateOptions] = useState<DiningPlanDateOption[]>([]);
  const [members, setMembers] = useState<DiningPlanMember[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date input
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('7:00 PM');
  const [isAdding, setIsAdding] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setIsRefreshing(true); else setIsLoading(true);

    try {
      const [results, votes, detail] = await Promise.all([
        fetchDateResults(params.planId),
        fetchMyDateVotes(params.planId, user.id),
        fetchPlanDetail(params.planId),
      ]);
      setDateOptions(results);
      setMembers(detail.members);
      const voteMap: Record<string, boolean> = {};
      for (const v of votes) {
        voteMap[v.date_option_id] = v.vote;
      }
      setMyVotes(voteMap);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, params.planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMemberName = useCallback((userId: string): string => {
    const member = members.find((m) => m.user_id === userId);
    return member?.user?.display_name ?? 'Someone';
  }, [members]);

  /** Parse a date string + time string into ISO. Supports "Apr 5", "4/5", "April 5 2026", etc. */
  const parseDateTime = useCallback((dateStr: string, timeStr: string): Date | null => {
    try {
      // Try combining into a parseable string
      const combined = `${dateStr.trim()} ${timeStr.trim()}`;
      const parsed = new Date(combined);
      if (!isNaN(parsed.getTime())) return parsed;

      // Fallback: try Date.parse with current year
      const withYear = `${dateStr.trim()}, ${new Date().getFullYear()} ${timeStr.trim()}`;
      const fallback = new Date(withYear);
      if (!isNaN(fallback.getTime())) return fallback;

      return null;
    } catch {
      return null;
    }
  }, []);

  const handleAddDate = useCallback(async () => {
    if (!user || !dateText.trim()) {
      Alert.alert('Required', 'Enter a date.');
      return;
    }

    const parsed = parseDateTime(dateText, timeText);
    if (!parsed) {
      Alert.alert('Invalid Date', 'Could not parse date. Try a format like "Apr 5" or "4/5".');
      return;
    }

    if (parsed < new Date()) {
      Alert.alert('Past Date', 'Please select a future date.');
      return;
    }

    setIsAdding(true);
    try {
      await addDateOption(params.planId, parsed.toISOString(), user.id);
      setShowDateInput(false);
      setDateText('');
      loadData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add date';
      Alert.alert('Error', message);
    } finally {
      setIsAdding(false);
    }
  }, [user, params.planId, dateText, timeText, parseDateTime, loadData]);

  const handleQuickPick = useCallback(async (daysFromNow: number) => {
    if (!user) return;
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(19, 0, 0, 0); // Default 7 PM

    setIsAdding(true);
    try {
      await addDateOption(params.planId, date.toISOString(), user.id);
      loadData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add date';
      Alert.alert('Error', message);
    } finally {
      setIsAdding(false);
    }
  }, [user, params.planId, loadData]);

  const handleVote = useCallback(async (dateOptionId: string, vote: boolean) => {
    if (!user) return;
    setMyVotes((prev) => ({ ...prev, [dateOptionId]: vote }));
    try {
      await castDateVote(dateOptionId, user.id, vote);
      const results = await fetchDateResults(params.planId);
      setDateOptions(results);
    } catch {
      setMyVotes((prev) => {
        const copy = { ...prev };
        delete copy[dateOptionId];
        return copy;
      });
    }
  }, [user, params.planId]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            tintColor="#007AFF"
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1F2937', marginBottom: 4 }}>
          Pick a Date
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
          Vote on proposed dates or suggest a new one.
        </Text>

        {/* Date options */}
        {dateOptions.map((opt) => (
          <DateOptionCard
            key={opt.id}
            option={opt}
            proposerName={getMemberName(opt.proposed_by)}
            userVote={myVotes[opt.id] ?? null}
            onUpvote={() => handleVote(opt.id, true)}
            onDownvote={() => handleVote(opt.id, false)}
          />
        ))}

        {dateOptions.length === 0 && (
          <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 }}>
            No dates proposed yet. Be the first to suggest.
          </Text>
        )}

        {/* Quick picks */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 12 }}>
          {QUICK_PICKS.map((pick) => (
            <TouchableOpacity
              key={pick.label}
              onPress={() => handleQuickPick(pick.daysFromNow)}
              disabled={isAdding}
              style={{
                flex: 1,
                backgroundColor: '#F9FAFB',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#007AFF' }}>
                {pick.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom date input */}
        <TouchableOpacity
          onPress={() => setShowDateInput(!showDateInput)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: '#F9FAFB',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 12,
            paddingVertical: 14,
          }}
        >
          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#007AFF' }}>
            Custom Date & Time
          </Text>
        </TouchableOpacity>

        {showDateInput && (
          <View
            style={{
              backgroundColor: '#F9FAFB',
              borderRadius: 12,
              padding: 14,
              marginTop: 12,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Date</Text>
                <TextInput
                  value={dateText}
                  onChangeText={setDateText}
                  placeholder="e.g. Apr 5 or 4/5/2026"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: '#1F2937',
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Time</Text>
                <TextInput
                  value={timeText}
                  onChangeText={setTimeText}
                  placeholder="7:00 PM"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: '#1F2937',
                  }}
                />
              </View>
            </View>
            <TouchableOpacity
              onPress={handleAddDate}
              disabled={isAdding}
              style={{
                backgroundColor: '#007AFF',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: isAdding ? 0.6 : 1,
              }}
            >
              {isAdding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                  Add This Date
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
