import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { QuickActionMode } from '../utils/quickAction';

interface Props {
  availableMode: QuickActionMode | null;
  activeMode: QuickActionMode | null;
  onPress: () => void;
}

const MODE_META: Record<QuickActionMode, {
  icon: ReturnType<typeof require>;
  glow: string;
}> = {
  collect: { icon: require('../../assets/img/quicActions/collect.png'), glow: '#F5C842' },
  list:    { icon: require('../../assets/img/quicActions/deliver.png'), glow: '#F07A3A' },
  buy:     { icon: require('../../assets/img/quicActions/buy.png'),     glow: '#4A90D9' },
  hire:    { icon: require('../../assets/img/quicActions/findWorker.png'), glow: '#D96E8A' },
};

export default function QuickActionFAB({ availableMode, activeMode, onPress }: Props) {
  if (activeMode !== null) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.btn,
          {
            shadowColor: '#8A95A8',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: pressed ? 0.4 : 0.7,
            shadowRadius: 12,
            elevation: 10,
          },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Text style={styles.closeIcon}>✕</Text>
      </Pressable>
    );
  }

  if (availableMode === null) return null;

  const meta = MODE_META[availableMode];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          shadowColor: meta.glow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: pressed ? 0.5 : 0.95,
          shadowRadius: 16,
          elevation: 14,
        },
        pressed && { opacity: 0.82 },
      ]}
    >
      <Image source={meta.icon} style={styles.icon} contentFit="contain" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
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
  },
  icon: {
    width: 28,
    height: 28,
  },
  closeIcon: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#6A7585',
  },
});
