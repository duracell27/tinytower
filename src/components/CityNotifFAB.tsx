import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useAppTheme } from '../hooks/useAppTheme';

const CITY_ICON  = require('../../assets/img/city/cityBuildings.png');
const NOTIF_ICON = require('../../assets/img/city/cityNotice.png');

interface Props {
  slot: number; // 0 = bottom 96, each step adds 62px
  onPress: () => void;
}

export default function CityNotifFAB({ slot, onPress }: Props) {
  const theme = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom: 96 + slot * 62,
          backgroundColor: theme.surface,
          borderColor: theme.isDark ? theme.divider : 'rgba(255,255,255,0.9)',
        },
        pressed && { opacity: 0.82 },
      ]}
    >
      <Image source={CITY_ICON}  style={styles.mainIcon}    contentFit="contain" />
      <View style={[styles.badgeIcon, { backgroundColor: theme.isDark ? '#0D1F2D' : '#FFFFFF', borderColor: theme.surface }]}>
        <Image source={NOTIF_ICON} style={styles.badgeIconImg} contentFit="contain" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  mainIcon: { width: 28, height: 28 },
  badgeIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconImg: { width: 13, height: 13 },
});
