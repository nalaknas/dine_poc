import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Share,
} from 'react-native';
import { TierBadge } from './TierBadge';
import type { UserTier } from '../../types';
import { TierThresholds } from '../../types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface TierUpCelebrationProps {
  visible: boolean;
  newTier: UserTier;
  onDismiss: () => void;
}

// ─── Tier metadata ──────────────────────────────────────────────────────────

const TIER_LABELS: Record<UserTier, string> = {
  rock: 'Rock',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  black: 'Black',
};

const TIER_ORDER: UserTier[] = ['rock', 'bronze', 'silver', 'gold', 'platinum', 'black'];

const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#F59E0B', '#8B5CF6', '#EC4899'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COUNT = 30;

// ─── Confetti piece ─────────────────────────────────────────────────────────

interface ConfettiPiece {
  translateY: Animated.Value;
  translateX: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  startX: number;
  isSquare: boolean;
}

function useConfetti(visible: boolean): ConfettiPiece[] {
  const pieces = useRef<ConfettiPiece[]>([]);

  if (pieces.current.length === 0) {
    pieces.current = Array.from({ length: CONFETTI_COUNT }, () => ({
      translateY: new Animated.Value(-60),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 6,
      startX: Math.random() * SCREEN_WIDTH,
      isSquare: Math.random() > 0.5,
    }));
  }

  useEffect(() => {
    if (!visible) {
      // Reset positions
      pieces.current.forEach((p) => {
        p.translateY.setValue(-60);
        p.translateX.setValue(0);
        p.rotate.setValue(0);
        p.opacity.setValue(1);
      });
      return;
    }

    const animations = pieces.current.map((piece, i) => {
      const delay = i * 40 + Math.random() * 200;
      const duration = 2200 + Math.random() * 1200;
      const drift = (Math.random() - 0.5) * 120;

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(piece.translateY, {
            toValue: SCREEN_HEIGHT + 40,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(piece.translateX, {
            toValue: drift,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(piece.rotate, {
            toValue: 3 + Math.random() * 5,
            duration,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(duration * 0.7),
            Animated.timing(piece.opacity, {
              toValue: 0,
              duration: duration * 0.3,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]);
    });

    const compositeAnim = Animated.parallel(animations);
    compositeAnim.start();

    return () => {
      compositeAnim.stop();
    };
  }, [visible]);

  return pieces.current;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TierUpCelebration({ visible, newTier, onDismiss }: TierUpCelebrationProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.3)).current;
  const confetti = useConfetti(visible);

  const nextTierInfo = useMemo(() => {
    const currentIndex = TIER_ORDER.indexOf(newTier);
    if (currentIndex === TIER_ORDER.length - 1) {
      return null; // highest tier
    }
    const next = TIER_ORDER[currentIndex + 1];
    return {
      tier: next,
      label: TIER_LABELS[next],
      credits: TierThresholds[next],
    };
  }, [newTier]);

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      badgeScale.setValue(0.3);

      const cardAnim = Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]);
      cardAnim.start(() => {
        // Bounce the badge after card appears
        Animated.spring(badgeScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }).start();
      });

      return () => {
        cardAnim.stop();
      };
    }
  }, [visible, scaleAnim, opacityAnim, badgeScale]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just reached ${TIER_LABELS[newTier]} tier on Dine! 🎉`,
      });
    } catch {
      // User cancelled or share failed — no action needed
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: opacityAnim,
        }}
      >
        {/* Confetti layer */}
        {confetti.map((piece, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -20,
              left: piece.startX,
              width: piece.size,
              height: piece.isSquare ? piece.size : piece.size * 1.6,
              borderRadius: piece.isSquare ? 1 : piece.size / 2,
              backgroundColor: piece.color,
              opacity: piece.opacity,
              transform: [
                { translateY: piece.translateY },
                { translateX: piece.translateX },
                {
                  rotate: piece.rotate.interpolate({
                    inputRange: [0, 8],
                    outputRange: ['0deg', '2880deg'],
                  }),
                },
              ],
            }}
          />
        ))}

        {/* Card */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
            width: SCREEN_WIDTH - 48,
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            paddingVertical: 36,
            paddingHorizontal: 24,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 20,
          }}
        >
          {/* Heading */}
          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: '#1F2937',
              letterSpacing: -0.5,
              marginBottom: 20,
            }}
          >
            Level Up!
          </Text>

          {/* Animated badge */}
          <Animated.View
            style={{
              transform: [{ scale: badgeScale }],
              marginBottom: 16,
            }}
          >
            <TierBadge tier={newTier} variant="profile" />
          </Animated.View>

          {/* Congrats message */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#374151',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            {`You've reached ${TIER_LABELS[newTier]} tier!`}
          </Text>

          {/* Next tier info */}
          <Text
            style={{
              fontSize: 14,
              color: '#6B7280',
              textAlign: 'center',
              marginBottom: 28,
              lineHeight: 20,
            }}
          >
            {nextTierInfo
              ? `${nextTierInfo.credits.toLocaleString()} credits to reach ${nextTierInfo.label}`
              : "You've reached the highest tier!"}
          </Text>

          {/* Share button */}
          <TouchableOpacity
            onPress={handleShare}
            style={{
              width: '100%',
              backgroundColor: '#007AFF',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 10,
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
              Share
            </Text>
          </TouchableOpacity>

          {/* Continue button */}
          <TouchableOpacity
            onPress={onDismiss}
            style={{
              width: '100%',
              backgroundColor: '#F3F4F6',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
              Continue
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
