import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

const DAILY_ICON = require('../../assets/img/dayliQuests.png');

interface Props {
  unclaimedCount: number;
  hasQuickAction: boolean;
}

export default function DailyTasksFAB({ unclaimedCount, hasQuickAction }: Props) {
  if (unclaimedCount === 0) return null;

  const handlePress = () => router.push('/daily-tasks');

  if (hasQuickAction) {
    return (
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>{unclaimedCount}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.82 }]}
    >
      <Image source={DAILY_ICON} style={styles.icon} contentFit="contain" />
      <View style={styles.fabBadge}>
        <Text style={styles.badgeText}>{unclaimedCount}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#3FA535',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 14,
  },
  icon: { width: 28, height: 28 },
  badge: {
    position: 'absolute',
    right: 16,
    bottom: 144,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3FA535',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
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
    borderColor: '#fff',
  },
  badgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 11,
    color: '#fff',
    lineHeight: 13,
  },
});
