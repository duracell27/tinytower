import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';

interface WelcomeScreenProps {
  onPlay: () => void;
  onGuest: () => void;
  onLogin: () => void;
  onRegister: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    const str = String(n);
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ');
  }
  return String(n);
}

function PlayerAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <LinearGradient
      colors={['#74D3C4', '#3FA9A0']}
      style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarInitial, { fontSize: size * 0.45 }]}>{initial}</Text>
    </LinearGradient>
  );
}

export default function WelcomeScreen({ onPlay, onGuest, onLogin, onRegister }: WelcomeScreenProps) {
  const { t } = useTranslation('auth');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const lastPlayer = useAuthStore((s) => s.lastPlayer);
  const quickLogin = useAuthStore((s) => s.quickLogin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const balance = useGameStore((s) => s.balance);
  const gems = useGameStore((s) => s.gems);
  const floorCount = useGameStore((s) => s.floors.length);
  const player = useAuthStore((s) => s.player);

  // Case 1: active session
  // Case 2: logged out but has saved account
  // Case 3: first time / no account
  const hasLastAccount = !isAuthenticated && lastPlayer !== null;
  const isFirstTime = !isAuthenticated && lastPlayer === null;
  const showChips = isAuthenticated || hasLastAccount;

  const activePlayerName = isAuthenticated
    ? (player?.playerName ?? lastPlayer?.playerName ?? '')
    : (lastPlayer?.playerName ?? '');

  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleMainAction = () => {
    if (isAuthenticated) {
      onPlay();
    } else if (hasLastAccount) {
      setShowPasswordPrompt(true);
      setPassword('');
      setError('');
    } else {
      onGuest();
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) { setError(t('welcome.errors.enterPassword')); return; }
    try {
      await quickLogin(password);
      setShowPasswordPrompt(false);
      onPlay();
    } catch {
      setError(t('welcome.errors.wrongPassword'));
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/welcome-bg.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={{ bottom: 0, left: '50%' }}
      />

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
            {t('welcome.bubble')}
            <View style={styles.bubbleCoinInline} />
          </Text>
          <View style={styles.bubbleTail} />
        </View>
      </View>

      {/* Stat chips — only when there's a known account */}
      {showChips && (
        <View style={styles.chipsContainer}>
          <View style={styles.chip}>
            <View style={styles.coinIcon} />
            <Text style={styles.chipValue}>{formatNumber(balance)}</Text>
          </View>
          <View style={styles.chip}>
            <View style={styles.gemIconWrap}>
              <View style={styles.gemIcon} />
            </View>
            <Text style={styles.chipValue}>{gems}</Text>
          </View>
          <View style={styles.chip}>
            <View style={styles.floorsIconWrap}>
              {(['#6FBF46', '#8FD86A', '#6FBF46'] as const).map((c, i) => (
                <View key={i} style={[styles.floorBar, { backgroundColor: c }]} />
              ))}
            </View>
            <View>
              <Text style={styles.chipValue}>{floorCount}</Text>
              <Text style={styles.floorsLabel}>{t('welcome.chips.floorsLabel')}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Password popup */}
      <Modal
        visible={showPasswordPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordPrompt(false)}
      >
        <KeyboardAvoidingView
          style={styles.promptOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.promptBackdrop} onPress={() => setShowPasswordPrompt(false)} />
          <View style={styles.promptCard}>
            <PlayerAvatar name={lastPlayer?.playerName ?? '?'} size={52} />
            <Text style={styles.promptTitle}>{lastPlayer?.playerName}</Text>
            <Text style={styles.promptEmail}>{lastPlayer?.email}</Text>

            <TextInput
              style={styles.promptInput}
              placeholder={t('welcome.passwordPrompt.placeholder')}
              placeholderTextColor="#B7B3A2"
              secureTextEntry
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              autoFocus
              editable={!isLoading}
            />

            {error ? <Text style={styles.promptError}>{error}</Text> : null}

            <Pressable onPress={handlePasswordSubmit} disabled={isLoading} style={styles.promptSubmitWrap}>
              <LinearGradient colors={['#62C84F', '#3FA535']} style={styles.promptSubmit}>
                {isLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.promptSubmitText}>{t('common:actions.login')}</Text>
                }
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => setShowPasswordPrompt(false)} style={styles.promptCancel}>
              <Text style={styles.promptCancelText}>{t('common:actions.cancel')}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Actions */}
      <View style={styles.actionsContainer}>

        {/* ── Case 1 & 2: known player ── */}
        {(isAuthenticated || hasLastAccount) && (
          <Pressable
            onPress={handleMainAction}
            style={({ pressed }) => [styles.continueButton, pressed && { opacity: 0.88 }]}
          >
            <LinearGradient colors={['#62C84F', '#3FA535']} style={styles.continueGradient}>
              <PlayerAvatar name={activePlayerName} size={36} />
              <View style={styles.continueMeta}>
                <Text style={styles.continueName}>{activePlayerName}</Text>
                <Text style={styles.continueLabel}>
                  {isAuthenticated ? t('welcome.continueLabel.authenticated') : t('welcome.continueLabel.hasAccount')}
                </Text>
              </View>
              {hasLastAccount && (
                <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Rect x={5} y={11} width={14} height={10} rx={2} />
                  <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </Svg>
              )}
              {isAuthenticated && (
                <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12h14M13 6l6 6-6 6" />
                </Svg>
              )}
            </LinearGradient>
          </Pressable>
        )}

        {/* ── Case 3: first time → guest ── */}
        {isFirstTime && (
          <Pressable
            onPress={handleMainAction}
            style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.88 }]}
          >
            <LinearGradient colors={['#62C84F', '#3FA535']} style={styles.playButtonGradient}>
              <View style={styles.playTriangle} />
              <Text style={styles.playButtonText}>{t('welcome.playButton')}</Text>
            </LinearGradient>
          </Pressable>
        )}

        <View style={styles.orContainer}>
          <Text style={styles.orText}>{t('common:actions.or')}</Text>
        </View>

        <View style={styles.secondaryRow}>
          <Pressable onPress={onLogin} style={styles.secondaryButton}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#2C4A2A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={8} r={4} />
              <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </Svg>
            <Text style={styles.secondaryLabel}>{t('common:actions.login')}</Text>
          </Pressable>
          <Pressable onPress={onRegister} style={styles.secondaryButton}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#2C4A2A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
            <Text style={styles.secondaryLabel}>{t('common:actions.register')}</Text>
          </Pressable>
        </View>

        {isFirstTime && (
          <Text style={styles.guestNote}>
            {t('welcome.guestNote')}
          </Text>
        )}

        <Text style={styles.termsText}>
          {t('welcome.terms.continuingText')}
          <Text style={styles.termsUnderline}>{t('welcome.terms.terms')}</Text>
          {t('welcome.terms.and')}
          <Text style={styles.termsUnderline}>{t('welcome.terms.policy')}</Text>
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
    textShadowColor: '#3E8FD8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
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
  bubbleCoinInline: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F2B330',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    transform: [{ translateY: 3 }],
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

  /* Avatar */
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarInitial: {
    fontFamily: 'Fredoka_700Bold',
    color: '#fff',
  },

  /* Continue button (case 1 & 2) */
  continueButton: {
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
  continueGradient: {
    height: 66,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  continueMeta: {
    flex: 1,
  },
  continueName: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#fff',
    textShadowColor: 'rgba(20,70,15,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  continueLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
  },

  /* Play button (case 3) */
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

  /* Password prompt */
  promptOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  promptBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  promptCard: {
    width: '100%',
    backgroundColor: '#FBFAF5',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  promptTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 22,
    color: '#27331F',
    marginTop: 12,
    marginBottom: 4,
  },
  promptEmail: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#7C8A6E',
    marginBottom: 20,
  },
  promptInput: {
    width: '100%',
    height: 52,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#E4E1D3',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    color: '#27331F',
    marginBottom: 12,
  },
  promptError: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#C62828',
    marginBottom: 12,
  },
  promptSubmitWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  promptSubmit: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptSubmitText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#fff',
  },
  promptCancel: {
    padding: 8,
  },
  promptCancelText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#7C8A6E',
  },

  /* Secondary row */
  actionsContainer: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 38,
    zIndex: 2,
    gap: 12,
  },
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
  secondaryLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2C4A2A',
  },
  guestNote: {
    textAlign: 'center',
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    textShadowColor: 'rgba(15,35,25,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
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
