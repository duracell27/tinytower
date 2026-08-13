import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const { width: SCREEN_W } = Dimensions.get('window');

export default function WarehouseFullModal() {
  const { t } = useTranslation('tabs');
  const visible = useGameStore((s) => s.warehouseFullNotice);
  const dismiss = useGameStore((s) => s.dismissWarehouseFullNotice);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable style={styles.scrim} onPress={dismiss}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.avatarWrap}>
              <Image
                source={require('../../assets/img/menu/werehouse.png')}
                style={{ width: 38, height: 38 }}
                contentFit="contain"
              />
            </View>
            <View style={styles.info}>
              <Text style={styles.title}>{t('warehouse.fullPopup.title')}</Text>
              <Text style={styles.subtitle}>{t('warehouse.fullPopup.subtitle')}</Text>
            </View>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient colors={['#6B7A8D', '#4A5568']} style={styles.btnGradient}>
                <Text style={styles.btnText}>{t('warehouse.fullPopup.open')}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={dismiss} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>{t('warehouse.fullPopup.dismiss')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: SCREEN_W * 0.85,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  info: { alignItems: 'center', gap: 3 },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#2A3344',
  },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    color: '#9BA3B0',
    marginTop: 2,
    textAlign: 'center',
  },
  btn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 12 },
  btnGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  dismissBtn: { paddingVertical: 8 },
  dismissText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#9BA3B0',
  },
});
