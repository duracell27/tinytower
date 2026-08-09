import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

interface Props {
  icon: ReturnType<typeof require>;
  count: number;
  slot: number; // 0 = bottom 96, each step adds 62px
  badgeColor?: string;
  onPress: () => void;
}

export default function NotificationFAB({ icon, count, slot, badgeColor = '#3FA535', onPress }: Props) {
  if (count === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom: 96 + slot * 62 }, pressed && { opacity: 0.82 }]}
    >
      <Image source={icon} style={styles.icon} contentFit="contain" />
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  icon: { width: 28, height: 28 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
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
