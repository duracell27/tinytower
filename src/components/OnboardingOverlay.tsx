// src/components/OnboardingOverlay.tsx
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions, Image, TouchableWithoutFeedback,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import { useOnboardingStore } from '../stores/onboardingStore';
import { ONBOARDING_STEPS, type BulletItem } from '../config/onboardingSteps';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_WIDTH = SW * 0.82;
const ARROW_SIZE = 48;
const CARD_RADIUS = 24;   // matches FloorCard borderRadius
const SPOTLIGHT_PAD_SIDE = 9;
const SPOTLIGHT_PAD_TOP = 41;   // card header (31) + small gap
const SPOTLIGHT_PAD_BOTTOM = 8;
const DIM_COLOR = 'rgba(0,0,0,0.55)';

const ARROW_ICON = require('../../assets/img/greenArrowUp.png');

const ARROW_ROTATION: Record<'up' | 'down' | 'left' | 'right', string> = {
  up:    '0deg',
  down:  '180deg',
  left:  '-90deg',
  right: '90deg',
};

function Arrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  return (
    <Image
      source={ARROW_ICON}
      style={[styles.arrowImg, { transform: [{ rotate: ARROW_ROTATION[dir] }] }]}
      resizeMode="contain"
    />
  );
}

export default function OnboardingOverlay() {
  const step      = useOnboardingStore((s) => s.step);
  const isActive  = useOnboardingStore((s) => s.isActive);
  const advance   = useOnboardingStore((s) => s.advance);
  const targetRect = useOnboardingStore((s) => s.targetRect);
  const arrowRect  = useOnboardingStore((s) => s.arrowRect);
  const pathname  = usePathname();

  const bounceY = useSharedValue(0);
  const spotlightOpacity = useSharedValue(0);

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

  useEffect(() => {
    if (targetRect) {
      spotlightOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
    } else {
      spotlightOpacity.value = 0;
    }
  }, [targetRect, spotlightOpacity]);

  // Advance past any step that was removed from ONBOARDING_STEPS after a redesign.
  const config = step && step !== 'done' ? ONBOARDING_STEPS[step] : undefined;
  useEffect(() => {
    if (step && step !== 'done' && !ONBOARDING_STEPS[step]) advance();
  }, [step, advance]);

  const animatedArrow = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  const animatedSpotlight = useAnimatedStyle(() => ({
    opacity: spotlightOpacity.value,
  }));

  if (!isActive || !step || step === 'done') return null;
  if (!pathname.includes('/game')) return null;
  // choose_floor_type hint is rendered inside BusinessTypePickerSheet Modal — skip overlay entirely.
  if (step === 'choose_floor_type') return null;
  if (!config) return null;

  // Use measured position if available, fallback to config fractions.
  // When neither is available (collect steps waiting for measurement), arrow is hidden.
  let px: number | undefined;
  let arrowTop: number | undefined;
  let spotlightRect: { x: number; y: number; w: number; h: number } | null = null;

  if (targetRect) {
    px = targetRect.x + targetRect.width / 2;
    const padTop = config.spotlightPadTop ?? SPOTLIGHT_PAD_TOP;
    spotlightRect = {
      x: targetRect.x - SPOTLIGHT_PAD_SIDE,
      y: targetRect.y - padTop,
      w: targetRect.width  + SPOTLIGHT_PAD_SIDE * 2,
      h: targetRect.height + padTop + SPOTLIGHT_PAD_BOTTOM,
    };
    if (config.arrowAboveSpotlight && spotlightRect) {
      arrowTop = spotlightRect.y - ARROW_SIZE - 4;
    } else if (config.arrowDir === 'down') {
      arrowTop = targetRect.y + targetRect.height - ARROW_SIZE - (config.arrowBottomOffset ?? 60);
    } else {
      arrowTop = targetRect.y + targetRect.height + 4;
    }
  } else if (config.pointer) {
    const py = config.pointer.y * SH;
    px = config.pointer.x * SW;
    arrowTop = config.arrowDir === 'up' ? py : py - ARROW_SIZE;
  }

  // arrowRect overrides arrow position independently of the spotlight rect.
  // Used when the spotlight covers a large area (e.g. whole card) but the
  // arrow should point at a specific element inside it (e.g. a button).
  if (arrowRect) {
    px = arrowRect.x + arrowRect.width / 2 + (config.arrowOffsetX ?? 0);
    arrowTop = arrowRect.y - ARROW_SIZE - 4;
  } else if (config.arrowOffsetX && px !== undefined) {
    px = px + config.arrowOffsetX;
  }

  // Hint card: below spotlight when hintBelowSpotlight, above spotlight (and above arrow when arrowAboveSpotlight) or below arrow.
  const cardTop = config.hintBelowSpotlight && spotlightRect
    ? spotlightRect.y + spotlightRect.h + 12
    : config.arrowDir === 'down'
      ? (config.arrowAboveSpotlight && arrowTop !== undefined
          ? arrowTop - 8 - 130
          : spotlightRect ? spotlightRect.y - 8 - 130 : (arrowTop ?? SH * 0.35) - 8 - 130)
      : (arrowTop ?? SH * 0.5) + ARROW_SIZE + 8;

  // Blocks swipe/scroll gestures on the overlay without passing them through.
  const noop = () => {};

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* Spotlight backdrop — SVG evenodd fill punches a rounded-rect hole */}
      {spotlightRect ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedSpotlight]}>
        <Svg
          pointerEvents="none"
          width={SW}
          height={SH}
          style={StyleSheet.absoluteFill}
        >
          <Path
            fillRule="evenodd"
            d={[
              `M0 0 H${SW} V${SH} H0 Z`,
              `M${spotlightRect.x + CARD_RADIUS} ${spotlightRect.y}`,
              `H${spotlightRect.x + spotlightRect.w - CARD_RADIUS}`,
              `Q${spotlightRect.x + spotlightRect.w} ${spotlightRect.y} ${spotlightRect.x + spotlightRect.w} ${spotlightRect.y + CARD_RADIUS}`,
              `V${spotlightRect.y + spotlightRect.h - CARD_RADIUS}`,
              `Q${spotlightRect.x + spotlightRect.w} ${spotlightRect.y + spotlightRect.h} ${spotlightRect.x + spotlightRect.w - CARD_RADIUS} ${spotlightRect.y + spotlightRect.h}`,
              `H${spotlightRect.x + CARD_RADIUS}`,
              `Q${spotlightRect.x} ${spotlightRect.y + spotlightRect.h} ${spotlightRect.x} ${spotlightRect.y + spotlightRect.h - CARD_RADIUS}`,
              `V${spotlightRect.y + CARD_RADIUS}`,
              `Q${spotlightRect.x} ${spotlightRect.y} ${spotlightRect.x + CARD_RADIUS} ${spotlightRect.y}`,
              'Z',
            ].join(' ')}
            fill={DIM_COLOR}
          />
        </Svg>
        </Animated.View>
      ) : (config.pointer || config.dismissable) ? (
        <View pointerEvents="none" style={[styles.dim, StyleSheet.absoluteFill]} />
      ) : null}

      {/* Touch-blocking rectangles around the spotlight — 4 strips that swallow all taps outside */}
      {spotlightRect && (
        <>
          {/* Top */}
          <TouchableWithoutFeedback onPress={noop}>
            <View style={{ position: 'absolute', left: 0, top: 0, width: SW, height: spotlightRect.y }} />
          </TouchableWithoutFeedback>
          {/* Bottom */}
          <TouchableWithoutFeedback onPress={noop}>
            <View style={{ position: 'absolute', left: 0, top: spotlightRect.y + spotlightRect.h, width: SW, height: Math.max(0, SH - spotlightRect.y - spotlightRect.h) }} />
          </TouchableWithoutFeedback>
          {/* Left */}
          <TouchableWithoutFeedback onPress={noop}>
            <View style={{ position: 'absolute', left: 0, top: spotlightRect.y, width: spotlightRect.x, height: spotlightRect.h }} />
          </TouchableWithoutFeedback>
          {/* Right */}
          <TouchableWithoutFeedback onPress={noop}>
            <View style={{ position: 'absolute', left: spotlightRect.x + spotlightRect.w, top: spotlightRect.y, width: Math.max(0, SW - spotlightRect.x - spotlightRect.w), height: spotlightRect.h }} />
          </TouchableWithoutFeedback>
        </>
      )}
      {/* For dismissable steps without a spotlight (e.g. construction_tip, final_message):
          block the full screen so only the hint card's OK button works. */}
      {!spotlightRect && config.dismissable && (
        <TouchableWithoutFeedback onPress={noop}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}

      {/* Animated arrow — hidden while waiting for targetRect measurement, fades in with spotlight */}
      {px !== undefined && arrowTop !== undefined && (
        <Animated.View
          pointerEvents="none"
          style={[animatedSpotlight, {
            position: 'absolute',
            left: px - ARROW_SIZE / 2,
            top: arrowTop,
          }]}
        >
          <Animated.View style={animatedArrow}>
            <Arrow dir={config.arrowDir} />
          </Animated.View>
        </Animated.View>
      )}

      {/* Hint card */}
      <View
        pointerEvents={config.dismissable ? 'auto' : 'none'}
        style={[
          styles.card,
          config.centered
            ? styles.cardCentered
            : { top: Math.max(60, Math.min(SH - 200, cardTop)), left: (SW - CARD_WIDTH) / 2 },
        ]}
      >
        <View style={styles.cardRow}>
          {config.iconSource && (
            <Image source={config.iconSource} style={styles.icon} resizeMode="contain" />
          )}
          <Text style={styles.cardText}>{config.text}</Text>
        </View>
        {config.bullets && config.bullets.map((b: BulletItem, i: number) => (
          <View key={i} style={styles.bulletRow}>
            <Image source={b.icon} style={styles.bulletIcon} resizeMode="contain" />
            <Text style={styles.bulletText}>{b.text}</Text>
          </View>
        ))}
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
  dim: {
    position: 'absolute',
    backgroundColor: DIM_COLOR,
  },
  arrowImg: {
    width: ARROW_SIZE,
    height: ARROW_SIZE,
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
  cardCentered: {
    top: SH / 2 - 180,
    left: (SW - CARD_WIDTH) / 2,
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
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  bulletIcon: {
    width: 26,
    height: 26,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
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
