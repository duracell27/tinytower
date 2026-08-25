import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { formatNum } from '../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');

const COIN_ICON    = require('../../assets/img/coin.png');
const DIAMOND_ICON = require('../../assets/img/diamond.png');
const BUILDER_ICON = require('../../assets/img/workers/builder.png');

interface Props {
  visible: boolean;
  floorId: number;
  price: number;
  currency: 'coins' | 'gems';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BuyFloorConfirmModal({ visible, floorId, price, currency, onConfirm, onCancel }: Props) {
  const isDark = useColorScheme() === 'dark';
  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value   = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = 0;
      scale.value   = 0.5;
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const isGems = currency === 'gems';

  return (
    <Modal transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[s.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <Animated.View style={[s.card, cardStyle]}>
          <LinearGradient
            colors={isDark ? ['#1E2026', '#252930'] : ['#F0F4FA', '#E4EAF2']}
            style={s.cardGradient}
          >
            {/* Builder icon */}
            <View style={[s.iconWrap, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Image source={BUILDER_ICON} style={s.builderIcon} contentFit="contain" />
            </View>

            <Text style={[s.title, isDark && { color: '#DDE8D8' }]}>Build Floor {floorId}?</Text>
            <Text style={[s.subtitle, isDark && { color: '#6B7585' }]}>This will start construction</Text>

            {/* Price chip */}
            <View style={[s.priceCard, isDark && { backgroundColor: '#2A2F38' }]}>
              <Text style={[s.priceLabel, isDark && { color: '#6B7585' }]}>Cost</Text>
              <View style={s.priceRow}>
                <Image
                  source={isGems ? DIAMOND_ICON : COIN_ICON}
                  style={s.priceIcon}
                  contentFit="contain"
                />
                <Text style={[s.priceValue, isGems ? s.gemText : s.coinText]}>
                  {formatNum(price)}
                </Text>
              </View>
            </View>

            {/* Confirm */}
            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.88 }]}
              onPress={onConfirm}
            >
              <LinearGradient colors={['#74D44F', '#5BA63C']} style={s.btnGradient}>
                <Text style={s.btnText}>Build!</Text>
              </LinearGradient>
              <View style={s.btnShadow} />
            </Pressable>

            {/* Cancel */}
            <Pressable onPress={onCancel} style={s.cancelBtn} hitSlop={8}>
              <Text style={[s.cancelText, isDark && { color: '#5A6472' }]}>Cancel</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SCREEN_W * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(30,50,80,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF1F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  builderIcon: { width: 46, height: 46 },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    color: '#2A3344',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#9BA3B0',
    textAlign: 'center',
    marginTop: -4,
  },
  priceCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  priceLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#9BA3B0',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceIcon: { width: 28, height: 28 },
  priceValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 26,
  },
  coinText: { color: '#C28A22' },
  gemText:  { color: '#2592AB' },
  btn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  btnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    zIndex: 1,
  },
  btnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  btnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(20,60,0,0.3)',
  },
  cancelBtn: { paddingVertical: 4 },
  cancelText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#9BA3B0',
  },
});
