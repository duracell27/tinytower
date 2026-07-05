import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import WarehouseSheet from '../../src/components/WarehouseSheet';

export default function MenuScreen() {
  const [inventoryOpen, setInventoryOpen] = useState(false);

  return (
    <ImageBackground
      source={require('../../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <Text style={styles.heading}>Меню</Text>

        <Pressable style={styles.menuItem} onPress={() => setInventoryOpen(true)}>
          <Image
            source={require('../../assets/img/werehouse.png')}
            style={{ width: 32, height: 32 }}
            contentFit="contain"
          />
          <Text style={styles.menuLabel}>Інвентар</Text>
        </Pressable>
      </View>

      <WarehouseSheet visible={inventoryOpen} onClose={() => setInventoryOpen(false)} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: 20,
  },
  heading: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 26,
    color: '#2A3344',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2A3344',
  },
});
