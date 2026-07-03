import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import ProductionCard from './ProductionCard';
import { useFloor, useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot, getFloorDiscount } from '../../shared/engine/workerUtils';
import { shadeColor } from '../utils/color';
import type { ImageSource } from 'expo-image';

// Floor color schemes matching the design
export interface FloorColorScheme {
  headerColors: [string, string];
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  accent: string;
  stars: number;
}

export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = {
  2: {
    headerColors: ['#72D361', '#349523'],
    headerShadowColor: 'rgba(0,83,0,0.4)',
    bodyColor: '#D0EBCB',
    cardBg: '#E8F5E5',
    nameColor: '#117200',
    accent: '#20810F',
    stars: 0,
  },
  3: {
    headerColors: ['#5C9FFF', '#1E61D0'],
    headerShadowColor: 'rgba(0,31,142,0.4)',
    bodyColor: '#CADDFC',
    cardBg: '#E5EEFD',
    nameColor: '#003EAD',
    accent: '#0A4DBC',
    stars: 0,
  },
  4: {
    headerColors: ['#FFD057', '#D09219'],
    headerShadowColor: 'rgba(142,80,0,0.4)',
    bodyColor: '#FCEBC9',
    cardBg: '#FDF5E4',
    nameColor: '#AD6F00',
    accent: '#BC7E05',
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
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0)']}
          style={styles.headerGloss}
        />
        <View style={[styles.headerEdge, { backgroundColor: shadeColor(scheme.headerColors[1], -22) }]} />
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
      <LinearGradient
        colors={[shadeColor(scheme.bodyColor, -10), scheme.bodyColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.cardsContainer}
      >
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
              accentColor={scheme.accent}
              onHire={onHireSlot}
            />
          );
        })}
      </LinearGradient>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 31,
    paddingHorizontal: 12,
  },
  headerGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
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
});
