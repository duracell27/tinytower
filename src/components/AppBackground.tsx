import React from 'react';
import { StyleSheet, useColorScheme, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';

const BG_LIGHT = require('../../assets/img/backgroung/bg15.png');
const BG_DARK  = require('../../assets/img/backgroung/bgBlack.png');

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
      <BlurView
        intensity={isDark ? 20 : 40}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
