import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { Image } from 'expo-image';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { getProductionStatus } from '../../shared/engine/productionStatus';
import { getRevenueMultiplier } from '../../shared/engine/workerUtils';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import WorkerAvatar from './WorkerAvatar';
import { shadeColor } from '../utils/color';
import type { Production, EffectiveStage, Worker } from '../../shared/types';
import type { ImageSource } from 'expo-image';
import { CoinIcon } from './CurrencyIcons';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const STROKE_W = 3;
const BTN_R = 12;

function calcPerimeter(w: number, h: number): number {
  const r = Math.max(0, BTN_R - STROKE_W / 2);
  return 2 * (w - STROKE_W) + 2 * (h - STROKE_W) - r * (8 - 2 * Math.PI);
}

// Path starting from 12 o'clock (top-center), going clockwise
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

// Button color and shadow configs per stage
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
      return (
        <View style={iconStyles.coinCircle} />
      );
    default:
      return null;
  }
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

interface ProductionCardProps {
  production: Production;
  balance: number;
  now: number;
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
  accentColor: string;
  onHire?: (floorId: number, slotIdx: number) => void;
}

export default function ProductionCard({
  production,
  balance,
  now,
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
  accentColor,
  onHire,
}: ProductionCardProps) {
  const typeConfig = production.typeId
    ? gameConfig.productionTypes[production.typeId] ?? null
    : null;

  const status = getProductionStatus(production, typeConfig, now, balance);
  const { effectiveStage, timeRemaining, canAct } = status;

  const btnConfig = BTN_COLORS[effectiveStage] || BTN_COLORS.IDLE;

  // Primary (clickable) states use the floor's accent color; in-progress
  // timer states (DELIVERING/SELLING) keep their fixed BTN_COLORS above so
  // "processing" stays visually distinct from "your turn to tap".
  const PRIMARY_STAGES = new Set(['EMPTY', 'IDLE', 'READY_TO_LIST', 'READY_TO_COLLECT']);
  const isPrimaryStage = PRIMARY_STAGES.has(effectiveStage);
  const accentBtnConfig = {
    color: accentColor,
    shadowColor: shadeColor(accentColor, -28),
  };
  const resolvedBtnConfig = isPrimaryStage ? accentBtnConfig : btnConfig;

  // Compute discounted buy cost
  const effectiveCost = typeConfig
    ? Math.floor(typeConfig.buyCost * (1 - (floorDiscount ?? 0)))
    : 0;
  const hasDiscount = (floorDiscount ?? 0) > 0;
  const discountPercent = hasDiscount ? Math.round((floorDiscount ?? 0) * 100) : 0;

  // Compute revenue multiplier
  const multiplier = worker && floorType
    ? getRevenueMultiplier(worker, floorType, production.typeId)
    : 1;
  const effectiveRevenue = typeConfig ? Math.floor(typeConfig.batchValue * multiplier) : 0;
  const hasMultiplier = multiplier > 1;

  const isProgressTimer = effectiveStage === 'DELIVERING' || effectiveStage === 'SELLING';
  const totalDur = isProgressTimer && typeConfig
    ? (effectiveStage === 'DELIVERING' ? typeConfig.deliveryDuration : typeConfig.sellDuration)
    : 0;

  const [btnSize, setBtnSize] = useState({ width: 0, height: 0 });
  const dashOffset = useSharedValue(99999);
  const layoutReady = useRef(false);

  useEffect(() => { layoutReady.current = false; }, [effectiveStage]);

  useEffect(() => {
    if (!isProgressTimer || btnSize.width === 0 || totalDur === 0) return;
    const perim = calcPerimeter(btnSize.width, btnSize.height);
    const progress = Math.max(0, Math.min(1, timeRemaining / totalDur));
    // On the last tick animate to 0 so the border completes before stage changes
    const isLastTick = timeRemaining < 1200;
    const target = isLastTick ? 0 : perim * progress;
    const duration = isLastTick ? Math.max(timeRemaining, 80) : 1100;
    if (!layoutReady.current) {
      layoutReady.current = true;
      dashOffset.value = target;
    } else {
      dashOffset.value = withTiming(target, { duration, easing: Easing.linear });
    }
  }, [timeRemaining, btnSize, isProgressTimer, totalDur]);

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

  const { t } = useTranslation('hotel');
  const isHire = effectiveStage === 'EMPTY';
  const isTimer = effectiveStage === 'DELIVERING' || effectiveStage === 'SELLING' || effectiveStage === 'READY_TO_LIST';
  const isLocked = !worker;

  // Label text
  let labelText = '';
  let subText = '';
  switch (effectiveStage) {
    case 'EMPTY':
      labelText = t('productionCard.actions.hire');
      subText = typeConfig ? String(effectiveCost) : '';
      break;
    case 'IDLE':
      labelText = t('productionCard.actions.buy');
      subText = typeConfig ? String(effectiveCost) : '';
      break;
    case 'DELIVERING':
      labelText = formatTime(timeRemaining);
      subText = t('productionCard.status.delivering');
      break;
    case 'READY_TO_LIST':
      labelText = t('productionCard.actions.list');
      subText = typeConfig ? formatDuration(typeConfig.sellDuration) : '';
      break;
    case 'SELLING':
      labelText = formatTime(timeRemaining);
      subText = t('productionCard.status.selling');
      break;
    case 'READY_TO_COLLECT':
      labelText = t('productionCard.actions.collect');
      subText = typeConfig ? String(effectiveRevenue) : '';
      break;
  }

  // No worker: show hire design
  if (isLocked) {
    return (
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.title, { color: nameColor }]} numberOfLines={1}>
          {productTitle}
        </Text>

        <View style={styles.imageContainer}>
          <View style={styles.hireSlot}>
            <Svg viewBox="0 0 24 24" width={30} height={30} fill="#C2BEB2">
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

        <View style={styles.subContainer} />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Title */}
      <Text style={[styles.title, { color: nameColor }]} numberOfLines={1}>
        {productTitle}
      </Text>

      {/* Image / Hire slot */}
      <View style={styles.imageContainer}>
        {isHire ? (
          <View style={styles.hireSlot}>
            <Svg viewBox="0 0 24 24" width={30} height={30} fill="#C2BEB2">
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
        {/* Worker mini-indicator */}
        {worker && (
          <View style={styles.workerBadgeColumn}>
            <View style={styles.workerBadge}>
              <WorkerAvatar worker={worker} size={24} />
            </View>
            {hasMultiplier && (
              <View style={[styles.bonusBubble, { backgroundColor: accentColor }]}>
                <Text style={styles.bonusBubbleText}>×{multiplier}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Action button */}
      <View onLayout={(e) => setBtnSize(e.nativeEvent.layout)}>
        <Pressable
          onPress={canAct ? handleAction : undefined}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: resolvedBtnConfig.color, shadowColor: resolvedBtnConfig.shadowColor },
            !canAct && !isTimer && styles.actionButtonDisabled,
            pressed && canAct && styles.actionButtonPressed,
          ]}
        >
          <StageIcon stage={effectiveStage} />
          <Text style={styles.actionLabel}>{labelText}</Text>
        </Pressable>
        {isProgressTimer && btnSize.width > 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={btnSize.width} height={btnSize.height}>
              {/* Background track */}
              <Path
                d={makeRoundRectPath(btnSize.width, btnSize.height)}
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth={STROKE_W}
                strokeLinecap="round"
              />
              {/* Animated progress */}
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
      </View>

      {/* Sub-block: price or status */}
      <View style={styles.subContainer}>
        {effectiveStage === 'READY_TO_LIST' && subText ? (
          <View style={styles.statusPill}>
            <Svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#8A8475" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M3 4h2.2l2.4 10.5h9.1l1.9-7H6.3" />
              <Circle cx={9} cy={19} r={1.2} fill="#8A8475" stroke="none" />
              <Circle cx={17} cy={19} r={1.2} fill="#8A8475" stroke="none" />
            </Svg>
            <Text style={styles.statusText}>{subText}</Text>
          </View>
        ) : isTimer ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{subText}</Text>
          </View>
        ) : subText ? (
          <View style={styles.pricePill}>
            <CoinIcon size={13} />
            <Text style={styles.priceText}>{subText}</Text>
          </View>
        ) : null}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'column',
    gap: 6,
    borderRadius: 18,
    paddingTop: 8,
    paddingHorizontal: 7,
    paddingBottom: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.55)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    shadowColor: 'rgba(60,70,45,1)',
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
    borderColor: 'rgba(60,70,45,0.22)',
    backgroundColor: 'rgba(0,0,0,0.02)',
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
    shadowColor: 'rgba(40,90,25,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 3,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    shadowColor: 'rgba(60,70,45,1)',
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  statusText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10.5,
    color: '#8A8475',
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingLeft: 4,
    paddingRight: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(120,90,30,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  priceCoinIcon: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#F2B330',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(180,130,30,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
  },
  priceText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11.5,
    color: '#7C7256',
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
    backgroundColor: '#E7EBF1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  bonusBubble: {
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#fff',
  },
  bonusBubbleText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 8,
    color: '#fff',
  },
});
