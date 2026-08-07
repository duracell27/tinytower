import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';

interface InfoSectionProps {
  icon: ReturnType<typeof require>;
  title: string;
  text: string;
  accentColor?: string;
  isLast?: boolean;
}

export function InfoSection({ icon, title, text, accentColor = 'rgba(100,110,130,0.18)', isLast = false }: InfoSectionProps) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={[styles.section, !isLast && { borderBottomWidth: 1, borderBottomColor: accentColor }]}>
      <Image source={icon} style={styles.icon} contentFit="contain" />
      <View style={styles.body}>
        <Text style={[styles.title, isDark && { color: '#DDE8D8' }]}>{title}</Text>
        <Text style={[styles.text, isDark && { color: '#8A9A80' }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  icon: {
    width: 28,
    height: 28,
    marginTop: 1,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2A3344',
  },
  text: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: '#6A7485',
    lineHeight: 19,
  },
});
