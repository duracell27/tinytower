import React, { memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import ProductionCard from './ProductionCard';
import { useFloor, useGameStore } from '../stores/gameStore';
import { useOnboardingStore } from '../stores/onboardingStore';
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
  dark: {
    color: string;
    bodyColor: string;
    cardBg: string;
    nameColor: string;
  };
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
    dark: {
      color: '#6BA34A',
      bodyColor: '#1C241A',
      cardBg: '#384434',
      nameColor: '#8FCC70',
    },
  },
  blue: {
    color: '#2E6EC9',
    headerShadowColor: 'rgba(0,31,142,0.4)',
    bodyColor: '#CADDFC',
    cardBg: '#E5EEFD',
    nameColor: '#003EAD',
    stars: 0,
    dark: {
      color: '#3A7ED8',
      bodyColor: '#18202E',
      cardBg: '#323E52',
      nameColor: '#7AADEE',
    },
  },
  yellow: {
    color: '#E7A52B',
    headerShadowColor: 'rgba(142,80,0,0.4)',
    bodyColor: '#FCEBC9',
    cardBg: '#FDF5E4',
    nameColor: '#AD6F00',
    stars: 0,
    dark: {
      color: '#F0B030',
      bodyColor: '#26201A',
      cardBg: '#483E34',
      nameColor: '#F0C060',
    },
  },
  purple: {
    color: '#9A6FD0',
    headerShadowColor: 'rgba(85,40,170,0.4)',
    bodyColor: '#E8DEFE',
    cardBg: '#F2ECFF',
    nameColor: '#6A40A0',
    stars: 0,
    dark: {
      color: '#A87EDE',
      bodyColor: '#201A2E',
      cardBg: '#3E3454',
      nameColor: '#C4A0F0',
    },
  },
  red: {
    color: '#E05050',
    headerShadowColor: 'rgba(170,30,30,0.4)',
    bodyColor: '#F8DEDE',
    cardBg: '#FFF0F0',
    nameColor: '#B02020',
    stars: 0,
    dark: {
      color: '#E86060',
      bodyColor: '#2A1A1A',
      cardBg: '#4C3434',
      nameColor: '#F08080',
    },
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
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const floor = useFloor(floorId);
  const workers = useGameStore((s) => s.workers);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const gems = useGameStore((s) => s.gems);
  const floorStars = useGameStore((s) => s.floorStars);
  const openFloorUpgradeModal = useGameStore((s) => s.openFloorUpgradeModal);
  const openProductionDetailModal = useGameStore((s) => s.openProductionDetailModal);
  const onboardingStep = useOnboardingStore((s) => s.step);
  const onboardingSlot0Ready =
    (onboardingStep === 'collect_slot_1' && floorId === 2) ||
    (onboardingStep === 'collect_slot_2' && floorId === 3) ||
    (onboardingStep === 'buy_goods_1'    && floorId === 2) ||
    (onboardingStep === 'buy_goods_2'    && floorId === 3) ||
    (onboardingStep === 'assign_worker'  && floorId === 2);

  // Force SELLING only for collect steps (so collect button is visible)
  const onboardingForceSellingSlot0 =
    (onboardingStep === 'collect_slot_1' && floorId === 2) ||
    (onboardingStep === 'collect_slot_2' && floorId === 3);

  const slot0Ref = useRef<View>(null);
  const measureSlot0 = () => {
    requestAnimationFrame(() => {
      slot0Ref.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          useOnboardingStore.getState().setTargetRect({ x, y, width, height });
        }
      });
    });
  };
  // Single measurement after FlashList fully settles — no onLayout to avoid catching
  // transitional positions during cell recycling / layout recalculation.
  useEffect(() => {
    if (!onboardingSlot0Ready) return;
    const timer = setTimeout(measureSlot0, 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingSlot0Ready]);
  const starCount = floorStars?.[String(floorId)] ?? 0;
  const dynamicFloorType = openedFloorTypes?.[String(floorId)];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType = floorConfig?.floorType ?? dynamicFloorType ?? null;
  const scheme = (floorType ? FLOOR_TYPE_SCHEMES[floorType] : undefined) ?? FLOOR_TYPE_SCHEMES.green;
  const availableTypes = floorConfig?.availableTypes
    ?? floor?.productions.map((p) => p.typeId).filter((id): id is string => id !== null) ?? [];
  const discount = getFloorDiscount(workers, floorId);
  const specialistBonus = getFloorSpecialistBonus(workers, floorId);
  const deliveryLockUntil = floor.productions.reduce((maxEndAt, p) => {
    if (p.stage !== 'DELIVERING' || !p.typeId) return maxEndAt;
    const tc = gameConfig.productionTypes[p.typeId];
    if (!tc) return maxEndAt;
    return Math.max(maxEndAt, p.stageStartedAt + tc.deliveryDuration);
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
  const effectiveColor = isDark ? scheme.dark.color : scheme.color;
  const effectiveBodyColor = isDark ? scheme.dark.bodyColor : scheme.bodyColor;
  const effectiveCardBg = isDark ? scheme.dark.cardBg : scheme.cardBg;
  const effectiveNameColor = isDark ? scheme.dark.nameColor : scheme.nameColor;

  return (
    <View style={[styles.floorContainer, isDark && styles.floorContainerDark]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: effectiveColor }]}>
        <View style={[styles.headerEdge, { backgroundColor: shadeColor(effectiveColor, -22) }]} />
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
      <View style={[styles.cardsContainer, { backgroundColor: effectiveBodyColor }]}>
        {floor.productions.map((production, idx) => {
          const slotWorker = getWorkerForSlot(workers, floorId, idx);
          const effectiveProduction =
            idx === 0 && onboardingForceSellingSlot0 && (production.stage === 'IDLE' || production.stage === 'SELLING')
              ? { ...production, stage: 'SELLING' as const, stageStartedAt: 0 }
              : production;
          const onboardingTargetIdx = onboardingStep === 'assign_worker' ? 1 : 0;
          return (
            <View
              key={idx}
              style={{ flex: 1 }}
              ref={idx === onboardingTargetIdx && onboardingSlot0Ready ? slot0Ref : undefined}
              collapsable={false}
            >
            <ProductionCard
              production={effectiveProduction}
              balance={balance}
              floorId={floorId}
              floorType={floorType}
              slotIdx={idx}
              floorAvailableTypes={availableTypes}
              cardBg={effectiveCardBg}
              nameColor={effectiveNameColor}
              productTitle={tContent(`productionTypes.${availableTypes[idx]}.displayName`, {
                defaultValue: availableTypes[idx] ?? t('floorCard.productFallback', { index: idx + 1 }),
              })}
              productImage={PRODUCT_IMAGES[availableTypes[idx]] ?? PRODUCT_IMAGES[availableTypes[0]]}
              worker={slotWorker}
              floorDiscount={discount}
              specialistBonus={specialistBonus}
              accentColor={effectiveColor}
              onHire={onHireSlot}
              deliveryLockUntil={deliveryLockUntil}
              gems={gems}
              onLongPress={
                slotWorker
                  ? () => openProductionDetailModal(floorId, idx)
                  : undefined
              }
            />
            </View>
          );
        })}
      </View>

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
