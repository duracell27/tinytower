import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { shadeColor } from '../utils/color';

const BANNER_COLOR = '#E67E22';
const BANNER_BG = shadeColor(BANNER_COLOR, 45);

interface UnderConstructionBannerProps {
  floorId: number;
  endsAt: number;
  now: number;
  onOpenFloor: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function UnderConstructionBanner({
  floorId,
  endsAt,
  now,
  onOpenFloor,
}: UnderConstructionBannerProps) {
  const timeLeft = Math.max(0, endsAt - now);
  const isReady = timeLeft === 0;

  return (
    <View style={[styles.ribbon, { borderColor: BANNER_COLOR, backgroundColor: BANNER_BG }]}>
      <View style={styles.ribbonLeft}>
        <Image
          source={require('../../assets/img/workers/builder.png')}
          style={{ width: 28, height: 28 }}
          contentFit="contain"
        />
        <Text style={[styles.ribbonTitle, { color: BANNER_COLOR }]} numberOfLines={1}>
          {`Будується ${floorId} поверх`}
        </Text>
      </View>

      {isReady ? (
        <Pressable
          onPress={onOpenFloor}
          style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient colors={['#E67E22', '#C96A14']} style={styles.openBtnGradient}>
            <Text style={styles.openBtnText}>Відкрити поверх</Text>
          </LinearGradient>
          <View style={styles.openBtnShadow} />
        </Pressable>
      ) : (
        <View style={styles.timerPill}>
          <Text style={[styles.timerText, { color: BANNER_COLOR }]}>
            {formatCountdown(timeLeft)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  ribbonTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    flexShrink: 1,
  },
  timerPill: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  timerText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  openBtn: {
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  openBtnGradient: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 11,
    zIndex: 1,
  },
  openBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#fff',
  },
  openBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#A04000',
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
  },
});
