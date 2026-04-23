import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Shadows } from '../../constants/shadows';
import { Gold, Neutral, Onyx, Semantic } from '../../constants/colors';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '../../utils/format';

export function SummaryScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const {
    personBreakdowns,
    currentReceipt,
    selectedFriends,
    itemAssignments,
    familyStyleItems,
    isFamilyStyle,
  } = useBillSplitterStore();

  // Friends who aren't you and have Venmo usernames
  const venmoableBreakdowns = personBreakdowns.filter(
    (b) => b.friend.id !== user?.id && b.friend.venmo_username && b.total > 0,
  );

  const userBreakdown = personBreakdowns.find((b) => b.friend.id === user?.id);
  const userShare = userBreakdown?.total ?? 0;
  const total = currentReceipt?.total ?? 0;

  // Tip percent string for the eyebrow
  const tipPercent = useMemo(() => {
    const subtotal = currentReceipt?.subtotal ?? 0;
    const tip = currentReceipt?.tip ?? 0;
    if (!subtotal || !tip) return null;
    return Math.round((tip / subtotal) * 100);
  }, [currentReceipt]);

  // Resolve the avatar stack for a given receipt item. Two paths:
  //   1. `isFamilyStyle` global flag — whole receipt is split equally
  //   2. `familyStyleItems` Set — per-item family-style override
  //   3. Otherwise: explicit `itemAssignments` from AssignItemsScreen
  const avatarsFor = (itemId: string) => {
    const isFamily = isFamilyStyle || familyStyleItems.has(itemId);
    const assignedIds = isFamily
      ? selectedFriends.map((f) => f.id)
      : itemAssignments[itemId] ?? [];
    return selectedFriends.filter((f) => assignedIds.includes(f.id));
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta block */}
        <Text style={styles.overline}>
          SPLIT · {personBreakdowns.length}{' '}
          {personBreakdowns.length === 1 ? 'PERSON' : 'PEOPLE'}
        </Text>
        <Text style={styles.restaurantName} numberOfLines={1}>
          {currentReceipt?.restaurantName ?? 'Restaurant'}
        </Text>
        {(currentReceipt?.city || currentReceipt?.state) && (
          <Text style={styles.location}>
            {[currentReceipt?.city, currentReceipt?.state].filter(Boolean).join(', ')}
          </Text>
        )}

        {/* Line items card */}
        <View style={[styles.itemsCard, Shadows.card]}>
          {(currentReceipt?.items ?? []).map((item, i) => {
            const avatars = avatarsFor(item.id);
            const isLast = i === (currentReceipt?.items?.length ?? 0) - 1;
            return (
              <View
                key={item.id}
                style={[styles.itemRow, !isLast && styles.itemRowDivider]}
              >
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {avatars.length > 0 && (
                    <View style={styles.avatarStack}>
                      {avatars.slice(0, 4).map((friend, j) => (
                        <AvatarDot
                          key={friend.id}
                          friend={friend}
                          index={j}
                          isYou={friend.id === user?.id}
                        />
                      ))}
                      {avatars.length > 4 && (
                        <View style={[styles.avatarDot, styles.avatarOverflow, { marginLeft: -6 }]}>
                          <Text style={styles.avatarOverflowLabel}>+{avatars.length - 4}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
              </View>
            );
          })}

          {/* Tax + tip rows (if present) */}
          {!!currentReceipt?.tax && (
            <View style={[styles.itemRow, styles.itemRowDivider]}>
              <Text style={styles.itemMetaLabel}>Tax</Text>
              <Text style={styles.itemPrice}>{formatCurrency(currentReceipt.tax)}</Text>
            </View>
          )}
          {!!currentReceipt?.tip && (
            <View style={styles.itemRow}>
              <Text style={styles.itemMetaLabel}>Tip</Text>
              <Text style={styles.itemPrice}>{formatCurrency(currentReceipt.tip)}</Text>
            </View>
          )}
        </View>

        {/* Your Share panel */}
        <View style={styles.sharePanel}>
          <LinearGradient
            colors={['#1A1A1A', '#2B2926']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.shareContent}>
            <View style={styles.shareTopRow}>
              <Text style={styles.shareEyebrow}>YOUR SHARE</Text>
              {tipPercent != null && (
                <Text style={styles.shareTipLabel}>+{tipPercent}% tip</Text>
              )}
            </View>
            <View style={styles.shareBottomRow}>
              <Text style={styles.shareAmount}>{formatCurrency(userShare)}</Text>
              {total > 0 && (
                <Text style={styles.shareOfTotal}>of {formatCurrency(total)}</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.footer}>
        {venmoableBreakdowns.length > 0 && (
          <AnimatedPressable
            onPress={() =>
              navigation.navigate('VenmoRequests', {
                breakdowns: venmoableBreakdowns,
                restaurantName: currentReceipt?.restaurantName ?? 'Dinner',
              })
            }
            style={[styles.ctaSecondary]}
          >
            <Ionicons name="card-outline" size={16} color={Onyx[900]} />
            <Text style={styles.ctaSecondaryLabel}>
              Request via Venmo ({venmoableBreakdowns.length})
            </Text>
          </AnimatedPressable>
        )}

        <AnimatedPressable
          onPress={() => navigation.navigate('RateMeal')}
          style={styles.ctaPrimary}
        >
          <Text style={styles.ctaPrimaryLabel}>Continue · Rate the meal</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Avatar dot (small, stack-friendly) ─────────────────────────────────────

function AvatarDot({
  friend,
  index,
  isYou,
}: {
  friend: { id: string; display_name: string; avatar_url?: string | null };
  index: number;
  isYou: boolean;
}) {
  const initials = (isYou ? 'You' : friend.display_name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const bg = ['#5E6AD2', '#B84545', '#4A8260', '#8E8B84', '#C47A2A'][index % 5];
  return (
    <View style={[styles.avatarDot, { backgroundColor: bg, marginLeft: index === 0 ? 0 : -6 }]}>
      {friend.avatar_url ? (
        <Image source={{ uri: friend.avatar_url }} style={styles.avatarImage} />
      ) : (
        <Text style={styles.avatarInitials}>{initials}</Text>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Semantic.bgCream,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // Meta
  overline: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.88, // +0.08em × 11
    color: '#8E8B84',
    marginBottom: 6,
  },
  restaurantName: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 28,
    letterSpacing: -0.28, // -0.01em × 28
    color: Onyx[900],
  },
  location: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#8E8B84',
    marginTop: 2,
  },

  // Items card
  itemsCard: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  itemRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1EEE7',
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#1A1612',
  },
  itemMetaLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Neutral[500],
    flex: 1,
  },
  itemPrice: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 15,
    color: '#1A1612',
    minWidth: 64,
    textAlign: 'right',
  },

  // Avatar stack
  avatarStack: {
    flexDirection: 'row',
    marginTop: 6,
  },
  avatarDot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: '#FFFFFF',
  },
  avatarOverflow: {
    backgroundColor: Neutral[300],
  },
  avatarOverflowLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: '#FFFFFF',
  },

  // Your Share panel
  sharePanel: {
    marginTop: 14,
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 88,
  },
  shareContent: {
    padding: 18,
  },
  shareTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  shareEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.88,
    color: Gold[400],
  },
  shareTipLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  shareBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  shareAmount: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 34,
    color: '#FFFFFF',
    letterSpacing: -0.34,
  },
  shareOfTotal: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },

  // Footer CTAs
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Neutral[200],
    backgroundColor: Semantic.bgCream,
  },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Neutral[300],
    backgroundColor: '#FFFFFF',
  },
  ctaSecondaryLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Onyx[900],
  },
  ctaPrimary: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Onyx[900],
  },
  ctaPrimaryLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
