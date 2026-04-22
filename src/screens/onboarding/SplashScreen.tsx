import React, { useEffect } from 'react';
import { StyleSheet, Dimensions, AccessibilityInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Palette (from dine design system) ───
const ONYX = '#0A0A0A';
const CREAM = '#F5F1EA';
const YELLOW = '#F7B52E';

// ─── Choreography timings (ms) ───
const TOTAL = 2400;
const LETTER_START = 300;
const LETTER_STAGGER = 60;
const LETTER_DURATION = 420;
const CONST_DOT_DELAY = 900;
const CONST_DOT_STAGGER = 70;
const CONST_DOT_DURATION = 260;
const CONST_LINE_DELAY = 1050;
const CONST_LINE_STAGGER = 60;
const CONST_LINE_DURATION = 240;
const CONST_FADE_OUT_START = 1400;
const CONST_FADE_OUT_DURATION = 300;
const WARM_UP_START = 1300;
const WARM_UP_DURATION = 400;
const TRAVEL_START = 1700;
const TRAVEL_DURATION = 400;
const HAPTIC_LETTER = 300;
const HAPTIC_CONSTELLATION = 900;
const HAPTIC_DOCK = 2080;
const HAPTIC_READY = 2350;

// ─── Layout ───
const { width: SW, height: SH } = Dimensions.get('window');
const CX = SW / 2;
const CY = SH / 2;

// Wordmark travel target — approximates a feed-header dock position.
// Real pixel-perfect docking is a follow-up (requires Auth + Feed header redesign).
const DOCK_X = 80;
const DOCK_Y = 80;
const TRAVEL_TX = DOCK_X - CX;
const TRAVEL_TY = DOCK_Y - CY;
const TRAVEL_SCALE_END = 0.55;

// Constellation points orbiting the wordmark
const POINTS = [
  { x: CX - 96, y: CY - 54 },
  { x: CX + 90, y: CY - 44 },
  { x: CX - 70, y: CY + 62 },
  { x: CX + 82, y: CY + 70 },
];
const LINE_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 3],
  [3, 2],
  [2, 0],
];
const LINES = LINE_PAIRS.map(([a, b]) => {
  const A = POINTS[a];
  const B = POINTS[b];
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  return {
    midX: (A.x + B.x) / 2,
    midY: (A.y + B.y) / 2,
    length: Math.sqrt(dx * dx + dy * dy),
    angle: Math.atan2(dy, dx),
  };
});

export function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const t = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const run = async () => {
      let reduceMotion = false;
      try {
        reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      } catch {
        // default to full motion
      }
      if (cancelled) return;

      const duration = reduceMotion ? 800 : TOTAL;
      t.value = withTiming(duration, { duration, easing: Easing.linear });

      if (!reduceMotion) {
        const safeFire = (fn: () => Promise<unknown>) => () => {
          fn().catch(() => {
            /* haptics aren't available on simulator — swallow */
          });
        };
        timers.push(setTimeout(safeFire(() => Haptics.selectionAsync()), HAPTIC_LETTER));
        timers.push(
          setTimeout(
            safeFire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
            HAPTIC_CONSTELLATION,
          ),
        );
        timers.push(
          setTimeout(
            safeFire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
            HAPTIC_DOCK,
          ),
        );
        timers.push(setTimeout(safeFire(() => Haptics.selectionAsync()), HAPTIC_READY));
      }

      timers.push(
        setTimeout(() => {
          if (!cancelled) navigation.replace('Auth');
        }, duration),
      );
    };

    run();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [navigation, t]);

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      t.value,
      [0, WARM_UP_START, WARM_UP_START + WARM_UP_DURATION, TOTAL],
      [ONYX, ONYX, CREAM, CREAM],
    ),
  }));

  const wordmarkStyle = useAnimatedStyle(() => {
    const travelT = Math.max(0, Math.min(1, (t.value - TRAVEL_START) / TRAVEL_DURATION));
    // easeInOutCubic
    const eased =
      travelT < 0.5
        ? 4 * travelT * travelT * travelT
        : 1 - Math.pow(-2 * travelT + 2, 3) / 2;
    return {
      transform: [
        { translateX: eased * TRAVEL_TX },
        { translateY: eased * TRAVEL_TY },
        { scale: 1 - eased * (1 - TRAVEL_SCALE_END) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.root, bgStyle]}>
      {POINTS.map((pt, i) => (
        <Dot key={`d${i}`} t={t} pt={pt} index={i} />
      ))}
      {LINES.map((ln, i) => (
        <ConstLine key={`l${i}`} t={t} line={ln} index={i} />
      ))}

      <Animated.View style={[styles.wordmark, wordmarkStyle]}>
        {['d', 'i', 'n', 'e'].map((char, i) => (
          <Letter key={`${char}${i}`} char={char} index={i} t={t} />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

// ─── Individual letter ───
function Letter({
  char,
  index,
  t,
}: {
  char: string;
  index: number;
  t: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const localT = Math.max(
      0,
      Math.min(1, (t.value - LETTER_START - index * LETTER_STAGGER) / LETTER_DURATION),
    );
    const eased = 1 - Math.pow(1 - localT, 3); // easeOutCubic
    const color = interpolateColor(
      t.value,
      [0, WARM_UP_START, WARM_UP_START + WARM_UP_DURATION, TOTAL],
      [YELLOW, YELLOW, ONYX, ONYX],
    );
    return {
      opacity: eased,
      transform: [{ translateY: (1 - eased) * 18 }],
      color,
    };
  });
  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

// ─── Constellation dot ───
function Dot({
  t,
  pt,
  index,
}: {
  t: SharedValue<number>;
  pt: { x: number; y: number };
  index: number;
}) {
  const style = useAnimatedStyle(() => {
    const inT = Math.max(
      0,
      Math.min(1, (t.value - (CONST_DOT_DELAY + index * CONST_DOT_STAGGER)) / CONST_DOT_DURATION),
    );
    const outT = Math.max(
      0,
      Math.min(1, (t.value - CONST_FADE_OUT_START) / CONST_FADE_OUT_DURATION),
    );
    const eased = (1 - Math.pow(1 - inT, 3)) * (1 - outT);
    const color = interpolateColor(
      t.value,
      [0, WARM_UP_START, WARM_UP_START + WARM_UP_DURATION, TOTAL],
      [YELLOW, YELLOW, ONYX, ONYX],
    );
    return {
      opacity: Math.max(0, eased),
      backgroundColor: color,
    };
  });
  return (
    <Animated.View
      style={[
        styles.dot,
        { left: pt.x - 3, top: pt.y - 3 },
        style,
      ]}
    />
  );
}

// ─── Constellation line ───
function ConstLine({
  t,
  line,
  index,
}: {
  t: SharedValue<number>;
  line: { midX: number; midY: number; length: number; angle: number };
  index: number;
}) {
  const style = useAnimatedStyle(() => {
    const inT = Math.max(
      0,
      Math.min(
        1,
        (t.value - (CONST_LINE_DELAY + index * CONST_LINE_STAGGER)) / CONST_LINE_DURATION,
      ),
    );
    const outT = Math.max(
      0,
      Math.min(1, (t.value - CONST_FADE_OUT_START) / CONST_FADE_OUT_DURATION),
    );
    // Lines stay soft — ~50% opacity at peak
    const eased = (1 - Math.pow(1 - inT, 3)) * (1 - outT) * 0.5;
    const color = interpolateColor(
      t.value,
      [0, WARM_UP_START, WARM_UP_START + WARM_UP_DURATION, TOTAL],
      [YELLOW, YELLOW, ONYX, ONYX],
    );
    return {
      opacity: Math.max(0, eased),
      backgroundColor: color,
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: line.midX - line.length / 2,
          top: line.midY - 0.5,
          width: line.length,
          height: 1,
          transform: [{ rotate: `${line.angle}rad` }],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  letter: {
    fontFamily: 'System',
    fontSize: 76,
    fontWeight: '800',
    letterSpacing: -4,
    lineHeight: 76,
    color: YELLOW,
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
