import React, { useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, Dimensions, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, Easing, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppTheme } from '../hooks/useAppTheme';
import { useGameStore } from '../stores/gameStore';
import { BOOST_PACKAGES, BoostPackage } from '../../shared/config/boostConfig';
import { GemIcon } from './CurrencyIcons';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH  = Dimensions.get('window').width;
const TIMING = { duration: 360, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const CLOSE_THRESHOLD = 80;
const CLOSE_VELOCITY  = 500;

const DIAMOND        = require('../../assets/img/diamond.png');
const MARKETING_ICON = require('../../assets/img/MarketingIcon.png');
const PR_ICON        = require('../../assets/img/PRIcon.png');

const CARD_GAP = 10;
const CARD_W   = (SCREEN_WIDTH - 32 - CARD_GAP) / 2;

interface Props {
  visible: boolean;
  onClose: () => void;
}

function boostTimeLabel(expiresAt: number, now: number): string | null {
  const ms = expiresAt - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

function BoostCard({ pkg, gems, now, onBuy, onNotEnough }: {
  pkg: BoostPackage;
  gems: number;
  now: number;
  onBuy: () => void;
  onNotEnough: () => void;
}) {
  const theme   = useAppTheme();
  const isCoin  = pkg.boostType === 'coin';
  const accent  = isCoin ? '#F5A623' : (theme.isDark ? '#C08AF0' : '#7B4FBF');
  const accentBg = isCoin ? 'rgba(245,166,35,0.12)' : (theme.isDark ? 'rgba(192,138,240,0.12)' : 'rgba(123,79,191,0.12)');

  return (
    <Pressable
      onPress={gems >= pkg.gemCost ? onBuy : onNotEnough}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, width: CARD_W },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={[styles.cardIconBg, { backgroundColor: accentBg }]}>
        <Image source={isCoin ? MARKETING_ICON : PR_ICON} style={styles.cardIcon} contentFit="contain" />
      </View>
      <Text style={[styles.cardPercent, { color: accent }]}>+{pkg.percent}%</Text>
      <Text style={[styles.cardDuration, { color: theme.textMuted }]}>30 hrs</Text>
      <View style={[styles.cardPrice, { backgroundColor: accentBg }]}>
        <Image source={DIAMOND} style={styles.diamond} contentFit="contain" />
        <Text style={[styles.cardPriceText, { color: theme.text }]}>{pkg.gemCost}</Text>
      </View>
    </Pressable>
  );
}

function SectionRow({ label, percent, expiresAt, now, isCoin }: {
  label: string; percent: number; expiresAt: number; now: number; isCoin: boolean;
}) {
  const theme    = useAppTheme();
  const timeLeft = boostTimeLabel(expiresAt, now);
  const accent   = isCoin ? '#F5A623' : (theme.isDark ? '#C08AF0' : '#7B4FBF');
  const bg       = isCoin ? 'rgba(245,166,35,0.12)' : (theme.isDark ? 'rgba(192,138,240,0.12)' : 'rgba(123,79,191,0.12)');

  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionLabel, { color: theme.text }]}>{label}</Text>
      {timeLeft && (
        <View style={[styles.activeBadge, { backgroundColor: bg }]}>
          <Image source={isCoin ? MARKETING_ICON : PR_ICON} style={styles.activeBadgeIcon} contentFit="contain" />
          <Text style={[styles.activeBadgeText, { color: accent }]}>
            +{percent}% · {timeLeft}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function BoostSheet({ visible, onClose }: Props) {
  const theme = useAppTheme();
  const [mounted, setMounted] = useState(false);
  const translateY   = useSharedValue(SCREEN_HEIGHT);
  const scrimOpacity = useSharedValue(0);
  const startY       = useSharedValue(0);

  const gems                   = useGameStore((s) => s.gems);
  const buyBoost               = useGameStore((s) => s.buyBoost);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
  const coinBoostPercent   = useGameStore((s) => s.coinBoostPercent);
  const xpBoostPercent     = useGameStore((s) => s.xpBoostPercent);
  const coinBoostExpiresAt = useGameStore((s) => s.coinBoostExpiresAt);
  const xpBoostExpiresAt   = useGameStore((s) => s.xpBoostExpiresAt);

  const [pendingBoost, setPendingBoost] = useState<BoostPackage | null>(null);
  const now = Date.now();

  const open = () => {
    setMounted(true);
    translateY.value   = SCREEN_HEIGHT;
    scrimOpacity.value = 0;
    setTimeout(() => {
      translateY.value   = withTiming(0, TIMING);
      scrimOpacity.value = withTiming(1, TIMING);
    }, 10);
  };

  const close = (cb?: () => void) => {
    translateY.value   = withTiming(SCREEN_HEIGHT, TIMING, (done) => { if (done && cb) runOnJS(cb)(); });
    scrimOpacity.value = withTiming(0, TIMING);
  };

  const handleClose = () => close(() => { setMounted(false); onClose(); });

  React.useEffect(() => {
    if (visible) open();
    else if (mounted) close(() => setMounted(false));
  }, [visible]);

  const pan = Gesture.Pan()
    .onStart(() => { startY.value = translateY.value; })
    .onUpdate((e) => { translateY.value = Math.max(0, startY.value + e.translationY); })
    .onEnd((e) => {
      if (translateY.value > CLOSE_THRESHOLD || e.velocityY > CLOSE_VELOCITY) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withTiming(0, TIMING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  const confirmBoost = () => {
    if (pendingBoost) { buyBoost(pendingBoost); setPendingBoost(null); }
  };

  if (!mounted) return null;

  const coinPackages = BOOST_PACKAGES.filter((p) => p.boostType === 'coin');
  const xpPackages   = BOOST_PACKAGES.filter((p) => p.boostType === 'xp');

  return (
    <Modal transparent visible={mounted} onRequestClose={handleClose} statusBarTranslucent>
      {visible && (
        <GestureHandlerRootView style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>

          <Animated.View style={[styles.sheet, { backgroundColor: theme.surfaceCard }, sheetStyle]}>
            {/* Handle — swipe to close */}
            <GestureDetector gesture={pan}>
              <View style={styles.handleArea}>
                <View style={[styles.handle, { backgroundColor: theme.surfaceSub }]} />
              </View>
            </GestureDetector>

            {/* Header */}
            <View style={styles.header}>
              <Image source={MARKETING_ICON} style={styles.headerIcon} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Boosts</Text>
              </View>
              <View style={styles.headerGems}>
                <GemIcon size={14} />
                <Text style={[styles.headerGemsText, { color: theme.textMuted }]}>{gems} gems</Text>
              </View>
            </View>

            {/* Scrollable content */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <SectionRow
                label="💰 Coin Boost"
                percent={coinBoostPercent}
                expiresAt={coinBoostExpiresAt}
                now={now}
                isCoin
              />
              <View style={styles.grid}>
                {coinPackages.map((pkg) => (
                  <BoostCard
                    key={pkg.id} pkg={pkg} gems={gems} now={now}
                    onBuy={() => setPendingBoost(pkg)}
                    onNotEnough={() => showInsufficientResources({ currency: 'gems', need: pkg.gemCost, have: gems })}
                  />
                ))}
              </View>

              <SectionRow
                label="⭐ XP Boost"
                percent={xpBoostPercent}
                expiresAt={xpBoostExpiresAt}
                now={now}
                isCoin={false}
              />
              <View style={styles.grid}>
                {xpPackages.map((pkg) => (
                  <BoostCard
                    key={pkg.id} pkg={pkg} gems={gems} now={now}
                    onBuy={() => setPendingBoost(pkg)}
                    onNotEnough={() => showInsufficientResources({ currency: 'gems', need: pkg.gemCost, have: gems })}
                  />
                ))}
              </View>
            </ScrollView>
          </Animated.View>

          {/* Confirm modal */}
          {pendingBoost && (
            <View style={styles.confirmScrim}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setPendingBoost(null)} />
              <View style={[styles.confirmCard, { backgroundColor: theme.surface }]}>
                <View style={[styles.confirmIconCircle, {
                  backgroundColor: pendingBoost.boostType === 'coin'
                    ? 'rgba(245,166,35,0.15)' : 'rgba(123,79,191,0.15)',
                }]}>
                  <Image
                    source={pendingBoost.boostType === 'coin' ? MARKETING_ICON : PR_ICON}
                    style={styles.confirmIcon}
                    contentFit="contain"
                  />
                </View>
                <Text style={[styles.confirmTitle, { color: theme.text }]}>
                  {pendingBoost.boostType === 'coin' ? 'Coin Boost' : 'XP Boost'} +{pendingBoost.percent}%
                </Text>
                <Text style={[styles.confirmSub, { color: theme.textMuted }]}>30 hours · active immediately</Text>
                <View style={[styles.confirmPriceRow, { backgroundColor: theme.surfaceElevated }]}>
                  <Image source={DIAMOND} style={{ width: 20, height: 20 }} contentFit="contain" />
                  <Text style={[styles.confirmPrice, { color: theme.text }]}>{pendingBoost.gemCost}</Text>
                  <Text style={[styles.confirmBalance, { color: theme.textMuted }]}>· you have {gems}</Text>
                </View>
                <Pressable
                  style={[styles.confirmBtn, {
                    backgroundColor: pendingBoost.boostType === 'coin' ? '#F5A623' : '#7B4FBF',
                  }]}
                  onPress={confirmBoost}
                >
                  <Text style={styles.confirmBtnText}>Activate Boost</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setPendingBoost(null)}>
                  <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </GestureHandlerRootView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    maxHeight: SCREEN_HEIGHT * 0.88,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  handle:     { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  headerIcon:      { width: 36, height: 36 },
  headerTitle:     { fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  headerGems:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerGemsText:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 13 },
  scrollContent:   { paddingHorizontal: 16, paddingBottom: 48, gap: 10 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 8,
  },
  sectionLabel:    { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  activeBadgeIcon: { width: 14, height: 14 },
  activeBadgeText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 12 },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  card: {
    borderRadius: 16, padding: 14, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardIconBg:    { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  cardIcon:      { width: 32, height: 32 },
  cardPercent:   { fontFamily: 'Fredoka_700Bold', fontSize: 22 },
  cardDuration:  { fontFamily: 'Fredoka_400Regular', fontSize: 12 },
  cardPrice:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  diamond:       { width: 14, height: 14 },
  cardPriceText: { fontFamily: 'Fredoka_700Bold', fontSize: 17 },
  confirmScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  confirmCard:       { width: 300, borderRadius: 24, padding: 24, alignItems: 'center', gap: 12,
                       shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 12 },
  confirmIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  confirmIcon:       { width: 44, height: 44 },
  confirmTitle:      { fontFamily: 'Fredoka_700Bold', fontSize: 22, textAlign: 'center' },
  confirmSub:        { fontFamily: 'Fredoka_400Regular', fontSize: 13, textAlign: 'center', marginTop: -4 },
  confirmPriceRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12,
                       paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'stretch', justifyContent: 'center' },
  confirmPrice:      { fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  confirmBalance:    { fontFamily: 'Fredoka_400Regular', fontSize: 13 },
  confirmBtn:        { borderRadius: 14, paddingVertical: 13, alignSelf: 'stretch', alignItems: 'center', marginTop: 4 },
  confirmBtnText:    { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#FFF' },
  cancelBtn:         { paddingVertical: 6 },
  cancelBtnText:     { fontFamily: 'Fredoka_500Medium', fontSize: 14 },
});
