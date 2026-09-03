import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { gameConfig } from '../../shared/config/gameConfig';
import { FLOOR_STAR_MULTIPLIERS } from '../../shared/config/floorUpgradeConfig';
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
  isBetterCandidate?: boolean;
  onToggle: () => void;
  onFire: () => void;
  onTrain: () => void;
  onFindJob?: () => void;
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
    <Image
      source={filled ? require('../../assets/img/starFull.png') : require('../../assets/img/starEmpty.png')}
      style={{ width: 14, height: 14 }}
      contentFit="contain"
    />
  );
}

export function getProductionTimeRemaining(
  floor: Floor,
  slotIdx: number,
  now: number,
  floorStars?: Record<string, number>,
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
    const stars = floorStars?.[String(floor.id)] ?? 0;
    const starTimeMultiplier = FLOOR_STAR_MULTIPLIERS[stars]?.time ?? 1;
    const remaining = typeConfig.sellDuration * starTimeMultiplier - (now - production.stageStartedAt);
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
  isBetterCandidate = false,
  onToggle,
  onFire,
  onTrain,
  onFindJob,
}: WorkerJobCardProps) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const theme = useAppTheme();
  const { isDark } = theme;

  const ft = gameConfig.floorTypes[worker.floorType];
  const accent = ft?.accent ?? '#888';
  const floorAccent = gameConfig.floorTypes[floorType]?.accent ?? '#888';
  let dreamAccent = accent;
  for (const floorTypeEntry of Object.values(gameConfig.floorTypes)) {
    if (floorTypeEntry.businesses.some((b) => b.dreamJobs.includes(worker.dreamJob))) {
      dreamAccent = floorTypeEntry.accent ?? accent;
      break;
    }
  }
  const production = floor.productions[worker.assignedSlotIdx!];
  const productionName = production?.typeId
    ? tContent(`productionTypes.${production.typeId}.displayName`, { defaultValue: production.typeId })
    : '—';
  const dreamJobName = tContent(`productionTypes.${worker.dreamJob}.displayName`, { defaultValue: worker.dreamJob });
  const category = tContent(`floorTypes.${worker.floorType}.category`, { defaultValue: worker.floorType });

  const expandAnim = useSharedValue(expanded ? 1 : 0);
  const chevronAnim = useSharedValue(expanded ? 1 : 0);
  const arrowBounce = useSharedValue(0);

  React.useEffect(() => {
    expandAnim.value = withTiming(expanded ? 1 : 0, TIMING_CONFIG);
    chevronAnim.value = withTiming(expanded ? 1 : 0, TIMING_CONFIG);
  }, [expanded]);

  React.useEffect(() => {
    if (!isBetterCandidate) return;
    arrowBounce.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 350 }),
        withTiming(0, { duration: 350 }),
      ),
      -1,
      false,
    );
  }, [isBetterCandidate]);

  const expandedStyle = useAnimatedStyle(() => ({
    maxHeight: expandAnim.value * 480,
    opacity: expandAnim.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 90}deg` }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: arrowBounce.value }],
  }));

  const activeProduction = getProductionTimeRemaining(floor, worker.assignedSlotIdx!, now);
  const statusLabel = activeProduction
    ? (activeProduction.stage === 'DELIVERING' ? 'Delivering' : 'Selling') + ' · ' + formatTime(activeProduction.remainingMs)
    : productionName;

  const borderColor = worker.isSpecialist ? '#F5C842' : accent;

  return (
    <View style={[styles.card, { borderColor, borderWidth: expanded ? 2 : 1 }, isDark && { backgroundColor: theme.surfaceCard }]}>
      <Pressable onPress={onToggle} style={styles.collapsedRow}>
        <View style={styles.avatarWrap}>
          <WorkerAvatar worker={worker} size={60} />
          {(isSpecialistTab || worker.level === 9) && (
            <View style={[styles.starBadge, isDark && { backgroundColor: theme.surfaceCard }]}>
              <StarIcon filled={worker.isSpecialist} />
            </View>
          )}
        </View>

        <View style={styles.infoColumn}>
          <View style={styles.nameRow}>
            <Text style={[styles.nameText, isDark && { color: theme.text }]} numberOfLines={1}>{worker.name}</Text>
            {isBetterCandidate && (
              <Animated.View style={arrowStyle}>
                <Image
                  source={require('../../assets/img/greenArrowUp.png')}
                  style={styles.upgradeBadge}
                  contentFit="contain"
                />
              </Animated.View>
            )}
          </View>
          {isMidTab && (
            <View style={styles.iconRow}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={dreamAccent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.floorText, { color: dreamAccent }]} numberOfLines={1}>{`${dreamFloorName} · ${dreamJobName}`}</Text>
            </View>
          )}
          <View style={styles.iconRow}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" stroke={floorAccent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke={floorAccent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.floorText, { color: floorAccent }]} numberOfLines={1}>{`${floorName} · ${productionName}`}</Text>
          </View>
          {activeProduction && (
            <Text style={[styles.statusText, isDark && { color: '#5A6470' }]} numberOfLines={1}>{statusLabel}</Text>
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
          <View style={[styles.infoRows, isDark && { backgroundColor: theme.surfaceSub }]}>
            <InfoRow label={t('workersPanel.workerJobCard.skill')} value={`${category} · ${worker.level}`} />
            <InfoRow label={t('workersPanel.workerJobCard.dreamJob')} value={dreamJobName} valueColor={dreamAccent} />
            <InfoRow label={t('workersPanel.workerJobCard.worksAt')} value={`${floorName} · ${productionName}`} valueColor={floorAccent} />
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

          {isMidTab && isBetterCandidate && onFindJob && (
            <Pressable
              onPress={onFindJob}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            >
              <LinearGradient colors={['#4CAF7D', '#2E8B57']} style={styles.actionButtonGradient}>
                <Image
                  source={require('../../assets/img/greenArrowUp.png')}
                  style={{ width: 16, height: 16 }}
                  contentFit="contain"
                />
                <Text style={styles.actionButtonText}>{t('workerCard.actions.findJob')}</Text>
              </LinearGradient>
              <View style={[styles.actionButtonShadow, { backgroundColor: '#1E6B3A' }]} />
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

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useAppTheme();
  const { isDark } = theme;
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoRowLabel, isDark && { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.infoRowValue, isDark && { color: theme.text }, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
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
    right: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  upgradeBadge: {
    width: 16,
    height: 16,
  },
});
