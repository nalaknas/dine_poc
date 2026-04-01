import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import type { LeaderboardTimePeriod } from '../../types';

const TIME_PERIODS: { value: LeaderboardTimePeriod; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

const CUISINES = ['All', 'Italian', 'Japanese', 'Mexican', 'American', 'Chinese', 'Thai', 'Indian'];

interface LeaderboardFiltersProps {
  selectedPeriod: LeaderboardTimePeriod;
  selectedCity: string | null;
  selectedCuisine: string;
  cities: string[];
  onPeriodChange: (period: LeaderboardTimePeriod) => void;
  onCityChange: (city: string | null) => void;
  onCuisineChange: (cuisine: string) => void;
}

export function LeaderboardFilters({
  selectedPeriod,
  selectedCity,
  selectedCuisine,
  cities,
  onPeriodChange,
  onCityChange,
  onCuisineChange,
}: LeaderboardFiltersProps) {
  return (
    <View style={{ gap: 10, paddingBottom: 8 }}>
      {/* Time period */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {TIME_PERIODS.map(({ value, label }) => {
          const isSelected = value === selectedPeriod;
          return (
            <Pressable
              key={value}
              onPress={() => onPeriodChange(value)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 17,
                backgroundColor: isSelected ? '#007AFF' : '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isSelected ? '#FFFFFF' : '#6B7280',
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* City */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <Pressable
          onPress={() => onCityChange(null)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 17,
            backgroundColor: selectedCity === null ? '#007AFF' : '#F3F4F6',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: selectedCity === null ? '#FFFFFF' : '#6B7280',
            }}
          >
            All Cities
          </Text>
        </Pressable>
        {cities.map((city) => {
          const isSelected = city === selectedCity;
          return (
            <Pressable
              key={city}
              onPress={() => onCityChange(city)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 17,
                backgroundColor: isSelected ? '#007AFF' : '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isSelected ? '#FFFFFF' : '#6B7280',
                }}
              >
                {city}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Cuisine */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {CUISINES.map((cuisine) => {
          const isSelected = cuisine === selectedCuisine;
          return (
            <Pressable
              key={cuisine}
              onPress={() => onCuisineChange(cuisine)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 17,
                backgroundColor: isSelected ? '#007AFF' : '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isSelected ? '#FFFFFF' : '#6B7280',
                }}
              >
                {cuisine}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
