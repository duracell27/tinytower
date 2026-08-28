import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { useGameStore } from '../stores/gameStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useAppTheme } from '../hooks/useAppTheme';

const { width: SCREEN_W } = Dimensions.get('window');

const DIAMOND_ICON = require('../../assets/img/diamond.png');
const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};
const TOOL_ICONS: Record<string, ReturnType<typeof require>> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};

export default function PurchaseSuccessModal() {
  const theme  = useAppTheme();
  const payload = useGameStore((s) => s.pendingPurchaseSuccess);
  const clear   = useGameStore((s) => s.clearPurchaseSuccess);
  const activeSheetCount = useGameStore((s) => s.activeSheetCount);
  const isOnboarding = useOnboardingStore((s) => s.isActive);

  const scale = useSharedValue(0.6);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const runIn = useCallback(() => {
    scale.value = 0.6;
    scale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [scale]);

  if (!payload || activeSheetCount > 0 || isOnboarding) return null;

  const { packName, price, rewards } = payload;

  // Build chip list
  type Chip = { icon: ReturnType<typeof require>; label: string };
  const chips: Chip[] = [];
  if (rewards.gems)
    chips.push({ icon: DIAMOND_ICON, label: `+${rewards.gems}` });
  if (rewards.tools)
    Object.entries(rewards.tools).forEach(([k, v]) => {
      if (v) chips.push({ icon: TOOL_ICONS[k], label: `+${v}` });
    });
  if (rewards.tokens)
    Object.entries(rewards.tokens).forEach(([k, v]) => {
      if (v) chips.push({ icon: TOKEN_ICONS[k], label: `+${v}` });
    });

  const gradientColors: [string, string] = theme.isDark
    ? ['#2D1A4E', '#1E1030']
    : ['#F5EEFF', '#E8D5FF'];

  const s = getStyles(theme);

  return (
    <Modal visible transparent animationType="none" onRequestClose={clear} onShow={runIn}>
      <View style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={clear} />
        <Animated.View style={[s.card, cardStyle]}>
          <LinearGradient colors={gradientColors} style={s.cardInner}>

            <Image source={DIAMOND_ICON} style={s.bigIcon} contentFit="contain" />
            <Text style={s.title}>Purchase Complete!</Text>
            <Text style={s.packName}>{packName}</Text>

            <View style={s.chips}>
              {chips.map((c, i) => (
                <View key={i} style={s.chip}>
                  <Image source={c.icon} style={s.chipIcon} contentFit="contain" />
                  <Text style={s.chipLabel}>{c.label}</Text>
                </View>
              ))}
            </View>

            <Pressable style={s.btn} onPress={clear}>
              <Text style={s.btnText}>Awesome!</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

function getStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    scrim:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
    card:     { width: SCREEN_W * 0.85, borderRadius: 24, overflow: 'hidden', elevation: 8 },
    cardInner:{ alignItems: 'center', padding: 24, paddingBottom: 20 },
    bigIcon:  { width: 72, height: 72, marginBottom: 12 },
    title:    { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: theme.isDark ? theme.text : '#2D1A4E', marginBottom: 4 },
    packName: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: theme.isDark ? '#B89FD8' : '#7055A0', marginBottom: 16 },
    chips:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
    chip:     { flexDirection: 'row', alignItems: 'center',
                backgroundColor: theme.isDark ? theme.surfaceElevated : 'rgba(255,255,255,0.7)',
                borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
    chipIcon: { width: 20, height: 20 },
    chipLabel:{ fontFamily: 'Fredoka_700Bold', fontSize: 15, color: theme.isDark ? theme.text : '#2D1A4E' },
    btn:      { backgroundColor: '#9A6FD0', borderRadius: 14, paddingHorizontal: 36, paddingVertical: 12 },
    btnText:  { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#FFFFFF' },
  });
}
