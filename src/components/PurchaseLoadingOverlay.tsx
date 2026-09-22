import React from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import LocaleText from './LocaleText';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  visible: boolean;
}

export default function PurchaseLoadingOverlay({ visible }: Props) {
  const theme = useAppTheme();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: theme.isDark ? '#1E1030' : '#FFFFFF' }]}>
          <ActivityIndicator size="large" color="#9A6FD0" />
          <LocaleText style={[styles.text, { color: theme.isDark ? '#E0D0FF' : '#2D1A4E' }]}>
            {'Очікуємо підтвердження платежу...'}
          </LocaleText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    minWidth: 220,
    elevation: 8,
  },
  text: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 200,
  },
});
