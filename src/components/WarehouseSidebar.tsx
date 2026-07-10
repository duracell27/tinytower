import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import WarehouseSheet from './WarehouseSheet';

export default function WarehouseSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={styles.sidebar}>
        <Pressable onPress={() => setOpen(true)} style={styles.iconWrap} hitSlop={8}>
          <Image
            source={require('../../assets/img/menu/werehouse.png')}
            style={{ width: 35, height: 35 }}
            contentFit="contain"
          />
        </Pressable>
      </View>

      <WarehouseSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 90,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
