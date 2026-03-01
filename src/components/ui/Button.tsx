import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const variants = {
  primary: {
    container: 'bg-accent rounded-xl items-center justify-center',
    text: 'text-white font-semibold',
  },
  secondary: {
    container: 'bg-transparent border border-accent rounded-xl items-center justify-center',
    text: 'text-accent font-semibold',
  },
  ghost: {
    container: 'bg-transparent rounded-xl items-center justify-center',
    text: 'text-accent font-semibold',
  },
  danger: {
    container: 'bg-error rounded-xl items-center justify-center',
    text: 'text-white font-semibold',
  },
};

const sizes = {
  sm: { container: 'px-4 py-2', text: 'text-sm' },
  md: { container: 'px-6 py-3', text: 'text-base' },
  lg: { container: 'px-8 py-4', text: 'text-lg' },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  const v = variants[variant];
  const s = sizes[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      {...props}
      disabled={isDisabled}
      className={`${v.container} ${s.container} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#007AFF'} />
      ) : (
        <Text className={`${v.text} ${s.text}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
