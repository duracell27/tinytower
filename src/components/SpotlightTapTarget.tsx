import React from 'react';
import { Pressable } from 'react-native';
import { usePathname } from 'expo-router';
import { useOnboardingStore } from '../stores/onboardingStore';
import { ONBOARDING_STEPS } from '../config/onboardingSteps';
import { getOnboardingSpotlightAction } from '../utils/onboardingCallback';

const SPOTLIGHT_PAD_SIDE = 9;
const SPOTLIGHT_PAD_TOP = 41;
const SPOTLIGHT_PAD_BOTTOM = 8;

export default function SpotlightTapTarget() {
  const step       = useOnboardingStore((s) => s.step);
  const isActive   = useOnboardingStore((s) => s.isActive);
  const targetRect = useOnboardingStore((s) => s.targetRect);
  const pathname   = usePathname();

  if (!isActive || !step || step === 'done' || !targetRect) return null;
  if (!pathname.includes('/game')) return null;
  const config = ONBOARDING_STEPS[step];
  if (!config?.spotlightPressEnabled) return null;

  const padTop = config.spotlightPadTop ?? SPOTLIGHT_PAD_TOP;
  const left   = targetRect.x - SPOTLIGHT_PAD_SIDE;
  const top    = targetRect.y - padTop;
  const width  = targetRect.width  + SPOTLIGHT_PAD_SIDE * 2;
  const height = targetRect.height + padTop + SPOTLIGHT_PAD_BOTTOM;

  return (
    <Pressable
      collapsable={false}
      onPress={() => {
        const action = getOnboardingSpotlightAction();
        if (action) action();
      }}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
      }}
    />
  );
}
