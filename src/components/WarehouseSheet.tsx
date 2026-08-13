import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, Dimensions, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, withSpring, Easing, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import {
  warehouseCapacity,
  WAREHOUSE_UPGRADE_COSTS,
  WAREHOUSE_MAX_LEVEL,
} from '../../shared/config/warehouseUpgradeConfig';
import { CoinIcon, GemIcon } from './CurrencyIcons';
import { formatNum } from '../utils/format';
import InsufficientResourcesModal from './InsufficientResourcesModal';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH  = Dimensions.get('window').width;
const CELL_W = Math.floor((SCREEN_WIDTH - 32 - 20) / 3);
const SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.42;
const TIMING = { duration: 380, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const CLOSE_THRESHOLD = 80;
const CLOSE_VELOCITY = 500;

const TOOLS: { key: 'briks' | 'glass' | 'nails' | 'screw' | 'wood' | 'cement'; label: string; image: ReturnType<typeof require> }[] = [
  { key: 'briks',  label: 'Bricks',  image: require('../../assets/img/tools/briks.png') },
  { key: 'glass',  label: 'Glass',   image: require('../../assets/img/tools/glass.png') },
  { key: 'nails',  label: 'Nails',   image: require('../../assets/img/tools/nails.png') },
  { key: 'screw',  label: 'Screws',  image: require('../../assets/img/tools/screw.png') },
  { key: 'wood',   label: 'Wood',    image: require('../../assets/img/tools/wood.png') },
  { key: 'cement', label: 'Cement',  image: require('../../assets/img/tools/cement.png') },
];

interface WarehouseSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function WarehouseSheet({ visible, onClose }: WarehouseSheetProps) {
  const { t } = useTranslation('tabs');
  const isDark = useColorScheme() === 'dark';
  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(SCREEN_HEIGHT);

  const briks  = useGameStore((s) => s.tools?.briks  ?? 0);
  const glass  = useGameStore((s) => s.tools?.glass  ?? 0);
  const nails  = useGameStore((s) => s.tools?.nails  ?? 0);
  const screw  = useGameStore((s) => s.tools?.screw  ?? 0);
  const wood   = useGameStore((s) => s.tools?.wood   ?? 0);
  const cement = useGameStore((s) => s.tools?.cement ?? 0);
  const warehouseLevel   = useGameStore((s) => s.warehouseLevel ?? 0);
  const upgradeWarehouse = useGameStore((s) => s.upgradeWarehouse);
  const openSheet        = useGameStore((s) => s.openSheet);
  const closeSheet       = useGameStore((s) => s.closeSheet);

  const counts: Record<string, number> = { briks, glass, nails, screw, wood, cement };
  const total     = briks + glass + nails + screw + wood + cement;
  const capacity  = warehouseCapacity(warehouseLevel);
  const fillRatio = Math.min(total / capacity, 1);
  const isMaxLevel = warehouseLevel >= WAREHOUSE_MAX_LEVEL;
  const nextCost   = !isMaxLevel ? WAREHOUSE_UPGRADE_COSTS[warehouseLevel + 1] : null;

  const pillBg = fillRatio > 0.9
    ? (isDark ? '#E86060' : '#E05050')
    : fillRatio > 0.7
      ? (isDark ? '#F0B030' : '#E7A52B')
      : (isDark ? '#6BA34A' : '#5E8F42');

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, TIMING);
      scrimOpacity.value = withTiming(1, { duration: 300, easing: Easing.linear });
      openSheet();
      return closeSheet;
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, TIMING);
      scrimOpacity.value = withTiming(0, { duration: 280, easing: Easing.linear });
    }
  }, [visible]);

  const pan = Gesture.Pan()
    .enabled(visible)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        scrimOpacity.value = Math.max(0, 1 - e.translationY / SHEET_MIN_HEIGHT);
      }
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_THRESHOLD || e.velocityY > CLOSE_VELOCITY) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
        scrimOpacity.value = withTiming(0, { duration: 300 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        scrimOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, sheetStyle, isDark && { backgroundColor: '#1E2026' }]}>
            {/* Header */}
            <View style={[styles.header, isDark && { backgroundColor: '#2E333D' }]}>
              <View style={styles.handle} />
              <View style={styles.titleRow}>
                <Image
                  source={require('../../assets/img/menu/werehouse.png')}
                  style={{ width: 24, height: 24 }}
                  contentFit="contain"
                />
                <Text style={styles.title}>{t('menu.warehouseTitle')}</Text>
                <View style={[styles.capacityPill, { backgroundColor: pillBg }]}>
                  <Text style={styles.capacityPillText}>{total}/{capacity}</Text>
                </View>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
                  </Svg>
                </Pressable>
              </View>
              {!isMaxLevel && nextCost && (
                <Pressable
                  onPress={() => setShowUpgradeConfirm(true)}
                  style={({ pressed }) => [styles.upgradeChipRow, pressed && { opacity: 0.75 }]}
                >
                  <Image
                    source={require('../../assets/img/greenArrowUp.png')}
                    style={{ width: 16, height: 16 }}
                    contentFit="contain"
                  />
                  {nextCost.currency === 'coins'
                    ? <CoinIcon size={13} />
                    : <GemIcon size={13} />}
                  <Text style={styles.upgradeChipText}>{formatNum(nextCost.amount)}</Text>
                </Pressable>
              )}
            </View>

            {/* Tool grid */}
            <View style={styles.body}>
              <View style={styles.grid}>
                {TOOLS.map((tool) => (
                  <View key={tool.key} style={[styles.cell, isDark && { backgroundColor: '#2A2F38' }]}>
                    <Image source={tool.image} style={{ width: 40, height: 40 }} contentFit="contain" />
                    <Text style={[styles.cellLabel, isDark && { color: '#DDE8D8' }]}>{tool.label}</Text>
                    <View style={[styles.countBadge, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                      <Text style={[styles.countText, isDark && { color: '#A0AABC' }]}>{counts[tool.key]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        </GestureDetector>

        {/* Upgrade confirmation popup */}
        {showUpgradeConfirm && nextCost && (
          <Pressable style={[StyleSheet.absoluteFill, styles.confirmScrim]} onPress={() => setShowUpgradeConfirm(false)}>
            <Pressable style={[styles.confirmCard, isDark && { backgroundColor: 'rgba(30,32,38,0.98)' }]} onPress={() => {}}>
              <View style={styles.confirmIconWrap}>
                <Image
                  source={require('../../assets/img/menu/werehouse.png')}
                  style={{ width: 36, height: 36 }}
                  contentFit="contain"
                />
              </View>
              <Text style={[styles.confirmTitle, isDark && { color: '#DDE8D8' }]}>
                {t('warehouse.upgradeConfirmTitle')}
              </Text>
              <View style={styles.confirmCostRow}>
                {nextCost.currency === 'coins' ? <CoinIcon size={22} /> : <GemIcon size={22} />}
                <Text style={[
                  styles.confirmCostAmount,
                  { color: nextCost.currency === 'coins' ? '#E5A41C' : '#2592AB' },
                ]}>
                  {formatNum(nextCost.amount)}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowUpgradeConfirm(false);
                  upgradeWarehouse();
                }}
                style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.confirmBtnText}>{t('warehouse.upgradeConfirmOk')}</Text>
              </Pressable>
              <Pressable onPress={() => setShowUpgradeConfirm(false)} style={styles.confirmCancelBtn}>
                <Text style={[styles.confirmCancelText, isDark && { color: '#8A9A80' }]}>
                  {t('warehouse.upgradeConfirmCancel')}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}
        <InsufficientResourcesModal asOverlay />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18,26,44,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    minHeight: SCREEN_HEIGHT * 0.42,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    backgroundColor: '#EAEDF2', overflow: 'hidden',
  },
  header: {
    backgroundColor: '#5B6472',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  handle: {
    alignSelf: 'center', marginTop: 10, marginBottom: 10,
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 2, paddingBottom: 10, gap: 10 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#fff', flex: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  capacityPill: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  capacityPillText: {
    fontFamily: 'Fredoka_700Bold', fontSize: 13, color: '#fff',
  },
  body: { padding: 16, paddingBottom: 36 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    width: CELL_W, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', gap: 4,
  },
  cellLabel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2A3344' },
  countBadge: {
    backgroundColor: '#F0F2F5', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 2,
  },
  countText: { fontFamily: 'Fredoka_700Bold', fontSize: 13, color: '#5B6472' },
  upgradeChipRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 18, marginBottom: 12,
    borderRadius: 14, paddingVertical: 7,
  },
  upgradeChipText: { fontFamily: 'Fredoka_700Bold', fontSize: 13, color: '#fff' },
  confirmScrim: { backgroundColor: 'rgba(18,26,44,0.55)', alignItems: 'center', justifyContent: 'center' },
  confirmCard: {
    width: SCREEN_WIDTH * 0.82,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(91,100,114,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  confirmTitle: {
    fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#2A3344', textAlign: 'center',
  },
  confirmCostRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  confirmCostAmount: { fontFamily: 'Fredoka_700Bold', fontSize: 24 },
  confirmBtn: {
    width: '100%', backgroundColor: '#5B6472', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center', marginTop: 12,
  },
  confirmBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#fff' },
  confirmCancelBtn: {
    alignSelf: 'stretch', alignItems: 'center', paddingVertical: 10,
    borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(155,163,176,0.35)', marginTop: 2,
  },
  confirmCancelText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#5A6478' },
});
