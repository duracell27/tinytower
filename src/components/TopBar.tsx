import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { CoinIcon, GemIcon } from './CurrencyIcons';

interface TopBarProps {
  name: string;
  level: number;
  xp: number;
  xpForNextLevel: number;
  initial: string;
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

export default function TopBar({ name, level, xp, xpForNextLevel, initial, coins, gems, revenuePerMin, onDevAddGems }: TopBarProps) {
  const progress = xpForNextLevel > 0 ? xp / xpForNextLevel : 0;

  return (
    <View style={styles.container}>
      <View style={styles.glassPanel}>
        <LinearGradient
          colors={['rgba(255,255,255,0.45)', 'transparent']}
          style={styles.sheen}
        />
        <View style={styles.content}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <ProgressRing progress={progress} size={50} />
              <LinearGradient
                colors={['#74D3C4', '#3FA9A0']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.avatarInner}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>{level}</Text>
              </View>
            </View>
            <View style={styles.nameColumn}>
              <Text style={styles.nameText}>{name}</Text>
              {revenuePerMin !== undefined && (
                <View style={styles.revenuePill}>
                  <CoinIcon size={12} />
                  <Text style={styles.revenuePillText}>{revenuePerMin} /min</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.currencySection}>
            <View style={styles.coinBadge}>
              <CoinIcon size={18} />
              <Text style={styles.coinText}>{coins}</Text>
            </View>
            <Pressable style={styles.gemBadge} onLongPress={onDevAddGems} delayLongPress={800}>
              <GemIcon size={14} />
              <Text style={styles.gemText}>{gems}</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    shadowColor: 'rgba(70,90,55,1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    zIndex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 21,
    color: '#fff',
    textShadowColor: 'rgba(20,90,80,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    fontSize: 9,
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
  coinIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F2B330',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(180,130,30,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
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
  gemIcon: {
    width: 14,
    height: 14,
    backgroundColor: '#3FB8D6',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  gemText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2592AB',
  },
});
