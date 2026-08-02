import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const { width: SCREEN_W } = Dimensions.get('window');

function HotelIcon({ size = 18, color = '#A8475F' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 22V12h6v10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function HotelFullNoticeModal() {
  const { t } = useTranslation('lobby');
  const visible = useGameStore((s) => s.hotelFullNotice);
  const dismiss = useGameStore((s) => s.dismissHotelFullNotice);
  const activeSheetCount = useGameStore((s) => s.activeSheetCount);

  const handleGoToHotel = () => {
    dismiss();
    useGameStore.setState({ pendingOpenHotel: true });
  };

  return (
    <Modal visible={visible && activeSheetCount === 0} transparent animationType="fade" onRequestClose={dismiss}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable style={styles.scrim} onPress={dismiss}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.avatarWrap}>
              <HotelIcon size={32} color="#A8475F" />
            </View>
            <View style={styles.info}>
              <Text style={styles.title}>{t('hotelFullPopup.title')}</Text>
              <Text style={styles.subtitle}>{t('hotelFullPopup.subtitle')}</Text>
            </View>
            <Pressable
              onPress={handleGoToHotel}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient colors={['#C9637E', '#A8475F']} style={styles.btnGradient}>
                <HotelIcon size={16} color="#fff" />
                <Text style={styles.btnText}>{t('hotelFullPopup.goToHotel')}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={dismiss} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>{t('hotelFullPopup.dismiss')}</Text>
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
    backgroundColor: '#FDEEF2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  info: {
    alignItems: 'center',
    gap: 3,
  },
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
  btn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12,
  },
  btnGradient: {
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  dismissBtn: {
    paddingVertical: 8,
  },
  dismissText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#9BA3B0',
  },
});
