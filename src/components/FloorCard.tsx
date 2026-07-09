import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import ProductionCard from './ProductionCard';
import { useFloor, useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot, getFloorDiscount } from '../../shared/engine/workerUtils';
import { shadeColor } from '../utils/color';
import type { ImageSource } from 'expo-image';

// Floor color schemes matching the design
export interface FloorColorScheme {
  color: string;
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  stars: number;
}

export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = {
  2: {
    color: '#5E8F42',
    headerShadowColor: 'rgba(0,83,0,0.4)',
    bodyColor: '#D0EBCB',
    cardBg: '#E8F5E5',
    nameColor: '#117200',
    stars: 0,
  },
  3: {
    color: '#2E6EC9',
    headerShadowColor: 'rgba(0,31,142,0.4)',
    bodyColor: '#CADDFC',
    cardBg: '#E5EEFD',
    nameColor: '#003EAD',
    stars: 0,
  },
  4: {
    color: '#E7A52B',
    headerShadowColor: 'rgba(142,80,0,0.4)',
    bodyColor: '#FCEBC9',
    cardBg: '#FDF5E4',
    nameColor: '#AD6F00',
    stars: 0,
  },
};

// Dynamic floor type color schemes (for floors not in gameConfig.floors)
const FLOOR_TYPE_SCHEMES: Record<string, FloorColorScheme> = {
  green:  FLOOR_SCHEMES[2],
  blue:   FLOOR_SCHEMES[3],
  yellow: FLOOR_SCHEMES[4],
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

// Product images keyed by production typeId
const PRODUCT_IMAGES: Record<string, ImageSource> = {
  buns:             require('../../assets/products/buns.png'),
  pastries:         require('../../assets/products/pastries.png'),
  cakes:            require('../../assets/products/cakes.png'),
  burgers:          require('../../assets/products/burgers.png'),
  fries:            require('../../assets/products/fries.png'),
  drinks:           require('../../assets/products/drinks.png'),
  milk:             require('../../assets/products/milk.png'),
  cheese:           require('../../assets/products/cheese.png'),
  yogurt:           require('../../assets/products/yogurt.png'),
  cards:            require('../../assets/products/cards.png'),
  loans:            require('../../assets/products/loans.png'),
  accounts:         require('../../assets/products/accounts.png'),
  scooters:         require('../../assets/products/scooters.png'),
  consoles:         require('../../assets/products/consoles.png'),
  tools:            require('../../assets/products/tools.png'),
  fillings:         require('../../assets/products/filings.png'),
  cleaning:         require('../../assets/products/cleaning.png'),
  braces:           require('../../assets/products/braces.png'),
  paintings:        require('../../assets/products/paintings.png'),
  sculptures:       require('../../assets/products/sculptures.png'),
  gallery:          require('../../assets/products/gallery.png'),
  karts:            require('../../assets/products/carts.png'),
  helmets:          require('../../assets/products/helmets.png'),
  track:            require('../../assets/products/track.png'),
  cocktails:        require('../../assets/products/cocktails.png'),
  hookahs:          require('../../assets/products/hookahs.png'),
  pizza:            require('../../assets/products/pizza.png'),
  canvas_shoes:     require('../../assets/products/canvasShoes.png'),
  sneakers:         require('../../assets/products/sneakers.png'),
  custom_sneakers:  require('../../assets/products/customSneakers.png'),
  tshirts:          require('../../assets/products/tshirts.png'),
  pants:            require('../../assets/products/pants.png'),
  jackets:          require('../../assets/products/jackets.png'),
  hoodies:          require('../../assets/products/hoodies.png'),
  sweatshirts:      require('../../assets/products/sweatshirts.png'),
  caps:             require('../../assets/products/caps.png'),
  phones:           require('../../assets/products/phones.png'),
  cases:            require('../../assets/products/cases.png'),
  screen_protectors:require('../../assets/products/screenProtectors.png'),
  pcs:              require('../../assets/products/pcs.png'),
  laptops:          require('../../assets/products/laptops.png'),
  monitors:         require('../../assets/products/monitors.png'),
  robots:           require('../../assets/products/robots.png'),
  drones:           require('../../assets/products/drones.png'),
  spare_parts:      require('../../assets/products/spareParts.png'),
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
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const dynamicFloorType = openedFloorTypes?.[String(floorId)];
  const scheme = FLOOR_SCHEMES[floorId] ?? (dynamicFloorType ? FLOOR_TYPE_SCHEMES[dynamicFloorType] : undefined) ?? FLOOR_SCHEMES[2];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType = floorConfig?.floorType ?? dynamicFloorType ?? null;
  const availableTypes = floorConfig?.availableTypes
    ?? floor?.productions.map((p) => p.typeId).filter((id): id is string => id !== null) ?? [];
  const discount = getFloorDiscount(workers, floorId);
  const floorName = tContent(`floors.${floorId}.name`, { defaultValue: `Floor ${floorId}` });

  return (
    <View style={styles.floorContainer}>
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
          <Stars count={scheme.stars} />
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
              accentColor={scheme.color}
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
});
