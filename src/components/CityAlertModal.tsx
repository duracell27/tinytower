import React, { useEffect, useState } from 'react';
import { View, Modal, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import LocaleText from './LocaleText';
import { useGameStore } from '../stores/gameStore';
import { useAppTheme } from '../hooks/useAppTheme';

const CITY_ICON = require('../../assets/img/city/cityBuildings.png');
const GEM_ICON = require('../../assets/img/diamond.png');

const { width: SCREEN_W } = Dimensions.get('window');

function AlertContent({ onDismiss }: { onDismiss: () => void }) {
  const alert = useGameStore((s) => s.cityAlert)!;
  const theme = useAppTheme();
  const styles = getStyles(theme);

  const isSuccess = alert.type === 'success';
  const isInfo = alert.type === 'info';

  const iconBg = isSuccess
    ? (theme.isDark ? '#1A3A20' : '#E8F8ED')
    : isInfo
      ? (theme.isDark ? '#1A2A3A' : '#EEF5FF')
      : (theme.isDark ? '#3A1A1A' : '#FFF0EE');
  const iconColor = isSuccess ? '#2E9E52' : isInfo ? '#4A8FD9' : '#D93025';
  const iconLabel = isSuccess ? '✓' : isInfo ? 'i' : '!';

  return (
    <View style={[styles.card, { backgroundColor: theme.isDark ? '#1A2E3E' : '#FFFFFF' }]}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <LocaleText style={[styles.iconLabel, { color: iconColor }]}>{iconLabel}</LocaleText>
      </View>
      <LocaleText style={[styles.message, { color: theme.text }]}>{alert.message}</LocaleText>
      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <LinearGradient
          colors={isSuccess ? ['#2E9E52', '#237A40'] : isInfo ? ['#4A8FD9', '#3070BB'] : ['#9A6FD0', '#7B52B0']}
          style={styles.closeBtnGradient}
        >
          <LocaleText style={styles.closeBtnText}>OK</LocaleText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function ConfirmContent({ onDismiss }: { onDismiss: () => void }) {
  const confirm = useGameStore((s) => s.cityConfirm)!;
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await Promise.resolve(confirm.onConfirm());
    } finally {
      setLoading(false);
      onDismiss();
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.isDark ? '#1A2E3E' : '#FFFFFF' }]}>
      <View style={[styles.iconCircle, { backgroundColor: confirm.danger
        ? (theme.isDark ? '#3A1A1A' : '#FFF0EE')
        : (theme.isDark ? '#2A1A3A' : '#F5EEFF') }]}>
        {confirm.danger ? (
          <LocaleText style={[styles.iconLabel, { color: '#D93025', fontSize: 26 }]}>!</LocaleText>
        ) : (
          <Image source={CITY_ICON} style={styles.cityIcon} contentFit="contain" />
        )}
      </View>
      <LocaleText style={[styles.confirmTitle, { color: theme.text }]}>{confirm.title}</LocaleText>
      <View style={styles.messageRow}>
        <LocaleText style={[styles.confirmMessage, { color: theme.isDark ? '#8A9AA8' : '#5A6A78' }]}>
          {confirm.message}
        </LocaleText>
        {confirm.gems != null && (
          <View style={[styles.gemCostRow, { backgroundColor: theme.isDark ? '#2A1A3A' : '#F5EEFF' }]}>
            <LocaleText style={[styles.gemCostAmount, { color: theme.isDark ? '#C8A8F0' : '#7B52B0' }]}>
              {confirm.gems.toLocaleString()}
            </LocaleText>
            <Image source={GEM_ICON} style={styles.gemCostIcon} contentFit="contain" />
          </View>
        )}
      </View>
      <View style={styles.buttonsRow}>
        <Pressable
          onPress={onDismiss}
          disabled={loading}
          style={({ pressed }) => [styles.cancelBtn, { backgroundColor: theme.isDark ? '#243040' : '#EEF3F8', opacity: pressed ? 0.7 : 1 }]}
        >
          <LocaleText style={[styles.cancelText, { color: theme.isDark ? '#DDE8D8' : '#3A5068' }]}>
            ✕
          </LocaleText>
        </Pressable>
        <Pressable
          onPress={handleConfirm}
          disabled={loading}
          style={({ pressed }) => [styles.confirmBtnWrap, { opacity: (pressed || loading) ? 0.7 : 1 }]}
        >
          <LinearGradient
            colors={confirm.danger ? ['#E54030', '#C42A20'] : ['#9A6FD0', '#7B52B0']}
            style={[styles.confirmBtnGradient, { flex: 1 }]}
          >
            <LocaleText style={styles.closeBtnText}>
              {loading ? '...' : confirm.confirmText}
            </LocaleText>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

export default function CityAlertModal({ asOverlay = false }: { asOverlay?: boolean }) {
  const alert = useGameStore((s) => s.cityAlert);
  const confirm = useGameStore((s) => s.cityConfirm);
  const clearCityAlert = useGameStore((s) => s.clearCityAlert);
  const clearCityConfirm = useGameStore((s) => s.clearCityConfirm);

  const visible = alert !== null || confirm !== null;
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 180 });
      scale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = 0;
      scale.value = 0.5;
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const dismiss = alert ? clearCityAlert : clearCityConfirm;

  const inner = (
    <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      <Animated.View style={[styles.cardWrap, cardStyle]}>
        {alert ? (
          <AlertContent onDismiss={dismiss} />
        ) : (
          <ConfirmContent onDismiss={dismiss} />
        )}
      </Animated.View>
    </Animated.View>
  );

  if (asOverlay) {
    return <View style={StyleSheet.absoluteFill}>{inner}</View>;
  }

  return (
    <Modal transparent animationType="none" onRequestClose={dismiss}>
      {inner}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  cardWrap: {
    width: SCREEN_W * 0.82,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: 'rgba(30,50,80,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 28,
    lineHeight: 32,
  },
  message: {
    fontFamily: 'Geologica_400Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmMessage: {
    fontFamily: 'Geologica_400Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  closeBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  closeBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
  },
  closeBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  cancelBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cancelText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
  },
  confirmBtnWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
  },
  cityIcon: {
    width: 40,
    height: 40,
  },
  gemCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  gemCostAmount: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
  },
  gemCostIcon: {
    width: 22,
    height: 22,
  },
});

function getStyles(_theme: ReturnType<typeof useAppTheme>) {
  return styles;
}
