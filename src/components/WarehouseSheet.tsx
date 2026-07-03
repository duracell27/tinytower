import React, { useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useGameStore } from '../stores/gameStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const TIMING = { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) };

const TOOLS: { key: 'briks' | 'glass' | 'nails' | 'screw'; label: string; image: ReturnType<typeof require> }[] = [
  { key: 'briks',  label: 'Цегла',   image: require('../../assets/img/tools/briks.png') },
  { key: 'glass',  label: 'Скло',    image: require('../../assets/img/tools/glass.png') },
  { key: 'nails',  label: 'Цвяхи',   image: require('../../assets/img/tools/nails.png') },
  { key: 'screw',  label: 'Шурупи',  image: require('../../assets/img/tools/screw.png') },
];

interface WarehouseSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function WarehouseSheet({ visible, onClose }: WarehouseSheetProps) {
  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(100);
  const briks = useGameStore((s) => s.briks);
  const glass = useGameStore((s) => s.glass);
  const nails = useGameStore((s) => s.nails);
  const screw = useGameStore((s) => s.screw);

  const counts: Record<string, number> = { briks, glass, nails, screw };

  useEffect(() => {
    if (visible) {
      scrimOpacity.value = withTiming(1, { duration: 300, easing: Easing.linear });
      translateY.value = withTiming(0, TIMING);
    } else {
      scrimOpacity.value = withTiming(0, { duration: 280, easing: Easing.linear });
      translateY.value = withTiming(100, TIMING);
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (translateY.value / 100) * SCREEN_HEIGHT }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              <Image
                source={require('../../assets/img/werehouse.png')}
                style={{ width: 28, height: 28 }}
                contentFit="contain"
              />
              <Text style={styles.title}>Склад</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
          </View>

          {/* Tool list */}
          <View style={styles.body}>
            {TOOLS.map((tool) => (
              <View key={tool.key} style={styles.row}>
                <Image source={tool.image} style={{ width: 36, height: 36 }} contentFit="contain" />
                <Text style={styles.toolLabel}>{tool.label}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{counts[tool.key]}</Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,26,44,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#EAEDF2',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#5B6472',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 16,
  },
  handle: {
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 10,
  },
  title: {
    flex: 1,
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#fff',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: {
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    gap: 14,
  },
  toolLabel: {
    flex: 1,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#2A3344',
  },
  countBadge: {
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#5B6472',
  },
});
