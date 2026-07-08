import React from 'react';
import { Image } from 'expo-image';

export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/img/coin.png')}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

export function GemIcon({ size = 14 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/img/diamond.png')}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}
