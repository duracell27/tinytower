import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useGameStore } from '../stores/gameStore';
import WarehouseSheet from './WarehouseSheet';

const TOOL_IMAGES: { key: 'briks' | 'glass' | 'nails' | 'screw'; image: ReturnType<typeof require> }[] = [
  { key: 'briks', image: require('../../assets/img/tools/briks.png') },
  { key: 'glass', image: require('../../assets/img/tools/glass.png') },
  { key: 'nails', image: require('../../assets/img/tools/nails.png') },
  { key: 'screw', image: require('../../assets/img/tools/screw.png') },
];

export default function WarehouseSidebar() {
  const [open, setOpen] = useState(false);
  const briks = useGameStore((s) => s.briks);
  const glass = useGameStore((s) => s.glass);
  const nails = useGameStore((s) => s.nails);
  const screw = useGameStore((s) => s.screw);
  const counts: Record<string, number> = { briks, glass, nails, screw };

  return (
    <>
      <View style={styles.sidebar}>
        {/* Warehouse icon */}
        <Pressable onPress={() => setOpen(true)} style={styles.iconWrap} hitSlop={8}>
          <Image
            source={require('../../assets/img/werehouse.png')}
            style={{ width: 26, height: 26 }}
            contentFit="contain"
          />
        </Pressable>

        {/* Tool icons */}
        {TOOL_IMAGES.map(({ key, image }) => (
          <Pressable key={key} onPress={() => setOpen(true)} style={styles.toolWrap} hitSlop={8}>
            <Image source={image} style={{ width: 22, height: 22 }} contentFit="contain" />
            <Text style={styles.count}>{counts[key]}</Text>
          </Pressable>
        ))}
      </View>

      <WarehouseSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 40,
    flex: 1,
    alignItems: 'center',
    paddingTop: 160,
    paddingBottom: 90,
    gap: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  toolWrap: {
    alignItems: 'center',
    gap: 2,
  },
  count: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
