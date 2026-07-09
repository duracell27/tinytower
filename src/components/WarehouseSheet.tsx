import React, { useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const TIMING = { duration: 380, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const CLOSE_THRESHOLD = 80;
const CLOSE_VELOCITY = 600;

const TOOLS: { key: 'briks' | 'glass' | 'nails' | 'screw'; label: string; image: ReturnType<typeof require> }[] = [
  { key: 'briks',  label: 'Bricks',  image: require('../../assets/img/tools/briks.png') },
  { key: 'glass',  label: 'Glass',   image: require('../../assets/img/tools/glass.png') },
  { key: 'nails',  label: 'Nails',   image: require('../../assets/img/tools/nails.png') },
  { key: 'screw',  label: 'Screws',  image: require('../../assets/img/tools/screw.png') },
];

interface WarehouseSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function WarehouseSheet({ visible, onClose }: WarehouseSheetProps) {
  const { t } = useTranslation('tabs');
  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const dragY = useSharedValue(0);

  const briks = useGameStore((s) => s.tools?.briks ?? 0);
  const glass = useGameStore((s) => s.tools?.glass ?? 0);
  const nails = useGameStore((s) => s.tools?.nails ?? 0);
  const screw = useGameStore((s) => s.tools?.screw ?? 0);
  const counts: Record<string, number> = { briks, glass, nails, screw };

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, TIMING);
      scrimOpacity.value = withTiming(1, { duration: 300, easing: Easing.linear });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, TIMING);
      scrimOpacity.value = withTiming(0, { duration: 280, easing: Easing.linear });
    }
  }, [visible]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) dragY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_THRESHOLD || e.velocityY > CLOSE_VELOCITY) {
        dragY.value = 0;
        translateY.value = withTiming(SCREEN_HEIGHT, TIMING);
        scrimOpacity.value = withTiming(0, { duration: 280, easing: Easing.linear });
        runOnJS(onClose)();
      } else {
        dragY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <GestureDetector gesture={pan}>
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
                <Text style={styles.title}>{t('menu.warehouseTitle')}</Text>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
                  </Svg>
                </Pressable>
              </View>
            </View>

            {/* Tool grid — 4 per row */}
            <View style={styles.body}>
              <View style={styles.grid}>
                {TOOLS.map((tool) => (
                  <View key={tool.key} style={styles.cell}>
                    <Image source={tool.image} style={{ width: 40, height: 40 }} contentFit="contain" />
                    <Text style={styles.cellLabel}>{tool.label}</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{counts[tool.key]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18,26,44,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: SCREEN_HEIGHT * 0.42,
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
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  cell: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  cellLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#2A3344',
  },
  countBadge: {
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#5B6472',
  },
});
