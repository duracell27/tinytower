import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

interface WelcomeScreenProps {
  onPlay: () => void;
  onLogin: () => void;
  onRegister: () => void;
}

export default function WelcomeScreen({ onPlay, onLogin, onRegister }: WelcomeScreenProps) {
  return (
    <View style={styles.container}>
      {/* Background image */}
      <Image
        source={require('../../assets/welcome-bg.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={{ bottom: 0, left: '50%' }}
      />

      {/* Legibility scrim */}
      <LinearGradient
        colors={[
          'rgba(30,60,90,0.14)',
          'rgba(30,60,90,0)',
          'rgba(15,35,25,0)',
          'rgba(15,35,25,0.32)',
          'rgba(12,30,20,0.58)',
        ]}
        locations={[0, 0.2, 0.56, 0.8, 1]}
        style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
        pointerEvents="none"
      />

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoTiny}>TINY</Text>
        <Text style={styles.logoTower}>TOWER</Text>
      </View>

      {/* Speech bubble */}
      <View style={styles.bubbleWrapper}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>
            {'Будуй вище,\nзаробляй більше '}
          </Text>
          {/* Coin inline */}
          <View style={styles.bubbleCoin} />
          {/* Tail */}
          <View style={styles.bubbleTail} />
        </View>
      </View>

      {/* Stat chips */}
      <View style={styles.chipsContainer}>
        {/* Coins chip */}
        <View style={styles.chip}>
          <View style={styles.coinIcon} />
          <Text style={styles.chipValue}>2 480</Text>
        </View>

        {/* Gems chip */}
        <View style={styles.chip}>
          <View style={styles.gemIconWrap}>
            <View style={styles.gemIcon} />
          </View>
          <Text style={styles.chipValue}>143</Text>
        </View>

        {/* Floors chip */}
        <View style={styles.chip}>
          <View style={styles.floorsIconWrap}>
            {['#6FBF46', '#8FD86A', '#6FBF46'].map((c, i) => (
              <View
                key={i}
                style={[
                  styles.floorBar,
                  { backgroundColor: c },
                ]}
              />
            ))}
          </View>
          <View>
            <Text style={styles.chipValue}>3</Text>
            <Text style={styles.floorsLabel}>поверхи</Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        {/* Play button */}
        <Pressable onPress={onPlay} style={styles.playButton}>
          <LinearGradient
            colors={['#62C84F', '#3FA535']}
            style={styles.playButtonGradient}
          >
            {/* Play triangle */}
            <View style={styles.playTriangle} />
            <Text style={styles.playButtonText}>Почати будувати</Text>
          </LinearGradient>
        </Pressable>

        {/* "або" divider */}
        <View style={styles.orContainer}>
          <Text style={styles.orText}>або</Text>
        </View>

        {/* Login + Register buttons row */}
        <View style={styles.secondaryRow}>
          <Pressable onPress={onLogin} style={styles.secondaryButton}>
            <Text style={styles.secondaryEmoji}>👤</Text>
            <Text style={styles.secondaryLabel}>Увійти</Text>
          </Pressable>

          <Pressable onPress={onRegister} style={styles.secondaryButton}>
            <View style={styles.plusIconWrap}>
              <View style={styles.plusH} />
              <View style={styles.plusV} />
            </View>
            <Text style={styles.secondaryLabel}>Реєстрація</Text>
          </Pressable>
        </View>

        {/* Terms */}
        <Text style={styles.termsText}>
          {'Продовжуючи, ви приймаєте наші '}
          <Text style={styles.termsUnderline}>Умови</Text>
          {' та '}
          <Text style={styles.termsUnderline}>Політику</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },

  /* Logo */
  logoContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
  },
  logoTiny: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 52,
    letterSpacing: 1,
    color: '#fff',
    // Approximate WebkitTextStroke with text shadows
    textShadowColor: '#3E8FD8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
    // Layered shadow for stroke + drop shadow effect:
    // RN only supports single textShadow, so we combine
  },
  logoTower: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 52,
    letterSpacing: 1,
    color: '#FFC83D',
    marginTop: -4,
    textShadowColor: '#C77A12',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  /* Speech bubble */
  bubbleWrapper: {
    position: 'absolute',
    top: 198,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
  },
  bubble: {
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 22,
    maxWidth: 272,
    shadowColor: 'rgba(40,70,40,1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  bubbleText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2C4A2A',
    textAlign: 'center',
    lineHeight: 23,
  },
  bubbleCoin: {
    position: 'absolute',
    right: 30,
    bottom: 15,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F2B330',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(180,130,30,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -7.5,
    width: 15,
    height: 15,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },

  /* Stat chips */
  chipsContainer: {
    position: 'absolute',
    right: 16,
    top: 352,
    zIndex: 2,
    gap: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: 150,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 12,
    paddingLeft: 11,
    paddingRight: 18,
    borderRadius: 22,
    shadowColor: 'rgba(40,70,40,1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
    elevation: 6,
  },
  chipValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 22,
    color: '#27331F',
  },

  /* Coin icon */
  coinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2B330',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(180,130,30,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },

  /* Gem icon */
  gemIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemIcon: {
    width: 26,
    height: 26,
    backgroundColor: '#3FB8D6',
    borderRadius: 5,
    transform: [{ rotate: '45deg' }],
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: 'rgba(20,110,140,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  /* Floors icon */
  floorsIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  floorBar: {
    width: 24,
    height: 6,
    borderRadius: 3,
  },
  floorsLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#9A9684',
    marginTop: 3,
  },

  /* Action buttons */
  actionsContainer: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 38,
    zIndex: 2,
    gap: 12,
  },

  /* Play button */
  playButton: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(46,130,40,1)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 8,
    overflow: 'hidden',
  },
  playButtonGradient: {
    height: 62,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderLeftColor: '#fff',
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: 'transparent',
  },
  playButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 21,
    color: '#fff',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(20,70,15,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* "або" */
  orContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  orText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(15,35,25,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* Secondary buttons */
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: 'rgba(40,60,40,1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  secondaryEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  secondaryLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2C4A2A',
  },

  /* Plus icon */
  plusIconWrap: {
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusH: {
    position: 'absolute',
    width: 15,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#3C7A35',
  },
  plusV: {
    position: 'absolute',
    width: 3,
    height: 15,
    borderRadius: 2,
    backgroundColor: '#3C7A35',
  },

  /* Terms */
  termsText: {
    textAlign: 'center',
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(15,35,25,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 2,
  },
  termsUnderline: {
    textDecorationLine: 'underline',
  },
});
