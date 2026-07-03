import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { shadeColor } from '../utils/color';

const BANNER_COLOR = '#5B6472';
const BANNER_BG = shadeColor(BANNER_COLOR, 45);

interface BuyFloorBannerProps {
  nextFloorNumber: number;
  price: number;
  currency: 'coins' | 'gems';
  onPress?: () => void;
}

function CurrencyIcon({ currency, size = 14 }: { currency: 'coins' | 'gems'; size?: number }) {
  if (currency === 'gems') {
    return <View style={[styles.gemIcon, { width: size, height: size }]} />;
  }
  return <View style={[styles.coinIcon, { width: size, height: size, borderRadius: size / 2 }]} />;
}

export default function BuyFloorBanner({ nextFloorNumber, price, currency, onPress }: BuyFloorBannerProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ribbon, pressed && styles.pressed]}>
      <View style={styles.ribbonLeft}>
        <Image
          source={require('../../assets/img/workers/builder.png')}
          style={{ width: 28, height: 28 }}
          contentFit="contain"
        />
        <Text style={styles.ribbonTitle} numberOfLines={1}>{`Купити ${nextFloorNumber} поверх`}</Text>
      </View>
      <View style={styles.ribbonPricePill}>
        <CurrencyIcon currency={currency} size={13} />
        <Text style={styles.ribbonPriceText}>{price}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  coinIcon: {
    backgroundColor: '#F2B330',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  gemIcon: {
    backgroundColor: '#3FB8D6',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: BANNER_BG,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: BANNER_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  ribbonTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: BANNER_COLOR,
    flexShrink: 1,
  },
  ribbonPricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 11,
  },
  ribbonPriceText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#4A3266',
  },
});
