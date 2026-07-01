import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import ProductionCard from './ProductionCard';
import { useFloor, useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot, getFloorDiscount } from '../../shared/engine/workerUtils';
import type { ImageSource } from 'expo-image';

// Floor color schemes matching the design
export interface FloorColorScheme {
  headerColors: [string, string];
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  stars: number;
}

export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = {
  2: {
    headerColors: ['#74C44F', '#5DA83C'],
    headerShadowColor: 'rgba(40,70,25,0.4)',
    bodyColor: '#D2EAB4',
    cardBg: '#F2F8E9',
    nameColor: '#5B963A',
    stars: 0,
  },
  3: {
    headerColors: ['#43BCAA', '#2E9E8E'],
    headerShadowColor: 'rgba(20,70,60,0.4)',
    bodyColor: '#BEE6DD',
    cardBg: '#EBF7F3',
    nameColor: '#2E9384',
    stars: 0,
  },
  4: {
    headerColors: ['#F2B838', '#E09E10'],
    headerShadowColor: 'rgba(120,80,0,0.4)',
    bodyColor: '#F7E4AC',
    cardBg: '#FDF8E9',
    nameColor: '#B5871E',
    stars: 0,
  },
};

// Product images for each floor's 3 slots (display names come from the gameContent i18n namespace)
const PRODUCT_IMAGES: Record<number, { image: ImageSource }[]> = {
  2: [
    { image: require('../../assets/products/bulky.png') },
    { image: require('../../assets/products/cupcake.png') },
    { image: require('../../assets/products/cake.png') },
  ],
  3: [
    { image: require('../../assets/products/wash.png') },
    { image: require('../../assets/products/dry.png') },
    { image: require('../../assets/products/bleach.png') },
  ],
  4: [
    { image: require('../../assets/products/coffee.png') },
    { image: require('../../assets/products/pancake.png') },
    { image: require('../../assets/products/dessert.png') },
  ],
};

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
  now: number;
  onHireSlot?: (floorId: number, slotIdx: number) => void;
}

function FloorCardInner({ floorId, balance, now, onHireSlot }: FloorCardProps) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const floor = useFloor(floorId);
  const workers = useGameStore((s) => s.workers);
  const scheme = FLOOR_SCHEMES[floorId] || FLOOR_SCHEMES[1];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const availableTypes = floorConfig?.availableTypes ?? [];
  const products = PRODUCT_IMAGES[floorId] || PRODUCT_IMAGES[1];
  const discount = getFloorDiscount(workers, floorId);
  const floorName = tContent(`floors.${floorId}.name`, { defaultValue: `Floor ${floorId}` });

  return (
    <View style={styles.floorContainer}>
      {/* Header */}
      <LinearGradient
        colors={scheme.headerColors}
        style={styles.header}
      >
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
          <Stars count={scheme.stars} />
        </View>
      </LinearGradient>

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
              slotIdx={idx}
              floorAvailableTypes={availableTypes}
              cardBg={scheme.cardBg}
              nameColor={scheme.nameColor}
              productTitle={tContent(`productionTypes.${availableTypes[idx]}.displayName`, {
                defaultValue: availableTypes[idx] ?? t('floorCard.productFallback', { index: idx + 1 }),
              })}
              productImage={products[idx]?.image ?? products[0].image}
              worker={slotWorker}
              floorDiscount={discount}
              onHire={onHireSlot}
            />
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 31,
    paddingHorizontal: 12,
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
    gap: 7,
    padding: 9,
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
});
