import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAppTheme } from '../hooks/useAppTheme';

const DAILY_ICON = require('../../assets/img/profile/dayliQuests.png');

interface Props {
  unclaimedCount: number;
  slot: number; // 0 = bottom 96, each step adds 62px
}

export default function DailyTasksFAB({ unclaimedCount, slot }: Props) {
  const theme = useAppTheme();

  if (unclaimedCount === 0) return null;

  const handlePress = () => router.push('/daily-tasks');

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom: 96 + slot * 62,
          backgroundColor: theme.surface,
          borderColor: theme.isDark ? theme.divider : 'rgba(255,255,255,0.9)',
        },
        pressed && { opacity: 0.82 },
      ]}
    >
      <Image source={DAILY_ICON} style={styles.icon} contentFit="contain" />
      <View style={[styles.fabBadge, { borderColor: theme.surface }]}>
        <Text style={styles.badgeText}>{unclaimedCount}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 96, // overridden by inline style
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  icon: { width: 28, height: 28 },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3FA535',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 11,
    color: '#fff',
    lineHeight: 13,
  },
});
