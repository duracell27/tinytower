import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import WarehouseSheet from '../../src/components/WarehouseSheet';

export default function MenuScreen() {
  const [inventoryOpen, setInventoryOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Меню</Text>

      <Pressable style={styles.menuItem} onPress={() => setInventoryOpen(true)}>
        <Image
          source={require('../../assets/img/werehouse.png')}
          style={{ width: 32, height: 32 }}
          contentFit="contain"
        />
        <Text style={styles.menuLabel}>Інвентар</Text>
      </Pressable>

      <WarehouseSheet visible={inventoryOpen} onClose={() => setInventoryOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
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
