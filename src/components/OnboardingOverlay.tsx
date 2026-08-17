// src/components/OnboardingOverlay.tsx
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions, Image,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { useOnboardingStore } from '../stores/onboardingStore';
import { ONBOARDING_STEPS } from '../config/onboardingSteps';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_WIDTH = SW * 0.82;
const ARROW_SIZE = 36;

// Arrows as SVG-free Unicode triangles styled via View borders
function Arrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const borderStyle = {
    up:    { borderBottomWidth: ARROW_SIZE, borderBottomColor: '#fff', borderLeftWidth: ARROW_SIZE / 2, borderRightWidth: ARROW_SIZE / 2, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
    down:  { borderTopWidth: ARROW_SIZE, borderTopColor: '#fff', borderLeftWidth: ARROW_SIZE / 2, borderRightWidth: ARROW_SIZE / 2, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
    left:  { borderRightWidth: ARROW_SIZE, borderRightColor: '#fff', borderTopWidth: ARROW_SIZE / 2, borderBottomWidth: ARROW_SIZE / 2, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
    right: { borderLeftWidth: ARROW_SIZE, borderLeftColor: '#fff', borderTopWidth: ARROW_SIZE / 2, borderBottomWidth: ARROW_SIZE / 2, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  }[dir];
  return <View style={[styles.arrow, borderStyle]} />;
}

export default function OnboardingOverlay() {
  const step = useOnboardingStore((s) => s.step);
  const isActive = useOnboardingStore((s) => s.isActive);
  const advance = useOnboardingStore((s) => s.advance);

  const bounceY = useSharedValue(0);

  useEffect(() => {
    bounceY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 400, easing: Easing.out(Easing.quad) }),
        withTiming(0,   { duration: 400, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [bounceY]);

  if (!isActive || !step || step === 'done') return null;

  const config = ONBOARDING_STEPS[step];
  const px = config.pointer.x * SW;
  const py = config.pointer.y * SH;

  // Place card above pointer for 'down' arrow, below for 'up'
  const cardTop = config.arrowDir === 'up'
    ? py + ARROW_SIZE + 8
    : py - ARROW_SIZE - 8 - 130; // 130 ≈ card height estimate

  const arrowTop = config.arrowDir === 'up' ? py : py - ARROW_SIZE;

  const animatedArrow = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dark backdrop */}
      <View style={styles.backdrop} pointerEvents="none" />

      {/* Animated arrow */}
      <Animated.View
        pointerEvents="none"
        style={[animatedArrow, {
          position: 'absolute',
          left: px - ARROW_SIZE / 2,
          top: arrowTop,
        }]}
      >
        <Arrow dir={config.arrowDir} />
      </Animated.View>

      {/* Hint card */}
      <View
        pointerEvents={config.dismissable ? 'auto' : 'none'}
        style={[styles.card, { top: Math.max(60, Math.min(SH - 200, cardTop)), left: (SW - CARD_WIDTH) / 2 }]}
      >
        <View style={styles.cardRow}>
          {config.iconSource && (
            <Image source={config.iconSource} style={styles.icon} resizeMode="contain" />
          )}
          <Text style={styles.cardText}>{config.text}</Text>
        </View>
        {config.dismissable && (
          <Pressable style={styles.dismissBtn} onPress={advance}>
            <Text style={styles.dismissLabel}>{config.dismissLabel ?? 'OK'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 28,
    height: 28,
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  dismissBtn: {
    marginTop: 14,
    backgroundColor: '#3FA535',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
});
