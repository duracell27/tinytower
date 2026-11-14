// src/components/OnboardingOverlay.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions, Image, TouchableWithoutFeedback,
  Platform, StatusBar,
} from 'react-native';
import LocaleText from './LocaleText';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../hooks/useAppTheme';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
import { usePathname } from 'expo-router';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useGameStore } from '../stores/gameStore';
import { ONBOARDING_STEPS, type BulletItem } from '../config/onboardingSteps';
import { getOnboardingDismissAction, getOnboardingSpotlightAction } from '../utils/onboardingCallback';
const CHECKLIST_ICON = require('../../assets/img/quicActions/checklist.png');

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_WIDTH = SW * 0.82;
const MANAGER_IMG_SIZE = 215;
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
  const { t } = useTranslation('hotel');
  const theme = useAppTheme();
  const { isDark } = theme;
  const cardBg      = theme.surface;
  const textMain    = isDark ? '#E8EDE4' : '#1a1a1a';
  const textSub     = isDark ? '#B0BEC5' : '#333';
  const dividerCol  = theme.divider;

  const step       = useOnboardingStore((s) => s.step);
  const isActive   = useOnboardingStore((s) => s.isActive);
  const advance    = useOnboardingStore((s) => s.advance);
  const complete   = useOnboardingStore((s) => s.complete);
  const targetRect = useOnboardingStore((s) => s.targetRect);
  const arrowRect  = useOnboardingStore((s) => s.arrowRect);
  const pathname   = usePathname();

  const bounceY = useSharedValue(0);
  const spotlightOpacity = useSharedValue(0);

  // Animated spotlight rect (morph between steps)
  const spotX = useSharedValue(SW / 2);
  const spotY = useSharedValue(SH / 2);
  const spotW = useSharedValue(0);
  const spotH = useSharedValue(0);
  const hasShownSpotlight = useRef(false);

  // Hint card + manager image slide-in
  const cardSlideY = useSharedValue(60);
  const cardSlideOpacity = useSharedValue(0);

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

  // Spotlight morph: animate rect to new position when targetRect changes
  useEffect(() => {
    if (targetRect) {
      const padTop = step && step !== 'done' ? (ONBOARDING_STEPS[step]?.spotlightPadTop ?? SPOTLIGHT_PAD_TOP) : SPOTLIGHT_PAD_TOP;
      const androidOff = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
      const ty = targetRect.y + androidOff;
      const newX = targetRect.x - SPOTLIGHT_PAD_SIDE;
      const newY = ty - padTop;
      const newW = targetRect.width  + SPOTLIGHT_PAD_SIDE * 2;
      const newH = targetRect.height + padTop + SPOTLIGHT_PAD_BOTTOM;
      const morph = { duration: 320, easing: Easing.out(Easing.cubic) };
      spotX.value = withTiming(newX, morph);
      spotY.value = withTiming(newY, morph);
      spotW.value = withTiming(newW, morph);
      spotH.value = withTiming(newH, morph);
      if (!hasShownSpotlight.current) {
        hasShownSpotlight.current = true;
        spotlightOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
      }
    } else {
      const cfg = step && step !== 'done' ? ONBOARDING_STEPS[step] : undefined;
      if (cfg?.pointer) {
        spotlightOpacity.value = withTiming(0, { duration: 200 });
        hasShownSpotlight.current = false;
      }
      // else: null during measurement — keep last rect visible while new one arrives
    }
  }, [targetRect]);

  // Card + manager image slide-in on each step change
  useEffect(() => {
    if (!step || step === 'done') return;
    cardSlideY.value = 60;
    cardSlideOpacity.value = 0;
    cardSlideY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    cardSlideOpacity.value = withTiming(1, { duration: 220 });
  }, [step]);


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

  const animatedSpotPath = useAnimatedProps(() => {
    'worklet';
    const r = CARD_RADIUS;
    const x = spotX.value, y = spotY.value, w = spotW.value, h = spotH.value;
    return {
      d: `M0 0 H${SW} V${SH} H0 Z M${x+r} ${y} H${x+w-r} Q${x+w} ${y} ${x+w} ${y+r} V${y+h-r} Q${x+w} ${y+h} ${x+w-r} ${y+h} H${x+r} Q${x} ${y+h} ${x} ${y+h-r} V${y+r} Q${x} ${y} ${x+r} ${y} Z`,
    };
  });

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ translateY: cardSlideY.value }],
    opacity: cardSlideOpacity.value,
  }));

  if (!isActive || !step || step === 'done') return null;
  if (!pathname.includes('/game')) return null;
  // choose_floor_type hint is rendered inside BusinessTypePickerSheet Modal — skip overlay entirely.
  if (step === 'choose_floor_type') return null;
  if (!config) return null;

  // ── Manager-intro layout ──────────────────────────────────────────────────
  if (config.layout === 'manager-intro') {
    return (
      /* Outer view catches ALL touches — only the button re-enables interaction */
      <View style={[StyleSheet.absoluteFill, styles.introBackdrop]} pointerEvents="box-none">
        <Pressable style={styles.skipBtn} onPress={complete}>
          <LocaleText style={styles.skipLabel}>{t('onboarding.skip')}</LocaleText>
        </Pressable>
        {/* Full-screen touch blocker underneath everything */}
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        {/* Content — box-none so the touch blocker above still works for gaps */}
        <View style={styles.introContainer} pointerEvents="box-none">
          {config.iconSource && (
            <View pointerEvents="none">
              <Image
                source={config.iconSource}
                style={styles.introManagerImg}
                resizeMode="contain"
              />
            </View>
          )}
          {/* Speech bubble — box-none so only the Pressable inside is interactive */}
          <View style={[styles.introBubble, { backgroundColor: cardBg }]} pointerEvents="box-none">
            <View style={[styles.introBubbleTip, { borderBottomColor: cardBg }]} pointerEvents="none" />
            <LocaleText style={[styles.introBubbleGreeting, { color: textMain }]} pointerEvents="none">
              {t(config.text)}
            </LocaleText>
            {(config.layoutSubtitleKey ?? 'onboarding.intro_manager') !== '' && (
              <LocaleText style={[styles.introBubbleManager, { color: textMain }]} pointerEvents="none">
                {t(config.layoutSubtitleKey ?? 'onboarding.intro_manager')}
              </LocaleText>
            )}
            <LocaleText style={[styles.introBubbleBody, { color: textSub }]} pointerEvents="none">
              {t(config.layoutBodyKey ?? 'onboarding.intro_body')}
            </LocaleText>
            {config.layoutCtaKey && (
              <LocaleText style={[styles.introBubbleBody, { color: textMain, fontFamily: 'Fredoka_600SemiBold', marginTop: 8 }]} pointerEvents="none">
                {t(config.layoutCtaKey)}
              </LocaleText>
            )}
            {config.bullets && config.bullets.map((b, i) => (
              <View key={i} style={styles.introBulletRow} pointerEvents="none">
                <Image source={b.icon} style={styles.introBulletIcon} resizeMode="contain" />
                <LocaleText style={[styles.introBulletText, { color: textSub }]}>{t(b.text)}</LocaleText>
              </View>
            ))}
            <Pressable
              style={styles.introDismissBtn}
              onPress={() => {
                const action = getOnboardingDismissAction();
                if (action) { action(); } else { advance(); }
              }}
            >
              <LocaleText style={styles.introDismissLabel}>
                {config.dismissLabel ? t(config.dismissLabel) : 'OK'}
              </LocaleText>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  // On Android, measureInWindow returns Y coordinates relative to the React
  // Native root view which sits below the status bar, but this overlay is
  // rendered in the full-screen GestureHandlerRootView (Y=0 = top of screen).
  // Adding statusBarHeight compensates for that gap.
  const androidYOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  // Use measured position if available, fallback to config fractions.
  // When neither is available (collect steps waiting for measurement), arrow is hidden.
  let px: number | undefined;
  let arrowTop: number | undefined;
  let spotlightRect: { x: number; y: number; w: number; h: number } | null = null;

  if (targetRect) {
    const ty = targetRect.y + androidYOffset;
    px = targetRect.x + targetRect.width / 2;
    const padTop = config.spotlightPadTop ?? SPOTLIGHT_PAD_TOP;
    spotlightRect = {
      x: targetRect.x - SPOTLIGHT_PAD_SIDE,
      y: ty - padTop,
      w: targetRect.width  + SPOTLIGHT_PAD_SIDE * 2,
      h: targetRect.height + padTop + SPOTLIGHT_PAD_BOTTOM,
    };
    if (config.arrowAboveSpotlight && spotlightRect) {
      arrowTop = spotlightRect.y - ARROW_SIZE - 4;
    } else if (config.arrowBelowSpotlight && spotlightRect) {
      arrowTop = spotlightRect.y + spotlightRect.h + 4 + (config.arrowBelowOffset ?? 0);
    } else if (config.arrowDir === 'down') {
      arrowTop = ty + targetRect.height - ARROW_SIZE - (config.arrowBottomOffset ?? 60);
    } else {
      arrowTop = ty + targetRect.height + 4;
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
    arrowTop = arrowRect.y + androidYOffset - ARROW_SIZE - 4;
  } else if (config.arrowOffsetX && px !== undefined) {
    px = px + config.arrowOffsetX;
  }

  // Hint card: below spotlight+arrow when hintBelowSpotlight, above spotlight (and above arrow when arrowAboveSpotlight) or below arrow.
  const cardTop = config.hintBelowSpotlight && spotlightRect
    ? Math.max(
        spotlightRect.y + spotlightRect.h + 12,
        arrowTop !== undefined ? arrowTop + ARROW_SIZE + 8 : 0,
      )
    : config.arrowDir === 'down'
      ? (config.arrowAboveSpotlight && arrowTop !== undefined
          ? arrowTop - 8 - 130
          : spotlightRect ? spotlightRect.y - 8 - 130 : (arrowTop ?? SH * 0.35) - 8 - 130)
      : (arrowTop ?? SH * 0.5) + ARROW_SIZE + 8;

  const noop = () => {};
  const noopTop = noop;
  const noopBottom = noop;
  const noopLeft = noop;
  const noopRight = noop;
  const noopFull = noop;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* Spotlight backdrop — SVG evenodd fill punches a rounded-rect hole, morphs between steps */}
      {spotlightRect ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedSpotlight]}>
          <Svg pointerEvents="none" width={SW} height={SH} style={StyleSheet.absoluteFill}>
            <AnimatedPath fillRule="evenodd" fill={DIM_COLOR} animatedProps={animatedSpotPath} />
          </Svg>
        </Animated.View>
      ) : (config.pointer || config.dismissable) ? (
        <View pointerEvents="none" style={[styles.dim, StyleSheet.absoluteFill]} />
      ) : null}

      {/* Touch-blocking rectangles around the spotlight — 4 strips that swallow all taps outside. */}
      {spotlightRect && (
        <>
          {/* Top */}
          <TouchableWithoutFeedback onPress={noopTop}>
            <View style={{ position: 'absolute', left: 0, top: 0, width: SW, height: spotlightRect.y }} />
          </TouchableWithoutFeedback>
          {/* Bottom */}
          <TouchableWithoutFeedback onPress={noopBottom}>
            <View style={{ position: 'absolute', left: 0, top: spotlightRect.y + spotlightRect.h, width: SW, height: Math.max(0, SH - spotlightRect.y - spotlightRect.h) }} />
          </TouchableWithoutFeedback>
          {/* Left */}
          <TouchableWithoutFeedback onPress={noopLeft}>
            <View style={{ position: 'absolute', left: 0, top: spotlightRect.y, width: spotlightRect.x, height: spotlightRect.h }} />
          </TouchableWithoutFeedback>
          {/* Right */}
          <TouchableWithoutFeedback onPress={noopRight}>
            <View style={{ position: 'absolute', left: spotlightRect.x + spotlightRect.w, top: spotlightRect.y, width: Math.max(0, SW - spotlightRect.x - spotlightRect.w), height: spotlightRect.h }} />
          </TouchableWithoutFeedback>
        </>
      )}
      {/* Full-screen touch block when there is no spotlight hole and no pointer target.
          Pointer-based steps (open_elevator_1, deliver_visitor) are exempt — their
          spotlight arrives after measurement; if it never arrives they fall back to the
          pointer arrow with no block (acceptable because other modals are closed).
          Rendered before the hint card so the card's Pressable (OK button) stays on top. */}
      {!spotlightRect && !config.pointer && (
        <TouchableWithoutFeedback onPress={noopFull}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}

      {/* Animated arrow.
          - Spotlight steps (targetRect set): wrapped in Animated.View that fades in with the
            spotlight via animatedSpotlight (opacity 0→1). Arrow is hidden during measurement wait.
          - Pointer-only steps (no targetRect): wrapped in a plain View so it is always at full
            opacity and has no Reanimated-driven native opacity that could interfere with iOS
            hit-testing on underlying content when opacity=0. */}
      {px !== undefined && arrowTop !== undefined && (
        targetRect ? (
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
        ) : (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: px - ARROW_SIZE / 2,
              top: arrowTop,
            }}
          >
            <Animated.View style={animatedArrow}>
              <Arrow dir={config.arrowDir} />
            </Animated.View>
          </View>
        )
      )}


      {/* Manager image — floats above the hint card */}
      {config.managerImage && !config.centered && (() => {
        const imgSize = config.managerImageSize ?? MANAGER_IMG_SIZE;
        const offset = config.managerCardOffset ?? -25;
        const wrapStyle = config.managerImageAlign === 'left'
          ? styles.cardManagerImgWrapLeft
          : config.managerImageAlign === 'center'
            ? styles.cardManagerImgWrapCenter
            : styles.cardManagerImgWrapRight;
        const paddingOverride = config.managerImageAlign === 'right' && config.managerImagePaddingRight !== undefined
          ? { paddingRight: config.managerImagePaddingRight }
          : undefined;
        return (
          <Animated.View
            pointerEvents="none"
            style={[
              wrapStyle,
              paddingOverride,
              { top: Math.max(60, Math.min(SH - 200, cardTop + offset)) - imgSize + 20 },
              animatedCard,
            ]}
          >
            <Image source={config.managerImage} style={{ width: imgSize, height: imgSize }} resizeMode="contain" />
          </Animated.View>
        );
      })()}

      {/* Hint card */}
      <Animated.View
        pointerEvents={config.dismissable ? 'auto' : 'none'}
        style={[
          styles.card,
          { backgroundColor: cardBg },
          config.centered
            ? styles.cardCentered
            : { top: Math.max(60, Math.min(SH - 200, cardTop + (config.managerImage ? (config.managerCardOffset ?? -25) : 0))), left: (SW - CARD_WIDTH) / 2 },
          animatedCard,
        ]}
      >
        {config.centered ? (
          <View style={[styles.centeredHeader, { borderBottomColor: dividerCol }]}>
            {config.iconSource && (
              <Image source={config.iconSource} style={styles.centeredIcon} resizeMode="contain" />
            )}
            <LocaleText style={[styles.centeredTitle, { color: textMain }]}>{t(config.text)}</LocaleText>
          </View>
        ) : (
          <View style={styles.cardRow}>
            {config.iconSource && (
              <Image source={config.iconSource} style={styles.icon} resizeMode="contain" />
            )}
            <Text style={[styles.cardText, { color: textMain }]}>
              {t(config.text)}
              {config.callToAction && (
                <Text style={[styles.cardCta, { color: textMain }]}>{' '}{t(config.callToAction)}</Text>
              )}
            </Text>
          </View>
        )}
        {config.bullets && config.bullets.map((b: BulletItem, i: number) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={[styles.bulletDivider, { backgroundColor: dividerCol }]} />}
            <View style={styles.bulletRow}>
              <Image source={b.icon} style={styles.bulletIcon} resizeMode="contain" />
              <LocaleText style={[styles.bulletText, { color: textSub }]}>{t(b.text)}</LocaleText>
            </View>
          </React.Fragment>
        ))}
        {config.dismissable && (
          <Pressable
            style={styles.dismissBtn}
            onPress={() => {
              if (step === 'final_message') {
                useGameStore.getState().fillLobbyOnboarding();
              }
              const action = getOnboardingDismissAction();
              if (action) { action(); } else { advance(); }
            }}
          >
            <LocaleText style={styles.dismissLabel}>{config.dismissLabel ? t(config.dismissLabel) : 'OK'}</LocaleText>
          </Pressable>
        )}

        {step === 'final_message' && (
          <View style={[styles.nextTasksBlock, { backgroundColor: isDark ? 'rgba(242,172,64,0.09)' : 'rgba(242,172,64,0.10)', borderColor: isDark ? 'rgba(242,172,64,0.22)' : 'rgba(242,172,64,0.35)' }]}>
            <Image source={CHECKLIST_ICON} style={styles.nextTasksIcon} resizeMode="contain" />
            <LocaleText style={[styles.nextTasksText, { color: textMain }]}>
              {t('onboarding.nextTasksHint')}
            </LocaleText>
          </View>
        )}
      </Animated.View>

      {/* Skip button — always visible, subtle, top-right */}
      {step !== 'final_message' && (
        <Pressable style={styles.skipBtn} onPress={complete}>
          <LocaleText style={styles.skipLabel}>{t('onboarding.skip')}</LocaleText>
        </Pressable>
      )}
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
  centeredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    marginBottom: 4,
  },
  centeredIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
  },
  centeredTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    flexShrink: 1,
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
    lineHeight: 22,
  },
  bulletDivider: {
    height: 1,
    marginVertical: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
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
  skipBtn: {
    position: 'absolute',
    top: 54,
    right: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    zIndex: 10,
  },
  skipLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
  },
  // Manager-intro layout
  introBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  introContainer: {
    width: SW * 0.82,
    alignItems: 'center',
  },
  introManagerImg: {
    width: SW * 0.68,
    height: SW * 0.68,
    marginBottom: -12,
    zIndex: 1,
  },
  introBubble: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 10,
  },
  introBubbleTip: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 13,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  introBubbleGreeting: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 10,
  },
  introBubbleManager: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 10,
  },
  introBubbleBody: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  introBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  introBulletIcon: {
    width: 22,
    height: 22,
  },
  introBulletText: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
  },
  introDismissBtn: {
    backgroundColor: '#3FA535',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  introDismissLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#fff',
  },
  cardCta: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    marginTop: 8,
  },
  cardManagerImgWrapLeft: {
    position: 'absolute',
    left: (SW - CARD_WIDTH) / 2,
    width: CARD_WIDTH,
    alignItems: 'flex-start',
    paddingLeft: 16,
  },
  cardManagerImgWrapCenter: {
    position: 'absolute',
    left: (SW - CARD_WIDTH) / 2,
    width: CARD_WIDTH,
    alignItems: 'center',
  },
  cardManagerImgWrapRight: {
    position: 'absolute',
    left: (SW - CARD_WIDTH) / 2,
    width: CARD_WIDTH,
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  cardManagerImg: {
    width: MANAGER_IMG_SIZE,
    height: MANAGER_IMG_SIZE,
  },
  nextTasksBlock: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextTasksIcon: {
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  nextTasksText: {
    flex: 1,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
  },
});
