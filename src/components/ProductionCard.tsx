import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { getProductionStatus } from '../../shared/engine/productionStatus';
import { getRevenueMultiplier } from '../../shared/engine/workerUtils';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import WorkerAvatar from './WorkerAvatar';
import type { Production, EffectiveStage, Worker } from '../../shared/types';
import type { ImageSource } from 'expo-image';

// Button gradient and shadow configs per stage
const BTN_COLORS: Record<string, { colors: [string, string]; shadowColor: string }> = {
  IDLE: { colors: ['#72C24F', '#5BA63C'], shadowColor: '#4A8A2E' },
  READY_TO_COLLECT: { colors: ['#72C24F', '#5BA63C'], shadowColor: '#4A8A2E' },
  EMPTY: { colors: ['#72C24F', '#5BA63C'], shadowColor: '#4A8A2E' },
  DELIVERING: { colors: ['#52A6E2', '#3B8BCB'], shadowColor: '#2C73AC' },
  READY_TO_LIST: { colors: ['#F2AC40', '#E89320'], shadowColor: '#C9760F' },
  SELLING: { colors: ['#9A72D6', '#8455C2'], shadowColor: '#6B41A8' },
};

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) {
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(sec).padStart(2, '0')}`;
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
  slotIdx: number;
  floorAvailableTypes: string[];
  cardBg: string;
  nameColor: string;
  productTitle: string;
  productImage: ImageSource;
  worker?: Worker;
  floorDiscount?: number;
  onHire?: (floorId: number, slotIdx: number) => void;
}

export default function ProductionCard({
  production,
  balance,
  now,
  floorId,
  slotIdx,
  floorAvailableTypes,
  cardBg,
  nameColor,
  productTitle,
  productImage,
  worker,
  floorDiscount,
  onHire,
}: ProductionCardProps) {
  const typeConfig = production.typeId
    ? gameConfig.productionTypes[production.typeId] ?? null
    : null;

  const status = getProductionStatus(production, typeConfig, now, balance);
  const { effectiveStage, timeRemaining, canAct } = status;

  const btnConfig = BTN_COLORS[effectiveStage] || BTN_COLORS.IDLE;

  // Compute discounted buy cost
  const effectiveCost = typeConfig
    ? Math.floor(typeConfig.buyCost * (1 - (floorDiscount ?? 0)))
    : 0;
  const hasDiscount = (floorDiscount ?? 0) > 0;
  const discountPercent = hasDiscount ? Math.round((floorDiscount ?? 0) * 100) : 0;

  // Compute revenue multiplier
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const multiplier = worker && floorConfig
    ? getRevenueMultiplier(worker, floorConfig.floorType, production.typeId)
    : 1;
  const effectiveRevenue = typeConfig ? Math.floor(typeConfig.batchValue * multiplier) : 0;
  const hasMultiplier = multiplier > 1;

  const handleAction = useCallback(() => {
    const store = useGameStore.getState();
    switch (effectiveStage) {
      case 'EMPTY': {
        // Auto-select the first available type
        const typeId = floorAvailableTypes[0];
        if (typeId) {
          store.buy(floorId, slotIdx, typeId);
        }
        break;
      }
      case 'IDLE':
        if (production.typeId) {
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
  }, [effectiveStage, floorId, slotIdx, floorAvailableTypes, production.typeId]);

  const isHire = effectiveStage === 'EMPTY';
  const isTimer = effectiveStage === 'DELIVERING' || effectiveStage === 'SELLING';
  const isLocked = !worker;

  // Label text
  let labelText = '';
  let subText = '';
  let discountBadge = '';
  let multiplierBadge = '';
  switch (effectiveStage) {
    case 'EMPTY':
      labelText = 'Найняти';
      subText = typeConfig ? String(effectiveCost) : '';
      if (hasDiscount) discountBadge = `−${discountPercent}%`;
      break;
    case 'IDLE':
      labelText = 'Закупити';
      subText = typeConfig ? String(effectiveCost) : '';
      if (hasDiscount) discountBadge = `−${discountPercent}%`;
      break;
    case 'DELIVERING':
      labelText = formatTime(timeRemaining);
      subText = 'Доставка';
      break;
    case 'READY_TO_LIST':
      labelText = 'Викласти';
      subText = typeConfig ? String(effectiveRevenue) : '';
      if (hasMultiplier) multiplierBadge = `×${multiplier}`;
      break;
    case 'SELLING':
      labelText = formatTime(timeRemaining);
      subText = 'Продаж';
      break;
    case 'READY_TO_COLLECT':
      labelText = 'Зібрати';
      subText = typeConfig ? String(effectiveRevenue) : '';
      if (hasMultiplier) multiplierBadge = `×${multiplier}`;
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
            <View style={styles.hirePlusBadge}>
              <Svg viewBox="0 0 24 24" width={9} height={9}>
                <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" />
              </Svg>
            </View>
          </View>
        </View>

        <Pressable onPress={() => onHire?.(floorId, slotIdx)} style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.actionButtonPressed,
        ]}>
          <LinearGradient
            colors={BTN_COLORS.EMPTY.colors}
            style={styles.actionButtonGradient}
          >
            <StageIcon stage={'EMPTY'} />
            <Text style={styles.actionLabel}>Найняти</Text>
          </LinearGradient>
          <View style={[styles.actionButtonShadow, { backgroundColor: BTN_COLORS.EMPTY.shadowColor }]} />
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
            <View style={styles.hirePlusBadge}>
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
          <View style={styles.workerBadge}>
            <WorkerAvatar worker={worker} size={24} />
          </View>
        )}
      </View>

      {/* Action button */}
      <Pressable onPress={canAct ? handleAction : undefined} style={({ pressed }) => [
        styles.actionButton,
        !canAct && styles.actionButtonDisabled,
        pressed && canAct && styles.actionButtonPressed,
      ]}>
        <LinearGradient
          colors={btnConfig.colors}
          style={styles.actionButtonGradient}
        >
          <StageIcon stage={effectiveStage} />
          <Text style={styles.actionLabel}>{labelText}</Text>
        </LinearGradient>
        <View style={[styles.actionButtonShadow, { backgroundColor: btnConfig.shadowColor }]} />
      </Pressable>

      {/* Sub-block: price or status */}
      <View style={styles.subContainer}>
        {isTimer ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{subText}</Text>
          </View>
        ) : subText ? (
          <View style={styles.pricePill}>
            <View style={styles.priceCoinIcon} />
            <Text style={styles.priceText}>{subText}</Text>
            {discountBadge ? (
              <Text style={styles.discountBadge}>{discountBadge}</Text>
            ) : null}
            {multiplierBadge ? (
              <Text style={styles.multiplierBadge}>{multiplierBadge}</Text>
            ) : null}
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
    borderRadius: 13,
    paddingTop: 8,
    paddingHorizontal: 7,
    paddingBottom: 7,
    shadowColor: 'rgba(60,70,45,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11.5,
    lineHeight: 13,
    textAlign: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hireSlot: {
    width: 54,
    height: 54,
    borderRadius: 13,
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
    backgroundColor: '#5BA63C',
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
    borderRadius: 11,
  },
  actionButton: {
    borderRadius: 9,
    overflow: 'hidden',
    position: 'relative',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 7,
    zIndex: 1,
  },
  actionButtonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
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
  workerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
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
  discountBadge: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 9,
    color: '#5BA63C',
    marginLeft: 2,
  },
  multiplierBadge: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 9,
    color: '#E89320',
    marginLeft: 2,
  },
});
