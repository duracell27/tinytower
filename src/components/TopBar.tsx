import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { GlassView } from 'expo-glass-effect';
import Svg, { Circle } from 'react-native-svg';
import { CoinIcon, GemIcon } from './CurrencyIcons';
import { getUserIcon } from '../utils/userIcon';
import { useAppTheme } from '../hooks/useAppTheme';

interface TopBarProps {
  name: string;
  level: number;
  xp: number;
  xpForNextLevel: number;
  coins: string;
  gems: string;
  revenuePerMin?: number;
  onDevAddGems?: () => void;
}

function ProgressRing({ progress, size = 50 }: { progress: number; size?: number }) {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  return (
    <Svg width={size} height={size} style={styles.progressRing}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(60,120,40,0.14)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#3FA535"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function TopBar({ name, level, xp, xpForNextLevel, coins, gems, revenuePerMin, onDevAddGems }: TopBarProps) {
  const progress = xpForNextLevel > 0 ? xp / xpForNextLevel : 0;
  const theme = useAppTheme();

  const panelContent = (
    <>
      <View style={styles.content}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <ProgressRing progress={progress} size={50} />
            <Image
              source={getUserIcon(level)}
              style={styles.avatarInner}
              contentFit="cover"
            />
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{level}</Text>
            </View>
          </View>
          <View style={styles.nameColumn}>
            <Text style={[styles.nameText, { color: theme.text }]}>{name}</Text>
            {revenuePerMin !== undefined && (
              <View style={[styles.revenuePill, { backgroundColor: theme.surfaceElevated }]}>
                <CoinIcon size={12} />
                <Text style={styles.revenuePillText}>{revenuePerMin} /min</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.currencySection}>
          <View style={[styles.coinBadge, { backgroundColor: theme.surfaceElevated }]}>
            <CoinIcon size={18} />
            <Text style={styles.coinText}>{coins}</Text>
          </View>
          <Pressable style={[styles.gemBadge, { backgroundColor: theme.surfaceElevated }]} onLongPress={onDevAddGems} delayLongPress={800}>
            <GemIcon size={14} />
            <Text style={styles.gemText}>{gems}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {Platform.OS === 'android' ? (
        <View style={[styles.glassPanel, styles.androidPanel, { backgroundColor: theme.topBarBg, borderColor: theme.topBarBorder }]}>
          {panelContent}
        </View>
      ) : (
        <GlassView glassEffectStyle="regular" style={[styles.glassPanel, { backgroundColor: theme.topBarBg, borderColor: theme.topBarBorder }]}>
          {panelContent}
        </GlassView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    left: 14,
    right: 14,
    zIndex: 40,
  },
  glassPanel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(238,248,230,0.80)',
    shadowColor: 'rgba(40,70,35,1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },
  androidPanel: {
    backgroundColor: 'rgba(220,237,210,0.92)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatarWrapper: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
  },
  avatarInner: {
    width: 39,
    height: 39,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -3,
    alignSelf: 'center',
    backgroundColor: '#3FA535',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 7,
    shadowColor: 'rgba(40,110,30,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  levelText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  nameText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#27331F',
    lineHeight: 17,
  },
  nameColumn: {
    flexDirection: 'column',
    gap: 3,
  },
  revenuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingVertical: 2,
    paddingLeft: 5,
    paddingRight: 7,
    borderRadius: 10,
    shadowColor: 'rgba(120,110,60,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  revenuePillText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#C28A22',
  },
  currencySection: {
    flexDirection: 'column',
    gap: 6,
    alignItems: 'flex-end',
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingLeft: 5,
    paddingRight: 9,
    borderRadius: 13,
    shadowColor: 'rgba(120,110,60,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  coinText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#C28A22',
  },
  gemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 9,
    borderRadius: 13,
    shadowColor: 'rgba(60,120,140,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  gemText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2592AB',
  },
});
