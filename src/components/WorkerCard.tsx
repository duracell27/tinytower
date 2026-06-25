import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { gameConfig } from '../../shared/config/gameConfig';
import type { Worker } from '../../shared/types';
import WorkerAvatar from './WorkerAvatar';

interface WorkerCardProps {
  worker: Worker;
  expanded: boolean;
  onToggle: () => void;
  onFindJob: () => void;
  onEvict: () => void;
}

const TIMING_CONFIG = { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) };

export default function WorkerCard({
  worker,
  expanded,
  onToggle,
  onFindJob,
  onEvict,
}: WorkerCardProps) {
  const ft = gameConfig.floorTypes[worker.floorType];
  const accent = ft?.accent ?? '#888';
  const shirtColor = ft?.shirtColor ?? '#999';
  const category = ft?.category ?? worker.floorType;
  const dreamJobName =
    gameConfig.productionTypes[worker.dreamJob]?.displayName ?? worker.dreamJob;

  const expandAnim = useSharedValue(expanded ? 1 : 0);
  const chevronAnim = useSharedValue(expanded ? 1 : 0);

  React.useEffect(() => {
    expandAnim.value = withTiming(expanded ? 1 : 0, TIMING_CONFIG);
    chevronAnim.value = withTiming(expanded ? 1 : 0, TIMING_CONFIG);
  }, [expanded]);

  const expandedStyle = useAnimatedStyle(() => ({
    maxHeight: expandAnim.value * 440,
    opacity: expandAnim.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 90}deg` }],
  }));

  const isUnemployed = worker.assignedFloorId === null;
  const statusText = worker.female ? 'Безробітна' : 'Безробітний';

  return (
    <View
      style={[
        styles.card,
        expanded
          ? { borderWidth: 2, borderColor: shirtColor }
          : { borderWidth: 1, borderColor: 'rgba(40,60,90,0.06)' },
      ]}
    >
      {/* Collapsed row */}
      <Pressable onPress={onToggle} style={styles.collapsedRow}>
        <WorkerAvatar worker={worker} size={60} />

        <View style={styles.infoColumn}>
          {/* Name row */}
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {worker.name}
            </Text>
            {isUnemployed && (
              <View style={styles.moodDotOuter}>
                <View style={styles.moodDotInner} />
              </View>
            )}
          </View>

          {/* Dream job row */}
          <View style={styles.detailRow}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
                stroke={accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M4 22V15"
                stroke={accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={[styles.dreamJobText, { color: accent }]}>
              {dreamJobName}
            </Text>
          </View>

          {/* Status row */}
          <View style={styles.detailRow}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"
                stroke="#A6ACB8"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"
                stroke="#A6ACB8"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>

        {/* Level + chevron */}
        <View style={styles.levelBlock}>
          <View style={styles.levelInner}>
            <Text style={styles.levelLabel}>РІВЕНЬ</Text>
            <Text style={[styles.levelNumber, { color: accent }]}>
              {worker.level}
            </Text>
          </View>
          <Animated.View style={chevronStyle}>
            <Svg width={9} height={14} viewBox="0 0 9 14" fill="none">
              <Path
                d="M2 2l5 5-5 5"
                stroke="#C2C8D2"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </View>
      </Pressable>

      {/* Expanded section */}
      <Animated.View style={[styles.expandedSection, expandedStyle]}>
        <View style={styles.expandedContent}>
          {/* Info rows */}
          <View style={styles.infoRows}>
            <InfoRow label="Навичка" value={`${category} · рівень ${worker.level}`} />
            <InfoRow label="Робота мрії" value={dreamJobName} />
            <InfoRow
              label="Працює"
              value={worker.female ? 'Безробітна' : 'Безробітний'}
            />
            <InfoRow label="Проживає" value="Готель" />
          </View>

          {/* Find job button */}
          <Pressable
            onPress={onFindJob}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <LinearGradient
              colors={['#72C24F', '#5BA63C']}
              style={styles.actionButtonGradient}
            >
              <Text style={styles.actionButtonText}>Знайти роботу</Text>
            </LinearGradient>
            <View
              style={[
                styles.actionButtonShadow,
                { backgroundColor: '#4A8A2E' },
              ]}
            />
          </Pressable>

          {/* Evict button */}
          <Pressable
            onPress={onEvict}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <LinearGradient
              colors={['#E2685A', '#CC4A3C']}
              style={styles.actionButtonGradient}
            >
              <Text style={styles.actionButtonText}>Виселити</Text>
            </LinearGradient>
            <View
              style={[
                styles.actionButtonShadow,
                { backgroundColor: '#A8392C' },
              ]}
            />
          </Pressable>

          {/* Hint */}
          <Text style={styles.hintText}>
            Чим вищий навик працівника, тим більшу знижку на закупівлю він дає
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  collapsedRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 11,
    paddingRight: 13,
    alignItems: 'center',
  },
  infoColumn: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2A3344',
    textTransform: 'capitalize',
  },
  moodDotOuter: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(226,104,90,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodDotInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E2685A',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dreamJobText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12.5,
    textTransform: 'capitalize',
  },
  statusText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12.5,
    color: '#9098A6',
  },
  levelBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  levelInner: {
    alignItems: 'center',
    gap: 1,
  },
  levelLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 8,
    color: '#AEB4C0',
    letterSpacing: 0.5,
  },
  levelNumber: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
  },
  expandedSection: {
    overflow: 'hidden',
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 12,
  },
  infoRows: {
    gap: 8,
    backgroundColor: '#F4F5F8',
    borderRadius: 12,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRowLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#8A90A0',
  },
  infoRowValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#3A4250',
    textTransform: 'capitalize',
  },
  actionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    zIndex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
  },
  actionButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  actionButtonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  hintText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 11.5,
    color: '#9098A6',
    textAlign: 'center',
    lineHeight: 16,
  },
});
