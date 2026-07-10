import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Polygon } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerMood } from '../../shared/engine/workerUtils';
import type { Worker, Floor } from '../../shared/types';
import WorkerAvatar from './WorkerAvatar';
import { GemIcon } from './CurrencyIcons';

interface WorkerJobCardProps {
  worker: Worker;
  floor: Floor;
  floorType: string;
  floorName: string;
  dreamFloorName: string;
  now: number;
  expanded: boolean;
  isSpecialistTab: boolean;
  isMidTab?: boolean;
  onToggle: () => void;
  onFire: () => void;
  onTrain: () => void;
}

const TIMING_CONFIG = { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) };

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (totalMin < 60) return `${totalMin}m ${sec}s`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${hours}h ${min}m`;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={filled ? '#F5C842' : 'none'}
        stroke={filled ? '#E0A800' : '#B0B6C2'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function getProductionTimeRemaining(
  floor: Floor,
  slotIdx: number,
  now: number,
): { stage: 'DELIVERING' | 'SELLING'; remainingMs: number } | null {
  const production = floor.productions[slotIdx];
  if (!production || !production.typeId) return null;
  const typeConfig = gameConfig.productionTypes[production.typeId];
  if (!typeConfig) return null;

  if (production.stage === 'DELIVERING') {
    const remaining = typeConfig.deliveryDuration - (now - production.stageStartedAt);
    if (remaining > 0) return { stage: 'DELIVERING', remainingMs: remaining };
  }
  if (production.stage === 'SELLING') {
    const remaining = typeConfig.sellDuration - (now - production.stageStartedAt);
    if (remaining > 0) return { stage: 'SELLING', remainingMs: remaining };
  }
  return null;
}

export default function WorkerJobCard({
  worker,
  floor,
  floorType,
  floorName,
  dreamFloorName,
  now,
  expanded,
  isSpecialistTab,
  isMidTab = false,
  onToggle,
  onFire,
  onTrain,
}: WorkerJobCardProps) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');

  const ft = gameConfig.floorTypes[worker.floorType];
  const accent = ft?.accent ?? '#888';
  const production = floor.productions[worker.assignedSlotIdx!];
  const productionName = production?.typeId
    ? tContent(`productionTypes.${production.typeId}.displayName`, { defaultValue: production.typeId })
    : '—';
  const dreamJobName = tContent(`productionTypes.${worker.dreamJob}.displayName`, { defaultValue: worker.dreamJob });
  const category = tContent(`floorTypes.${worker.floorType}.category`, { defaultValue: worker.floorType });

  const expandAnim = useSharedValue(expanded ? 1 : 0);
  const chevronAnim = useSharedValue(expanded ? 1 : 0);

  React.useEffect(() => {
    expandAnim.value = withTiming(expanded ? 1 : 0, TIMING_CONFIG);
    chevronAnim.value = withTiming(expanded ? 1 : 0, TIMING_CONFIG);
  }, [expanded]);

  const expandedStyle = useAnimatedStyle(() => ({
    maxHeight: expandAnim.value * 480,
    opacity: expandAnim.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 90}deg` }],
  }));

  const activeProduction = getProductionTimeRemaining(floor, worker.assignedSlotIdx!, now);
  const statusLabel = activeProduction
    ? (activeProduction.stage === 'DELIVERING' ? 'Delivering' : 'Selling') + ' · ' + formatTime(activeProduction.remainingMs)
    : productionName;

  const borderColor = worker.isSpecialist ? '#F5C842' : accent;

  return (
    <View style={[styles.card, { borderColor, borderWidth: expanded ? 2 : 1 }]}>
      <Pressable onPress={onToggle} style={styles.collapsedRow}>
        <View style={styles.avatarWrap}>
          <WorkerAvatar worker={worker} size={60} />
          {(isSpecialistTab || worker.level === 9) && (
            <View style={styles.starBadge}>
              <StarIcon filled={worker.isSpecialist} />
            </View>
          )}
        </View>

        <View style={styles.infoColumn}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>{worker.name}</Text>
            <View style={[styles.moodDotOuter, { backgroundColor: isMidTab ? 'rgba(229,167,46,0.24)' : 'rgba(73,170,56,0.24)' }]}>
              <View style={[styles.moodDotInner, { backgroundColor: isMidTab ? '#E5A72E' : '#49AA38' }]} />
            </View>
          </View>
          {isMidTab && (
            <View style={styles.iconRow}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.floorText, { color: accent }]} numberOfLines={1}>{`${dreamFloorName} · ${dreamJobName}`}</Text>
            </View>
          )}
          <View style={styles.iconRow}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.floorText, { color: accent }]} numberOfLines={1}>{`${floorName} · ${productionName}`}</Text>
          </View>
          {activeProduction && (
            <Text style={styles.statusText} numberOfLines={1}>{statusLabel}</Text>
          )}
        </View>

        <View style={styles.levelBlock}>
          <View style={styles.levelInner}>
            <Text style={styles.levelLabel}>
              {t('workerCard.level')}
            </Text>
            <Text style={[styles.levelNumber, { color: accent }]}>
              {worker.level}
            </Text>
          </View>
          <Animated.View style={chevronStyle}>
            <Svg width={9} height={14} viewBox="0 0 9 14" fill="none">
              <Path d="M2 2l5 5-5 5" stroke="#C2C8D2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        </View>
      </Pressable>

      <Animated.View style={[styles.expandedSection, expandedStyle]}>
        <View style={styles.expandedContent}>
          <View style={styles.infoRows}>
            <InfoRow label={t('workersPanel.workerJobCard.skill')} value={`${category} · ${worker.level}`} />
            <InfoRow label={t('workersPanel.workerJobCard.dreamJob')} value={dreamJobName} />
            <InfoRow label={t('workersPanel.workerJobCard.worksAt')} value={`${floorName} · ${productionName}`} />
          </View>

          {isSpecialistTab && !worker.isSpecialist && (
            <Pressable
              onPress={onTrain}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            >
              <LinearGradient colors={['#F5C842', '#D4A500']} style={styles.actionButtonGradient}>
                <Text style={styles.actionButtonText}>{t('workersPanel.trainButton')}</Text>
                <GemIcon size={16} />
              </LinearGradient>
              <View style={[styles.actionButtonShadow, { backgroundColor: '#A07800' }]} />
            </Pressable>
          )}

          <Pressable
            onPress={onFire}
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          >
            <LinearGradient colors={['#E2685A', '#CC4A3C']} style={styles.actionButtonGradient}>
              <Text style={styles.actionButtonText}>{t('workersPanel.fireButton')}</Text>
            </LinearGradient>
            <View style={[styles.actionButtonShadow, { backgroundColor: '#A8392C' }]} />
          </Pressable>
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
  avatarWrap: {
    position: 'relative',
  },
  starBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moodDotOuter: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodDotInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  infoColumn: {
    flex: 1,
    gap: 3,
  },
  nameText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2A3344',
    textTransform: 'capitalize',
  },
  floorText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12.5,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
});
