import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import ProductionCard from './ProductionCard';
import { useFloor, useGameStore } from '../stores/gameStore';
import { useGameClock } from '../hooks/useGameClock';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot, getFloorDiscount, getFloorSpecialistBonus } from '../../shared/engine/workerUtils';
import { shadeColor } from '../utils/color';
import { PRODUCT_IMAGES } from '../utils/productImages';

// Floor color schemes matching the design
export interface FloorColorScheme {
  color: string;
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  stars: number;
}

// Single source of truth for all floor type color schemes
export const FLOOR_TYPE_SCHEMES: Record<string, FloorColorScheme> = {
  green: {
    color: '#5E8F42',
    headerShadowColor: 'rgba(0,83,0,0.4)',
    bodyColor: '#D0EBCB',
    cardBg: '#E8F5E5',
    nameColor: '#117200',
    stars: 0,
  },
  blue: {
    color: '#2E6EC9',
    headerShadowColor: 'rgba(0,31,142,0.4)',
    bodyColor: '#CADDFC',
    cardBg: '#E5EEFD',
    nameColor: '#003EAD',
    stars: 0,
  },
  yellow: {
    color: '#E7A52B',
    headerShadowColor: 'rgba(142,80,0,0.4)',
    bodyColor: '#FCEBC9',
    cardBg: '#FDF5E4',
    nameColor: '#AD6F00',
    stars: 0,
  },
  purple: {
    color: '#9A6FD0',
    headerShadowColor: 'rgba(85,40,170,0.4)',
    bodyColor: '#E8DEFE',
    cardBg: '#F2ECFF',
    nameColor: '#6A40A0',
    stars: 0,
  },
  red: {
    color: '#E05050',
    headerShadowColor: 'rgba(170,30,30,0.4)',
    bodyColor: '#F8DEDE',
    cardBg: '#FFF0F0',
    nameColor: '#B02020',
    stars: 0,
  },
};

// Derived automatically from gameConfig — no manual sync needed when static floors change
export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = Object.fromEntries(
  gameConfig.floors
    .map((f) => [f.id, FLOOR_TYPE_SCHEMES[f.floorType]])
    .filter((entry): entry is [number, FloorColorScheme] => entry[1] != null),
);


function Stars({ count, color = '#FFD23E' }: { count: number; color?: string }) {
  return (
    <View style={styles.starsContainer}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Text
          key={i}
          style={[
            styles.star,
            { color: i < count ? color : 'rgba(0,0,0,0.18)' },
            i < count && {
              textShadowColor: 'rgba(120,80,0,0.4)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 1,
            },
          ]}
        >
          {'★'}
        </Text>
      ))}
    </View>
  );
}

interface FloorCardProps {
  floorId: number;
  balance: number;
  onHireSlot?: (floorId: number, slotIdx: number) => void;
}

function FloorCardInner({ floorId, balance, onHireSlot }: FloorCardProps) {
  const now = useGameClock(1000);
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const floor = useFloor(floorId);
  const workers = useGameStore((s) => s.workers);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const gems = useGameStore((s) => s.gems);
  const floorStars = useGameStore((s) => s.floorStars);
  const openFloorUpgradeModal = useGameStore((s) => s.openFloorUpgradeModal);
  const starCount = floorStars?.[String(floorId)] ?? 0;
  const dynamicFloorType = openedFloorTypes?.[String(floorId)];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType = floorConfig?.floorType ?? dynamicFloorType ?? null;
  const scheme = (floorType ? FLOOR_TYPE_SCHEMES[floorType] : undefined) ?? FLOOR_TYPE_SCHEMES.green;
  const availableTypes = floorConfig?.availableTypes
    ?? floor?.productions.map((p) => p.typeId).filter((id): id is string => id !== null) ?? [];
  const discount = getFloorDiscount(workers, floorId);
  const specialistBonus = getFloorSpecialistBonus(workers, floorId);
  const deliveryLockMs = floor.productions.reduce((maxRemaining, p) => {
    if (p.stage !== 'DELIVERING' || !p.typeId) return maxRemaining;
    const tc = gameConfig.productionTypes[p.typeId];
    if (!tc) return maxRemaining;
    const remaining = tc.deliveryDuration - (now - p.stageStartedAt);
    return Math.max(maxRemaining, remaining);
  }, 0);
  // Derive business name from the first production typeId — stable regardless of what
  // other floors of the same type get opened later.
  const dynamicFloorName = (() => {
    if (!dynamicFloorType || !availableTypes[0]) return null;
    const business = gameConfig.floorTypes[dynamicFloorType]?.businesses
      .find((b) => b.dreamJobs.includes(availableTypes[0]));
    return business?.name ?? null;
  })();
  const floorName = dynamicFloorName ?? tContent(`floors.${floorId}.name`, { defaultValue: `Floor ${floorId}` });
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={[styles.floorContainer, isDark && styles.floorContainerDark]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: scheme.color }]}>
        <View style={[styles.headerEdge, { backgroundColor: shadeColor(scheme.color, -22) }]} />
        <View style={styles.floorNumberBadge}>
          <Text style={styles.floorNumberText}>{floorId}</Text>
        </View>
        <Text style={[styles.floorName, { textShadowColor: scheme.headerShadowColor }]}>
          {floorName}
        </Text>
        <View style={styles.headerRight}>
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>−{Math.round(discount * 100)}%</Text>
            </View>
          )}
          {specialistBonus > 0 && (
            <View style={styles.specialistBonusBadge}>
              <Text style={styles.specialistBonusBadgeText}>+{Math.round(specialistBonus * 100)}%</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => openFloorUpgradeModal(floorId)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            activeOpacity={0.7}
          >
            <Stars count={starCount} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Production cards */}
      <View style={[styles.cardsContainer, { backgroundColor: scheme.bodyColor }]}>
        {floor.productions.map((production, idx) => {
          const slotWorker = getWorkerForSlot(workers, floorId, idx);
          return (
            <ProductionCard
              key={idx}
              production={production}
              balance={balance}
              now={now}
              floorId={floorId}
              floorType={floorType}
              slotIdx={idx}
              floorAvailableTypes={availableTypes}
              cardBg={scheme.cardBg}
              nameColor={scheme.nameColor}
              productTitle={tContent(`productionTypes.${availableTypes[idx]}.displayName`, {
                defaultValue: availableTypes[idx] ?? t('floorCard.productFallback', { index: idx + 1 }),
              })}
              productImage={PRODUCT_IMAGES[availableTypes[idx]] ?? PRODUCT_IMAGES[availableTypes[0]]}
              worker={slotWorker}
              floorDiscount={discount}
              specialistBonus={specialistBonus}
              accentColor={scheme.color}
              onHire={onHireSlot}
              deliveryLockMs={deliveryLockMs}
              gems={gems}
            />
          );
        })}
      </View>

      {isDark && (
        <View style={styles.darkOverlay} pointerEvents="none" />
      )}
    </View>
  );
}

const FloorCard = memo(FloorCardInner);
export default FloorCard;

const styles = StyleSheet.create({
  floorContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
    backgroundColor: '#fff',
  },
  floorContainerDark: {
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowOpacity: 0.45,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 31,
    paddingHorizontal: 12,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  headerEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.55,
  },
  floorNumberBadge: {
    width: 21,
    height: 21,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  floorNumberText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  floorName: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'capitalize',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 1,
  },
  star: {
    fontSize: 13,
    lineHeight: 15,
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: 9,
    padding: 11,
  },
  discountBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  discountBadgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10,
    color: '#fff',
  },
  specialistBonusBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  specialistBonusBadgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10,
    color: '#fff',
  },
});
