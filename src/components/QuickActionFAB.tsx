import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { QuickActionMode } from '../utils/quickAction';

interface Props {
  availableMode: QuickActionMode | null;
  activeMode: QuickActionMode | null;
  onPress: () => void;
}

const MODE_META: Record<QuickActionMode, {
  label: string;
  colors: [string, string];
  shadow: string;
  icon: ReturnType<typeof require>;
}> = {
  collect: { label: 'Монети',    colors: ['#F5C842', '#D4A017'], shadow: '#9A6E00', icon: require('../../assets/img/quicActions/collect.png') },
  list:    { label: 'Викладка',  colors: ['#F07A3A', '#C45A18'], shadow: '#8A3800', icon: require('../../assets/img/quicActions/deliver.png') },
  buy:     { label: 'Закупівля', colors: ['#4A90D9', '#2563EB'], shadow: '#1A3E9A', icon: require('../../assets/img/quicActions/buy.png') },
  hire:    { label: 'Пошук',     colors: ['#D96E8A', '#B84E6A'], shadow: '#7A2840', icon: require('../../assets/img/quicActions/findWorker.png') },
};

export default function QuickActionFAB({ availableMode, activeMode, onPress }: Props) {
  if (activeMode !== null) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
      >
        <LinearGradient colors={['#8A95A8', '#6A7585']} style={styles.closeBtnGradient}>
          <Text style={styles.closeIcon}>✕</Text>
        </LinearGradient>
        <View style={[styles.shadow, { backgroundColor: '#45505F' }]} />
      </Pressable>
    );
  }

  if (availableMode === null) return null;

  const meta = MODE_META[availableMode];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.82 }]}
    >
      <LinearGradient colors={meta.colors} style={styles.fabGradient}>
        <Image source={meta.icon} style={styles.fabIcon} contentFit="contain" />
        <Text style={styles.fabLabel}>{meta.label}</Text>
      </LinearGradient>
      <View style={[styles.shadow, { backgroundColor: meta.shadow }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    borderRadius: 22,
    overflow: 'visible',
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    zIndex: 1,
  },
  fabIcon: {
    width: 22,
    height: 22,
  },
  fabLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.4,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    borderRadius: 22,
    overflow: 'visible',
  },
  closeBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 1,
  },
  closeIcon: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#fff',
  },
  shadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
});
