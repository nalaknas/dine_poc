import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface RatingSliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function RatingSlider({
  value,
  onChange,
  label,
  min = 0,
  max = 10,
  step = 0.5,
}: RatingSliderProps) {
  const steps = Math.floor((max - min) / step) + 1;
  const values = Array.from({ length: steps }, (_, i) => min + i * step);

  const getRatingColor = (val: number) => {
    if (val >= 8) return '#10B981'; // green
    if (val >= 6) return '#F59E0B'; // amber
    if (val >= 4) return '#EF4444'; // red
    return '#9CA3AF'; // gray
  };

  const getRatingLabel = (val: number) => {
    if (val >= 9) return 'Amazing';
    if (val >= 8) return 'Excellent';
    if (val >= 7) return 'Great';
    if (val >= 6) return 'Good';
    if (val >= 5) return 'Okay';
    if (val >= 4) return 'Below Avg';
    if (val >= 2) return 'Poor';
    if (val > 0) return 'Terrible';
    return 'Not rated';
  };

  return (
    <View className="mb-4">
      {label && (
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-base font-medium text-text-primary">{label}</Text>
          <View className="flex-row items-center gap-2">
            <Text style={{ color: getRatingColor(value), fontWeight: '700', fontSize: 18 }}>
              {value > 0 ? value.toFixed(1) : '—'}
            </Text>
            {value > 0 && (
              <Text className="text-sm text-text-secondary">{getRatingLabel(value)}</Text>
            )}
          </View>
        </View>
      )}
      {/* Tap-to-rate grid for 0–10 (whole numbers only for quick tap) */}
      <View className="flex-row flex-wrap gap-1">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
          <TouchableOpacity
            key={v}
            onPress={() => onChange(v)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: value === v ? getRatingColor(v) : '#F3F4F6',
              borderWidth: value === v ? 0 : 1,
              borderColor: '#E5E7EB',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: value === v ? '#fff' : '#6B7280',
              }}
            >
              {v}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
