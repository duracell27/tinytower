import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface TopBarProps {
  name: string;
  level: number;
  xp: string;
  initial: string;
  coins: string;
  gems: string;
}

export default function TopBar({ name, level, xp, initial, coins, gems }: TopBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.glassPanel}>
        {/* Sheen overlay */}
        <LinearGradient
          colors={['rgba(255,255,255,0.45)', 'transparent']}
          style={styles.sheen}
        />
        <View style={styles.content}>
          {/* Avatar + level */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarRing}>
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
            <View style={styles.nameSection}>
              <Text style={styles.nameText}>{name}</Text>
              <Text style={styles.xpText}>
                Level {level} · {xp} XP
              </Text>
            </View>
          </View>

          {/* Currencies */}
          <View style={styles.currencySection}>
            <View style={styles.coinBadge}>
              <View style={styles.coinIcon} />
              <Text style={styles.coinText}>{coins}</Text>
            </View>
            <View style={styles.gemBadge}>
              <View style={styles.gemIcon} />
              <Text style={styles.gemText}>{gems}</Text>
            </View>
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
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3.5,
    borderColor: '#5FC24E',
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(70,140,50,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
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
  nameSection: {
    flexDirection: 'column',
    gap: 3,
  },
  nameText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#27331F',
    lineHeight: 17,
  },
  xpText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11,
    color: '#7C8A6E',
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
