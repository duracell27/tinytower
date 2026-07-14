import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatNum } from '../utils/format';
import type { QuickActionMode, FloorActionInfo } from '../utils/quickAction';

interface Props {
  mode: QuickActionMode;
  info: FloorActionInfo | null;
  onPress: () => void;
}

const MODE_COLORS: Record<QuickActionMode, { colors: [string, string]; shadow: string }> = {
  collect: { colors: ['#72C24F', '#4A8A2E'], shadow: '#2E6018' },
  list:    { colors: ['#F2AC40', '#C9760F'], shadow: '#8A4A00' },
  buy:     { colors: ['#4A90D9', '#2563EB'], shadow: '#1A3E9A' },
  hire:    { colors: ['#D96E8A', '#B84E6A'], shadow: '#7A2840' },
};

export default function QuickActionBar({ mode, info, onPress }: Props) {
  const { t: tContent } = useTranslation('gameContent');
  const { colors, shadow } = MODE_COLORS[mode];

  const label = (() => {
    if (!info) return '…';
    switch (info.mode) {
      case 'collect':
        return `Зібрати монети ($${formatNum(info.totalCoins)})`;
      case 'list':
        return info.count === 1 ? 'Викласти товар' : `Викласти товар (${info.count} шт)`;
      case 'buy': {
        const productName = tContent(`productionTypes.${info.typeId}.displayName`, {
          defaultValue: info.typeId,
        });
        return `Закупити ${productName} ($${formatNum(info.buyCost)})`;
      }
      case 'hire':
        return 'Знайти робітника';
    }
  })();

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient colors={colors} style={styles.btnGradient}>
          <Text style={styles.btnLabel} numberOfLines={1}>{label}</Text>
        </LinearGradient>
        <View style={[styles.btnShadow, { backgroundColor: shadow }]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 90,
    paddingTop: 10,
    backgroundColor: 'rgba(248,252,248,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  btn: {
    borderRadius: 18,
    overflow: 'visible',
  },
  btnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    zIndex: 1,
  },
  btnLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.3,
  },
  btnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
});
