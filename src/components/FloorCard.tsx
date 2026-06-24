import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ProductionCard from './ProductionCard';
import { useFloor } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import type { ImageSource } from 'expo-image';

// Floor color schemes matching the design
export interface FloorColorScheme {
  headerColors: [string, string];
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  displayName: string;
  stars: number;
}

export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = {
  2: {
    headerColors: ['#74C44F', '#5DA83C'],
    headerShadowColor: 'rgba(40,70,25,0.4)',
    bodyColor: '#D2EAB4',
    cardBg: '#F2F8E9',
    nameColor: '#5B963A',
    displayName: 'КОНДИТЕРСЬКА',
    stars: 4,
  },
  3: {
    headerColors: ['#43BCAA', '#2E9E8E'],
    headerShadowColor: 'rgba(20,70,60,0.4)',
    bodyColor: '#BEE6DD',
    cardBg: '#EBF7F3',
    nameColor: '#2E9384',
    displayName: 'ПРАЛЬНЯ',
    stars: 4,
  },
  4: {
    headerColors: ['#F2B838', '#E09E10'],
    headerShadowColor: 'rgba(120,80,0,0.4)',
    bodyColor: '#F7E4AC',
    cardBg: '#FDF8E9',
    nameColor: '#B5871E',
    displayName: "КАВ'ЯРНЯ",
    stars: 4,
  },
  5: {
    headerColors: ['#E87C5E', '#D4603D'],
    headerShadowColor: 'rgba(120,40,20,0.4)',
    bodyColor: '#F5D0C0',
    cardBg: '#FDF0EA',
    nameColor: '#C25A3A',
    displayName: 'ЕЛЕКТРОНІКА',
    stars: 3,
  },
  6: {
    headerColors: ['#7C6CD6', '#6350C2'],
    headerShadowColor: 'rgba(60,30,120,0.4)',
    bodyColor: '#D4CCF0',
    cardBg: '#EDE9F8',
    nameColor: '#6B52B5',
    displayName: 'ГАДЖЕТИ',
    stars: 3,
  },
};

// Product names and images for each floor's 3 slots
const PRODUCT_IMAGES: Record<number, { title: string; image: ImageSource }[]> = {
  2: [
    { title: 'Булки', image: require('../../assets/products/bulky.png') },
    { title: 'Пирожені', image: require('../../assets/products/cupcake.png') },
    { title: 'Торти', image: require('../../assets/products/cake.png') },
  ],
  3: [
    { title: 'Прання', image: require('../../assets/products/wash.png') },
    { title: 'Сушка', image: require('../../assets/products/dry.png') },
    { title: 'Відбілювання', image: require('../../assets/products/bleach.png') },
  ],
  4: [
    { title: 'Кава', image: require('../../assets/products/coffee.png') },
    { title: 'Млинці', image: require('../../assets/products/pancake.png') },
    { title: 'Десерти', image: require('../../assets/products/dessert.png') },
  ],
  5: [
    { title: 'Планшети', image: require('../../assets/products/bulky.png') },
    { title: 'Навушники', image: require('../../assets/products/cupcake.png') },
    { title: 'Кабелі', image: require('../../assets/products/cake.png') },
  ],
  6: [
    { title: 'Смартфони', image: require('../../assets/products/coffee.png') },
    { title: 'Чохли', image: require('../../assets/products/pancake.png') },
    { title: 'Зарядки', image: require('../../assets/products/dessert.png') },
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
}

function FloorCardInner({ floorId, balance, now }: FloorCardProps) {
  const floor = useFloor(floorId);
  const scheme = FLOOR_SCHEMES[floorId] || FLOOR_SCHEMES[1];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const availableTypes = floorConfig?.availableTypes ?? [];
  const products = PRODUCT_IMAGES[floorId] || PRODUCT_IMAGES[1];

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
          {scheme.displayName}
        </Text>
        <Stars count={scheme.stars} />
      </LinearGradient>

      {/* Production cards */}
      <View style={[styles.cardsContainer, { backgroundColor: scheme.bodyColor }]}>
        {floor.productions.map((production, idx) => (
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
            productTitle={products[idx]?.title ?? `Товар ${idx + 1}`}
            productImage={products[idx]?.image ?? products[0].image}
          />
        ))}
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
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 1,
    marginLeft: 'auto',
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
});
