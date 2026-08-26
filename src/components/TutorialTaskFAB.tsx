import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { useTutorialTaskStore } from '../stores/gameStore';

const CHECKLIST_ICON = require('../../assets/img/checklist.png');

interface Props {
  slot: number;
  aboveBar: boolean;
  onPress: () => void;
}

// The button itself is 54×54. The ring lives on an outer 58×58 wrapper so the
// button's borderRadius clip never touches the SVG.
const BTN = 54;
const WRAP = 58;
const STROKE = 3;
// Ring centered on the 58×58 wrapper, radius chosen so the ring sits just
// outside the button edge (button edge = WRAP/2 - 2 = 27; ring inner = cx - r + stroke/2)
const CX = WRAP / 2;  // 29
const R = 25;          // outer edge at 29+1.5=30.5, inner at 23.5 — clear of clip
const CIRCUMFERENCE = 2 * Math.PI * R;


export default function TutorialTaskFAB({ slot, aboveBar, onPress }: Props) {
  const { allDone, claimedFinal, isComplete, delta, currentTask } = useTutorialTaskStore();

  if (allDone && claimedFinal) return null;

  const bottomPos = aboveBar ? 160 : 96 + slot * 62;

  const ratio = !allDone && currentTask
    ? Math.min(1, delta / currentTask.threshold)
    : allDone ? 1 : 0;

  const ringColor = (isComplete || allDone) ? '#3FA535' : '#F2AC40';
  const filledLength = CIRCUMFERENCE * ratio;

  return (
    // Outer wrapper — 58×58, no overflow clip, so the SVG ring is never clipped
    <View style={[styles.wrapper, { bottom: bottomPos }]}>
      {/* Button */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.82 }]}
      >
        <Image source={CHECKLIST_ICON} style={{ width: 34, height: 34 }} contentFit="contain" />
        {isComplete && !allDone && <View style={styles.badge} />}
      </Pressable>

      {/* Progress ring — sibling of Pressable, drawn on top, not clipped */}
      <Svg
        width={WRAP}
        height={WRAP}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {/* Gray track — always visible */}
        <Circle
          cx={CX}
          cy={CX}
          r={R}
          stroke="rgba(0,0,0,0.12)"
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Filled arc — only when there is progress */}
        {ratio > 0 && ratio < 1 && (
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={[filledLength, CIRCUMFERENCE - filledLength]}
            strokeLinecap="round"
            rotation={-90}
            origin={`${CX}, ${CX}`}
          />
        )}
        {/* Full circle at 100% — no dasharray to avoid gap from rounded caps */}
        {ratio >= 1 && (
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 16 - (WRAP - BTN) / 2,   // compensate 2px so button stays at right:16
    width: WRAP,
    height: WRAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3FA535',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
