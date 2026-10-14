import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { useCityTaskStore } from '../stores/cityTaskStore';

const CITY_TASK_ICON = require('../../assets/img/checklist.png');

const BTN = 54;
const WRAP = 58;
const STROKE = 3;
const CX = WRAP / 2;   // 29
const R = 25;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface Props {
  slot: number;
  aboveBar: boolean;
  onPress: () => void;
}

export default function CityTaskFAB({ slot, aboveBar, onPress }: Props) {
  const theme = useAppTheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { tasks, myActiveTaskId } = useCityTaskStore();

  if (!myActiveTaskId) return null;

  const activeTask = tasks.find((t) => t.id === myActiveTaskId);
  const ratio = activeTask
    ? Math.min(1, activeTask.currentProgress / Math.max(1, activeTask.requiredCount))
    : 0;
  const isCompleted = activeTask?.status === 'COMPLETED';

  const FAB_BASE = Platform.OS === 'android' ? 84 + bottomInset : 96;
  const bottomPos = aboveBar ? FAB_BASE + 64 : FAB_BASE + slot * 62;

  const ringColor = isCompleted ? '#3FA535' : '#2592AB';
  const filledLength = CIRCUMFERENCE * ratio;

  return (
    <View style={[styles.wrapper, { bottom: bottomPos }]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.surface, borderColor: theme.isDark ? theme.divider : 'rgba(255,255,255,0.9)' },
          pressed && { opacity: 0.82 },
        ]}
      >
        <Image source={CITY_TASK_ICON} style={{ width: 34, height: 34 }} contentFit="contain" />
        {isCompleted && <View style={[styles.badge, { borderColor: theme.surface }]} />}
      </Pressable>

      <Svg width={WRAP} height={WRAP} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={CX} cy={CX} r={R} stroke="rgba(0,0,0,0.12)" strokeWidth={STROKE} fill="none" />
        {ratio > 0 && ratio < 1 && (
          <Circle
            cx={CX} cy={CX} r={R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={[filledLength, CIRCUMFERENCE - filledLength]}
            strokeLinecap="round"
            rotation={-90}
            origin={`${CX}, ${CX}`}
          />
        )}
        {ratio >= 1 && (
          <Circle cx={CX} cy={CX} r={R} stroke={ringColor} strokeWidth={STROKE} fill="none" />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16 - (WRAP - BTN) / 2,  // compensate 2px so button stays at left:16
    width: WRAP,
    height: WRAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
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
  },
});
