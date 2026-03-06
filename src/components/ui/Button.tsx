import React from 'react';
import { Text, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { AnimatedPressable, type AnimatedPressableProps } from './AnimatedPressable';

interface ButtonProps extends Omit<AnimatedPressableProps, 'children'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent-soft';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const sizeStyles = {
  sm: { px: 16, py: 8, fontSize: 13 as const },
  md: { px: 24, py: 12, fontSize: 15 as const },
  lg: { px: 32, py: 16, fontSize: 17 as const },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  onPress,
  ...props
}: ButtonProps) {
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  const handlePress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? '#FFFFFF'
      : variant === 'accent-soft'
        ? '#007AFF'
        : variant === 'secondary'
          ? '#007AFF'
          : '#007AFF';

  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <Text style={{ color: textColor, fontSize: s.fontSize, fontWeight: '600' }}>{title}</Text>
  );

  // Gradient variants
  if (variant === 'primary') {
    return (
      <AnimatedPressable
        {...props}
        disabled={isDisabled}
        onPress={handlePress}
        style={[
          { opacity: isDisabled ? 0.5 : 1, borderRadius: 14, overflow: 'hidden' },
          fullWidth ? { width: '100%' } : {},
        ]}
      >
        <LinearGradient
          colors={['#007AFF', '#5856D6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: s.px,
            paddingVertical: s.py,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  if (variant === 'danger') {
    return (
      <AnimatedPressable
        {...props}
        disabled={isDisabled}
        onPress={handlePress}
        style={[
          { opacity: isDisabled ? 0.5 : 1, borderRadius: 14, overflow: 'hidden' },
          fullWidth ? { width: '100%' } : {},
        ]}
      >
        <LinearGradient
          colors={['#EF4444', '#DC2626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: s.px,
            paddingVertical: s.py,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  // Non-gradient variants
  const bgMap: Record<string, string> = {
    secondary: 'transparent',
    ghost: 'transparent',
    'accent-soft': 'rgba(0,122,255,0.08)',
  };
  const borderMap: Record<string, string | undefined> = {
    secondary: '#007AFF',
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={isDisabled}
      onPress={handlePress}
      style={[
        {
          opacity: isDisabled ? 0.5 : 1,
          borderRadius: 14,
          paddingHorizontal: s.px,
          paddingVertical: s.py,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bgMap[variant] ?? 'transparent',
          borderWidth: borderMap[variant] ? 1 : 0,
          borderColor: borderMap[variant],
        },
        fullWidth ? { width: '100%' } : {},
      ]}
    >
      {content}
    </AnimatedPressable>
  );
}
