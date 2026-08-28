import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming, withRepeat, withSequence, cancelAnimation, Easing } from 'react-native-reanimated';
import { useClockNow } from '../context/ClockContext';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { getRevenueMultiplier } from '../../shared/engine/workerUtils';
import { useGameStore } from '../stores/gameStore';
import { FLOOR_STAR_MULTIPLIERS } from '../../shared/config/floorUpgradeConfig';
import { gameConfig } from '../../shared/config/gameConfig';
import WorkerAvatar from './WorkerAvatar';
import { shadeColor } from '../utils/color';
import { formatNum } from '../utils/format';
import type { Production, EffectiveStage, Worker } from '../../shared/types';
import type { ImageSource } from 'expo-image';
import { CoinIcon, GemIcon } from './CurrencyIcons';
import { useAppTheme } from '../hooks/useAppTheme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const STROKE_W = 3;
const BTN_R = 12;

function calcPerimeter(w: number, h: number): number {
  const r = Math.max(0, BTN_R - STROKE_W / 2);
  return 2 * (w - STROKE_W) + 2 * (h - STROKE_W) - r * (8 - 2 * Math.PI);
}

function makeRoundRectPath(btnW: number, btnH: number): string {
  const x = STROKE_W / 2;
  const y = STROKE_W / 2;
  const W = btnW - STROKE_W;
  const H = btnH - STROKE_W;
  const r = Math.max(0, BTN_R - STROKE_W / 2);
  const cx = x + W / 2;
  return [
    `M ${cx} ${y}`,
    `L ${x + W - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + W} ${y + r}`,
    `L ${x + W} ${y + H - r}`,
    `A ${r} ${r} 0 0 1 ${x + W - r} ${y + H}`,
    `L ${x + r} ${y + H}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + H - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `L ${cx} ${y}`,
  ].join(' ');
}

const BTN_COLORS: Record<string, { color: string; shadowColor: string }> = {
  IDLE: { color: '#F0895E', shadowColor: '#B5512A' },
  READY_TO_COLLECT: { color: '#72C24F', shadowColor: '#4A8A2E' },
  EMPTY: { color: '#72C24F', shadowColor: '#4A8A2E' },
  DELIVERING: { color: '#2EB8A0', shadowColor: '#1A8272' },
  READY_TO_LIST: { color: '#F2AC40', shadowColor: '#C9760F' },
  SELLING: { color: '#E0688A', shadowColor: '#A8405A' },
};

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return i18n.t('hotel:productionCard.time.seconds', { count: totalSec });
  const totalMin = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (totalMin < 60) return i18n.t('hotel:productionCard.time.minutesSeconds', { minutes: totalMin, seconds: sec });
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hours < 24) return i18n.t('hotel:productionCard.time.hoursMinutes', { hours, minutes: min });
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return i18n.t('hotel:productionCard.time.daysHours', { days, hours: h });
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return i18n.t('hotel:productionCard.time.seconds', { count: totalSec });
  const min = Math.floor(totalSec / 60);
  if (min < 60) return i18n.t('hotel:productionCard.time.minutes', { count: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return i18n.t('hotel:productionCard.time.hours', { count: hours });
  return i18n.t('hotel:productionCard.time.days', { count: Math.floor(hours / 24) });
}

function StageIcon({ stage }: { stage: EffectiveStage }) {
  switch (stage) {
    case 'IDLE':
      return (
        <Svg viewBox="0 0 24 24" width={13} height={13}>
          <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" />
        </Svg>
      );
    case 'EMPTY':
      return (
        <Svg viewBox="0 0 24 24" width={16} height={14} fill="#fff">
          <Circle cx={9} cy={8} r={3.4} />
          <Path d="M3 20c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4z" />
          <Path d="M19 7.5v6M16 10.5h6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      );
    case 'DELIVERING':
      return (
        <Svg viewBox="0 0 24 24" width={16} height={14} fill="#fff">
          <Path d="M2 6.5h11.5v8.5H2z" />
          <Path d="M13.5 9h3.6L21 12.4V15h-7.5z" />
          <Circle cx={6} cy={16.6} r={2} stroke="#3B8BCB" strokeWidth={1.4} fill="#fff" />
          <Circle cx={17.2} cy={16.6} r={2} stroke="#3B8BCB" strokeWidth={1.4} fill="#fff" />
        </Svg>
      );
    case 'READY_TO_LIST':
      return (
        <Svg viewBox="0 0 24 24" width={14} height={14}>
          <Rect x={4} y={6} width={16} height={13} rx={1.6} fill="#fff" />
          <Rect x={4} y={6} width={16} height={4} rx={1.6} fill="rgba(0,0,0,0.16)" />
          <Rect x={11} y={6} width={2} height={13} fill="rgba(0,0,0,0.13)" />
        </Svg>
      );
    case 'SELLING':
      return (
        <Svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 4h2.2l2.4 10.5h9.1l1.9-7H6.3" />
          <Circle cx={9} cy={19} r={1.5} fill="#fff" stroke="none" />
          <Circle cx={17} cy={19} r={1.5} fill="#fff" stroke="none" />
        </Svg>
      );
    case 'READY_TO_COLLECT':
      return <CoinIcon size={16} />;
    default:
      return null;
  }
}

function LockIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
      <Rect x={5} y={11} width={14} height={10} rx={2} fill="#fff" />
      <Path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke="#fff"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

const iconStyles = StyleSheet.create({
  coinCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F2B330',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: 'rgba(120,80,0,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1,
  },
});

// Tiny sub-component: only this Text re-renders every second during active timers.
// The parent ProductionCard stays frozen until a real stage transition occurs.
function TimerText({ stageEndsAt, style }: { stageEndsAt: number; style: object }) {
  const now = useClockNow();
  return <Text style={style}>{formatTime(Math.max(0, stageEndsAt - now))}</Text>;
}

// Static layout-only styles shared with DeliveryLockPill (no color dependencies).
const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pillText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10.5,
  },
});

// Tiny sub-component: delivery lock countdown pill.
// Re-renders every second so the countdown ticks, without touching the parent.
function DeliveryLockPill({ deliveryLockUntil, accentColor }: { deliveryLockUntil: number; accentColor: string }) {
  const now = useClockNow();
  const remaining = Math.max(0, deliveryLockUntil - now);
  if (remaining <= 0) return null;
  return (
    <View style={[pillStyles.pill, { backgroundColor: accentColor + '20' }]}>
      <Text style={[pillStyles.pillText, { color: accentColor }]}>{formatTime(remaining)}</Text>
    </View>
  );
}

interface ProductionCardProps {
  production: Production;
  balance: number;
  floorId: number;
  floorType: string | null;
  slotIdx: number;
  floorAvailableTypes: string[];
  cardBg: string;
  nameColor: string;
  productTitle: string;
  productImage: ImageSource;
  worker?: Worker;
  floorDiscount?: number;
  specialistBonus?: number;
  accentColor: string;
  onHire?: (floorId: number, slotIdx: number) => void;
  deliveryLockUntil?: number;
  gems: number;
  onLongPress?: () => void;
}

export default function ProductionCard({
  production,
  balance,
  floorId,
  floorType,
  slotIdx,
  floorAvailableTypes,
  cardBg,
  nameColor,
  productTitle,
  productImage,
  worker,
  floorDiscount,
  specialistBonus,
  accentColor,
  onHire,
  deliveryLockUntil,
  gems,
  onLongPress,
}: ProductionCardProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const { isDark } = theme;
  const styles = getStyles(theme);

  const typeConfig = production.typeId
    ? gameConfig.productionTypes[production.typeId] ?? null
    : null;

  const floorStars = useGameStore((s) => s.floorStars);
  const stars = floorStars?.[String(floorId)] ?? 0;
  const starMult = FLOOR_STAR_MULTIPLIERS[stars] ?? FLOOR_STAR_MULTIPLIERS[0];
  const effectiveSellDuration = typeConfig ? typeConfig.sellDuration * starMult.time : 0;

  const shirtColor = floorType && gameConfig.floorTypes[floorType]
    ? gameConfig.floorTypes[floorType].shirtColor
    : '#999';

  const levelBadgeBg = worker?.isSpecialist ? '#F5C842' : accentColor;
  const levelBadgeTextColor = worker?.isSpecialist ? '#fff' : '#fff';

  // --- Stage management via setTimeout (no per-second re-renders) ---

  // Fires once when a DELIVERING or SELLING timer expires, flipping the stage locally.
  const [localCompleted, setLocalCompleted] = useState(false);

  useEffect(() => {
    setLocalCompleted(false);
    if ((production.stage !== 'DELIVERING' && production.stage !== 'SELLING') || !typeConfig) return;
    const duration = production.stage === 'DELIVERING'
      ? typeConfig.deliveryDuration
      : effectiveSellDuration;
    const endAt = production.stageStartedAt + duration;
    const delay = Math.max(0, endAt - Date.now());
    if (delay <= 0) { setLocalCompleted(true); return; }
    const id = setTimeout(() => setLocalCompleted(true), delay);
    return () => clearTimeout(id);
  }, [production.stage, production.stageStartedAt, effectiveSellDuration, typeConfig]);

  // Fires once when the delivery lock on an adjacent slot expires.
  const [lockExpired, setLockExpired] = useState(false);

  useEffect(() => {
    const until = deliveryLockUntil ?? 0;
    if (until <= 0) { setLockExpired(true); return; }
    setLockExpired(false);
    const delay = Math.max(0, until - Date.now());
    if (delay <= 0) { setLockExpired(true); return; }
    const id = setTimeout(() => setLockExpired(true), delay);
    return () => clearTimeout(id);
  }, [deliveryLockUntil]);

  // --- Derive stage without now ---

  const effectiveCost = typeConfig
    ? Math.floor(typeConfig.buyCost * starMult.cost * (1 - (floorDiscount ?? 0)))
    : 0;

  let effectiveStage: EffectiveStage;
  let canAct: boolean;

  if (!production.typeId || !typeConfig) {
    effectiveStage = 'EMPTY';
    canAct = true;
  } else {
    switch (production.stage) {
      case 'IDLE':
        effectiveStage = 'IDLE';
        canAct = balance >= effectiveCost;
        break;
      case 'DELIVERING':
        effectiveStage = localCompleted ? 'READY_TO_LIST' : 'DELIVERING';
        canAct = localCompleted;
        break;
      case 'READY_TO_LIST':
        effectiveStage = 'READY_TO_LIST';
        canAct = true;
        break;
      case 'SELLING':
        effectiveStage = localCompleted ? 'READY_TO_COLLECT' : 'SELLING';
        canAct = localCompleted;
        break;
      case 'READY_TO_COLLECT':
        effectiveStage = 'READY_TO_COLLECT';
        canAct = true;
        break;
      default:
        effectiveStage = 'IDLE';
        canAct = false;
    }
  }

  const isDeliveryLocked =
    (effectiveStage === 'IDLE' || effectiveStage === 'EMPTY') &&
    !lockExpired &&
    (deliveryLockUntil ?? 0) > 0;

  // Stable absolute timestamp for the active timer — only changes when stage starts.
  const isProgressTimer = effectiveStage === 'DELIVERING' || effectiveStage === 'SELLING';
  const totalDur = isProgressTimer && typeConfig
    ? (effectiveStage === 'DELIVERING' ? typeConfig.deliveryDuration : effectiveSellDuration)
    : 0;
  const stageEndsAt = isProgressTimer && typeConfig
    ? production.stageStartedAt + totalDur
    : 0;

  const MS_PER_HOUR = 3_600_000;
  const speedUpCost = (production.stage === 'DELIVERING' && !localCompleted && stageEndsAt > 0)
    ? Math.max(1, Math.ceil(Math.max(0, stageEndsAt - Date.now()) / MS_PER_HOUR))
    : 0;

  const btnConfig = BTN_COLORS[effectiveStage] || BTN_COLORS.IDLE;
  const PRIMARY_STAGES = new Set(['EMPTY', 'IDLE', 'READY_TO_LIST', 'READY_TO_COLLECT']);
  const isPrimaryStage = PRIMARY_STAGES.has(effectiveStage);
  const accentBtnConfig = { color: accentColor, shadowColor: shadeColor(accentColor, -28) };
  const resolvedBtnConfig = isPrimaryStage ? accentBtnConfig : btnConfig;

  const hasDiscount = (floorDiscount ?? 0) > 0;
  const discountPercent = hasDiscount ? Math.round((floorDiscount ?? 0) * 100) : 0;

  const multiplier = worker && floorType
    ? getRevenueMultiplier(worker, floorType, production.typeId)
    : 1;
  const coinBonusPercent = useGameStore(s => s.coinBonusPercent);
  const businessUpgrades = useGameStore(s => s.businessUpgrades);
  const specialistBonusPercent = Math.round((specialistBonus ?? 0) * 100);
  const categoryBonus = floorType ? (businessUpgrades?.[floorType as keyof typeof businessUpgrades] ?? 0) * 5 : 0;
  const effectiveRevenue = typeConfig
    ? Math.floor(typeConfig.batchValue * starMult.value * (1 + (coinBonusPercent + specialistBonusPercent + categoryBonus) / 100) * multiplier)
    : 0;
  const hasMultiplier = multiplier > 1;

  // --- Progress border animation ---
  // Kicked off ONCE per stage start; Reanimated drives it on the UI thread.

  const isTimer = effectiveStage === 'DELIVERING' || effectiveStage === 'SELLING';

  const [btnSize, setBtnSize] = useState({ width: 0, height: 0 });
  const dashOffset = useSharedValue(99999);

  const btnScale = useSharedValue(1);
  const shouldPulse = canAct && !isTimer && !isDeliveryLocked;

  useEffect(() => {
    if (shouldPulse) {
      btnScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 5000 }),
          withTiming(1.06, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 280, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(btnScale);
      btnScale.value = withTiming(1, { duration: 120 });
    }
  }, [shouldPulse]);

  const btnPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  useEffect(() => {
    if (stageEndsAt === 0 || btnSize.width === 0 || totalDur === 0) {
      cancelAnimation(dashOffset);
      return;
    }
    const perim = calcPerimeter(btnSize.width, btnSize.height);
    const remaining = Math.max(0, stageEndsAt - Date.now());
    const startOffset = perim * Math.min(1, remaining / totalDur);
    cancelAnimation(dashOffset);
    dashOffset.value = startOffset;
    dashOffset.value = withTiming(0, { duration: Math.max(remaining, 80), easing: Easing.linear });
  }, [stageEndsAt, btnSize.width, btnSize.height, totalDur]);

  const animatedRectProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const handleAction = useCallback(() => {
    const store = useGameStore.getState();
    switch (effectiveStage) {
      case 'EMPTY': {
        const typeId = floorAvailableTypes[0];
        if (typeId) {
          const firstConfig = gameConfig.productionTypes[typeId];
          const firstCost = firstConfig
            ? Math.floor(firstConfig.buyCost * (1 - (floorDiscount ?? 0)))
            : 0;
          if (store.balance < firstCost) {
            store.showInsufficientResources({ currency: 'coins', need: firstCost, have: store.balance });
            return;
          }
          store.buy(floorId, slotIdx, typeId);
        }
        break;
      }
      case 'IDLE':
        if (production.typeId) {
          if (store.balance < effectiveCost) {
            store.showInsufficientResources({ currency: 'coins', need: effectiveCost, have: store.balance });
            return;
          }
          store.buy(floorId, slotIdx, production.typeId);
        }
        break;
      case 'READY_TO_LIST':
        store.list(floorId, slotIdx);
        break;
      case 'READY_TO_COLLECT':
        store.collect(floorId, slotIdx);
        break;
    }
  }, [effectiveStage, floorId, slotIdx, floorAvailableTypes, production.typeId, effectiveCost, floorDiscount]);

  const handleSpeedUp = useCallback(() => {
    const store = useGameStore.getState();
    if (gems < speedUpCost) {
      store.showInsufficientResources({ currency: 'gems', need: speedUpCost, have: gems });
      return;
    }
    store.speedUpDelivery(floorId, slotIdx);
  }, [gems, speedUpCost, floorId, slotIdx]);

  const { t } = useTranslation('hotel');
  const isHire = effectiveStage === 'EMPTY';
  const isLocked = !worker;

  let labelText = '';
  let subText = '';
  switch (effectiveStage) {
    case 'EMPTY':
      labelText = t('productionCard.actions.hire');
      subText = typeConfig ? formatNum(effectiveCost) : '';
      break;
    case 'IDLE':
      labelText = t('productionCard.actions.buy');
      subText = typeConfig ? formatNum(effectiveCost) : '';
      break;
    case 'DELIVERING':
      subText = t('productionCard.status.delivering');
      break;
    case 'READY_TO_LIST':
      labelText = t('productionCard.actions.list');
      subText = typeConfig ? formatDuration(effectiveSellDuration) : '';
      break;
    case 'SELLING':
      subText = t('productionCard.status.selling');
      break;
    case 'READY_TO_COLLECT':
      labelText = t('productionCard.actions.collect');
      subText = typeConfig ? String(effectiveRevenue) : '';
      break;
  }

  if (isLocked) {
    return (
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.title, { color: nameColor }]} numberOfLines={1}>
          {productTitle}
        </Text>

        <View style={styles.imageContainer}>
          <View style={[styles.hireSlot, { borderColor: accentColor + '66' }]}>
            <Svg viewBox="0 0 24 24" width={30} height={30} fill={accentColor + '99'}>
              <Circle cx={12} cy={8} r={4.2} />
              <Path d="M4.5 21c0-4.2 3.4-6.8 7.5-6.8s7.5 2.6 7.5 6.8z" />
            </Svg>
            <View style={[styles.hirePlusBadge, { backgroundColor: accentColor }]}>
              <Svg viewBox="0 0 24 24" width={9} height={9}>
                <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" />
              </Svg>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => onHire?.(floorId, slotIdx)}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: accentColor, shadowColor: shadeColor(accentColor, -40) },
            pressed && styles.actionButtonPressed,
          ]}
        >
          <StageIcon stage={'EMPTY'} />
          <Text style={styles.actionLabel}>{t('productionCard.actions.hire')}</Text>
        </Pressable>

        <View style={styles.subContainer}>
          <Text style={[styles.pillText, { color: accentColor }]}>{t('productionCard.actions.workerWanted')}</Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.card, { backgroundColor: cardBg }]}
      onLongPress={onLongPress}
      delayLongPress={800}
    >
      <Text style={[styles.title, { color: nameColor }]} numberOfLines={1}>
        {productTitle}
      </Text>

      <View style={styles.imageContainer}>
        {isHire ? (
          <View style={[styles.hireSlot, { borderColor: accentColor + '66' }]}>
            <Svg viewBox="0 0 24 24" width={30} height={30} fill={accentColor + '99'}>
              <Circle cx={12} cy={8} r={4.2} />
              <Path d="M4.5 21c0-4.2 3.4-6.8 7.5-6.8s7.5 2.6 7.5 6.8z" />
            </Svg>
            <View style={[styles.hirePlusBadge, { backgroundColor: accentColor }]}>
              <Svg viewBox="0 0 24 24" width={9} height={9}>
                <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" />
              </Svg>
            </View>
          </View>
        ) : (
          <Image
            source={productImage}
            style={styles.productImage}
            contentFit="contain"
          />
        )}
        {worker && (
          <Pressable
            style={({ pressed }) => [styles.workerBadgeColumn, pressed && { opacity: 0.7 }]}
            hitSlop={6}
            accessibilityLabel={`View ${worker.name} in My Workers`}
            accessibilityRole="button"
            onPress={() => {
              useGameStore.getState().setPendingWorkerFocus(worker.id);
              router.navigate('/(tabs)/menu');
            }}
          >
            <View style={[styles.workerBadge, worker.isSpecialist && { borderColor: '#F5C842' }]}>
              <WorkerAvatar worker={worker} size={24} />
            </View>
            <View style={[styles.workerLevelBadge, { backgroundColor: levelBadgeBg }]}>
              <Text style={[styles.workerLevelText, { color: levelBadgeTextColor }]}>{worker.level}</Text>
            </View>
            {hasMultiplier && (
              <View style={[styles.bonusBubble, { backgroundColor: accentColor }]}>
                <Text style={styles.bonusBubbleText}>×{multiplier}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>

      <Animated.View style={btnPulseStyle} onLayout={(e) => setBtnSize(e.nativeEvent.layout)}>
        <Pressable
          onPress={isDeliveryLocked ? undefined : (canAct ? handleAction : undefined)}
          onLongPress={onLongPress}
          delayLongPress={800}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: resolvedBtnConfig.color, shadowColor: resolvedBtnConfig.shadowColor },
            ((!canAct && !isTimer) || isDeliveryLocked) && styles.actionButtonDisabled,
            pressed && canAct && !isDeliveryLocked && styles.actionButtonPressed,
          ]}
        >
          {isDeliveryLocked ? <LockIcon /> : <StageIcon stage={effectiveStage} />}
          {isProgressTimer && stageEndsAt > 0
            ? <TimerText stageEndsAt={stageEndsAt} style={styles.actionLabel} />
            : <Text style={styles.actionLabel}>{labelText}</Text>
          }
        </Pressable>
        {isProgressTimer && btnSize.width > 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={btnSize.width} height={btnSize.height}>
              <Path
                d={makeRoundRectPath(btnSize.width, btnSize.height)}
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth={STROKE_W}
                strokeLinecap="round"
              />
              <AnimatedPath
                d={makeRoundRectPath(btnSize.width, btnSize.height)}
                fill="none"
                stroke="rgba(255,255,255,0.88)"
                strokeWidth={STROKE_W}
                strokeLinecap="round"
                strokeDasharray={calcPerimeter(btnSize.width, btnSize.height)}
                animatedProps={animatedRectProps}
              />
            </Svg>
          </View>
        )}
      </Animated.View>

      <View style={styles.subContainer}>
        {isDeliveryLocked ? (
          <DeliveryLockPill deliveryLockUntil={deliveryLockUntil ?? 0} accentColor={accentColor} />
        ) : effectiveStage === 'DELIVERING' ? (
          <Pressable
            onPress={handleSpeedUp}
            style={({ pressed }) => [styles.pill, { backgroundColor: accentColor + '20', borderColor: accentColor, borderWidth: 1 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.pillText, { color: accentColor }]}>speed up {speedUpCost}</Text>
            <GemIcon size={12} />
          </Pressable>
        ) : effectiveStage === 'READY_TO_LIST' && subText ? (
          <View style={[styles.pill, { backgroundColor: accentColor + '20' }]}>
            <Svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke={accentColor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M3 4h2.2l2.4 10.5h9.1l1.9-7H6.3" />
              <Circle cx={9} cy={19} r={1.2} fill={accentColor} stroke="none" />
              <Circle cx={17} cy={19} r={1.2} fill={accentColor} stroke="none" />
            </Svg>
            <Text style={[styles.pillText, { color: accentColor }]}>{subText}</Text>
          </View>
        ) : isTimer ? (
          <View style={[styles.pill, { backgroundColor: accentColor + '20' }]}>
            <Text style={[styles.pillText, { color: accentColor }]}>{subText}</Text>
          </View>
        ) : subText ? (
          <View style={[styles.pill, { backgroundColor: accentColor + '20' }]}>
            <CoinIcon size={13} />
            <Text style={[styles.pillText, { color: accentColor }]}>{subText}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function getStyles(theme: ReturnType<typeof useAppTheme>) {
  const { isDark } = theme;
  return StyleSheet.create({
    card: {
      flex: 1,
      flexDirection: 'column',
      gap: 6,
      borderRadius: 18,
      paddingTop: 8,
      paddingHorizontal: 7,
      paddingBottom: 7,
      shadowColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(60,70,45,1)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    title: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 11.5,
      lineHeight: 13,
      textAlign: 'center',
      textTransform: 'capitalize',
    },
    imageContainer: {
      width: '100%',
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: 10,
    },
    hireSlot: {
      width: 54,
      height: 54,
      borderRadius: 16,
      borderWidth: 2,
      borderStyle: 'dashed',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    hirePlusBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      width: 17,
      height: 17,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(40,90,25,1)',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.45,
      shadowRadius: 2,
      elevation: 3,
    },
    productImage: {
      width: 56,
      height: 56,
      borderRadius: 14,
      shadowColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(60,70,45,1)',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.28,
      shadowRadius: 3,
      elevation: 3,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 7,
      borderRadius: 12,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 4,
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonPressed: {
      opacity: 0.9,
      shadowOpacity: 0.1,
      elevation: 1,
    },
    actionLabel: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 11.5,
      color: '#fff',
      textShadowColor: 'rgba(0,0,0,0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    },
    subContainer: {
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    pillText: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 10.5,
    },
    workerBadgeColumn: {
      position: 'absolute',
      top: -4,
      right: -4,
      alignItems: 'center',
      gap: 2,
    },
    workerBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#E7EBF1',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.surface,
      overflow: 'hidden',
    },
    workerLevelBadge: {
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.surface,
      marginTop: -7,
    },
    workerLevelText: {
      fontFamily: 'Fredoka_700Bold',
      fontSize: 8,
      color: '#fff',
      lineHeight: 8,
    },
    bonusBubble: {
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderWidth: 1,
      borderColor: theme.surface,
    },
    bonusBubbleText: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: 8,
      color: '#fff',
    },
  });
}
