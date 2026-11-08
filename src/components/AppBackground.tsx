import React from 'react';
import { StyleSheet, useColorScheme, ImageBackground } from 'react-native';

const BG_LIGHT = require('../../assets/img/backgroung/fallWhite.png');
const BG_DARK  = require('../../assets/img/backgroung/fallBlack.png');

export default function AppBackground({ children, style }: {
  children: React.ReactNode;
  style?: object;
}) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return (
    <ImageBackground
      source={isDark ? BG_DARK : BG_LIGHT}
      style={[styles.fill, style]}
      resizeMode="cover"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
