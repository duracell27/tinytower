import React, { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import LocaleText from '../components/LocaleText';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { getUserIcon } from '../utils/userIcon';
import { formatNum } from '../utils/format';
import { fetchGlobalStats, type GlobalStats } from '../services/api';

interface WelcomeScreenProps {
  onPlay: () => void;
  onGuest: () => void;
  onLogin: () => void;
  onRegister: () => void;
}

function PlayerAvatar({ level, size = 36 }: { level: number; size?: number }) {
  return (
    <Image
      source={getUserIcon(level)}
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
      contentFit="cover"
    />
  );
}

export default function WelcomeScreen({ onPlay, onGuest, onLogin, onRegister }: WelcomeScreenProps) {
  const { t } = useTranslation('auth');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const lastPlayer = useAuthStore((s) => s.lastPlayer);
  const quickLogin = useAuthStore((s) => s.quickLogin);
  const clearLastPlayer = useAuthStore((s) => s.clearLastPlayer);
  const isLoading = useAuthStore((s) => s.isLoading);
  const balance = useGameStore((s) => s.balance);
  const gems = useGameStore((s) => s.gems);
  const floorCount = useGameStore((s) => s.floors.length + 1); // +1 for hotel floor
  const playerLevel = useGameStore((s) => s.playerLevel);
  const isHydrated = useGameStore((s) => s.isHydrated);
  const player = useAuthStore((s) => s.player);

  // Case 1: active session
  // Case 2: logged out but has saved account
  // Case 3: first time / no account
  const hasLastAccount = !isAuthenticated && lastPlayer !== null;
  const isFirstTime = !isAuthenticated && lastPlayer === null;
  const showChips = isAuthenticated && isHydrated;

  const activePlayerName = isAuthenticated
    ? (player?.playerName ?? lastPlayer?.playerName ?? '')
    : (lastPlayer?.playerName ?? '');

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      fetchGlobalStats().then(setGlobalStats).catch(() => {});
    }
  }, [isAuthenticated]);

  const { isDark } = useAppTheme();

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
    } catch (e) {
      setError(e instanceof TypeError ? t('welcome.errors.noInternet') : t('welcome.errors.wrongPassword'));
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/img/bgFirstpage.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />

      <LinearGradient
        colors={[
          'rgba(30,60,90,0.08)',
          'rgba(30,60,90,0)',
          'rgba(15,35,25,0)',
          'rgba(15,35,25,0.22)',
          'rgba(12,30,20,0.45)',
        ]}
        locations={[0, 0.2, 0.56, 0.8, 1]}
        style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
        pointerEvents="none"
      />

      {/* Social buttons */}
      <View style={styles.discordWrapper} pointerEvents="box-none">
        <Pressable
          onPress={() => Linking.openURL('https://discord.com/channels/1521796294270517260/1521882117208932483')}
          style={({ pressed }) => [styles.discordButton, pressed && { opacity: 0.75 }]}
        >
          <Image
            source={require('../../assets/img/discord.png')}
            style={{ width: 44, height: 44 }}
            contentFit="contain"
          />
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL('https://www.reddit.com/r/TinyTowerGame/')}
          style={({ pressed }) => [styles.discordButton, pressed && { opacity: 0.75 }]}
        >
          <Image
            source={require('../../assets/img/reddit.png')}
            style={{ width: 44, height: 44 }}
            contentFit="contain"
          />
        </Pressable>
      </View>

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/img/LogoInFirstPage.png')}
          style={{ width: '100%', height: 190 }}
          contentFit="contain"
          contentPosition="center"
        />
      </View>

      {/* Speech bubble */}
      <View style={styles.bubbleWrapper}>
        <View style={[styles.bubble, isDark && { backgroundColor: 'rgba(20,30,52,0.93)' }]}>
          <View style={styles.bubbleContent}>
            <LocaleText style={[styles.bubbleText, isDark && { color: '#D8E4F0' }]}>{t('welcome.bubble')}</LocaleText>
            <Image
              source={require('../../assets/img/coin.png')}
              style={{ width: 13, height: 13 }}
              contentFit="contain"
            />
          </View>
          <View style={[styles.bubbleTail, isDark && { backgroundColor: 'rgba(20,30,52,0.93)' }]} />
        </View>
      </View>

      {/* Personal stat chips — only for authenticated player */}
      {showChips && (
        <View style={styles.chipsContainer}>
          <View style={[styles.chip, isDark && { backgroundColor: 'rgba(18,28,50,0.92)' }]}>
            <Image source={require('../../assets/img/coin.png')} style={{ width: 40, height: 40 }} contentFit="contain" />
            <LocaleText style={[styles.chipValue, isDark && { color: '#D8E4F0' }]}>{formatNum(balance)}</LocaleText>
          </View>
          <View style={[styles.chip, isDark && { backgroundColor: 'rgba(18,28,50,0.92)' }]}>
            <Image source={require('../../assets/img/diamond.png')} style={{ width: 40, height: 40 }} contentFit="contain" />
            <LocaleText style={[styles.chipValue, isDark && { color: '#D8E4F0' }]}>{gems}</LocaleText>
          </View>
          <View style={[styles.chip, isDark && { backgroundColor: 'rgba(18,28,50,0.92)' }]}>
            <View style={styles.floorsIconWrap}>
              {(['#6FBF46', '#8FD86A', '#6FBF46'] as const).map((c, i) => (
                <View key={i} style={[styles.floorBar, { backgroundColor: c }]} />
              ))}
            </View>
            <View>
              <LocaleText style={[styles.chipValue, isDark && { color: '#D8E4F0' }]}>{floorCount}</LocaleText>
              <LocaleText style={[styles.floorsLabel, isDark && { color: '#7A8EA8' }]}>{t('welcome.chips.floorsLabel')}</LocaleText>
            </View>
          </View>
        </View>
      )}

      {/* Global stat chips — shown when not authenticated */}
      {!isAuthenticated && (
        <View style={styles.chipsContainer}>
          <View style={[styles.chip, isDark && { backgroundColor: 'rgba(18,28,50,0.92)' }]}>
            <LocaleText style={styles.chipStatEmoji}>👥</LocaleText>
            <View>
              <LocaleText style={[styles.chipValue, isDark && { color: '#D8E4F0' }]}>{globalStats ? formatNum(globalStats.players) : '—'}</LocaleText>
              <LocaleText style={[styles.floorsLabel, isDark && { color: '#7A8EA8' }]}>{t('welcome.chips.playersLabel')}</LocaleText>
            </View>
          </View>
          <View style={[styles.chip, isDark && { backgroundColor: 'rgba(18,28,50,0.92)' }]}>
            <View style={styles.floorsIconWrap}>
              {(['#6FBF46', '#8FD86A', '#6FBF46'] as const).map((c, i) => (
                <View key={i} style={[styles.floorBar, { backgroundColor: c }]} />
              ))}
            </View>
            <View>
              <LocaleText style={[styles.chipValue, isDark && { color: '#D8E4F0' }]}>{globalStats ? formatNum(globalStats.floors) : '—'}</LocaleText>
              <LocaleText style={[styles.floorsLabel, isDark && { color: '#7A8EA8' }]}>{t('welcome.chips.floorsLabel')}</LocaleText>
            </View>
          </View>
          <View style={[styles.chip, isDark && { backgroundColor: 'rgba(18,28,50,0.92)' }]}>
            <LocaleText style={styles.chipStatEmoji}>🏙️</LocaleText>
            <View>
              <LocaleText style={[styles.chipValue, isDark && { color: '#D8E4F0' }]}>{globalStats ? formatNum(globalStats.cities) : '—'}</LocaleText>
              <LocaleText style={[styles.floorsLabel, isDark && { color: '#7A8EA8' }]}>{t('welcome.chips.citiesLabel')}</LocaleText>
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
          <View style={[styles.promptCard, isDark && { backgroundColor: '#1E2840' }]}>
            <PlayerAvatar level={playerLevel} size={52} />
            <LocaleText style={[styles.promptTitle, isDark && { color: '#D8E4F0' }]}>{lastPlayer?.playerName}</LocaleText>
            <LocaleText style={[styles.promptEmail, isDark && { color: '#7A8EA8' }]}>{lastPlayer?.email}</LocaleText>

            <TextInput
              style={[styles.promptInput, isDark && { backgroundColor: '#252D42', borderColor: '#3A4560', color: '#D8E4F0' }]}
              placeholder={t('welcome.passwordPrompt.placeholder')}
              placeholderTextColor={isDark ? '#5A6A80' : '#B7B3A2'}
              secureTextEntry
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              autoFocus
              editable={!isLoading}
            />

            {error ? <LocaleText style={styles.promptError}>{error}</LocaleText> : null}

            <Pressable onPress={handlePasswordSubmit} disabled={isLoading} style={styles.promptSubmitWrap}>
              <LinearGradient colors={['#62C84F', '#3FA535']} style={styles.promptSubmit}>
                {isLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <LocaleText style={styles.promptSubmitText}>{t('common:actions.login')}</LocaleText>
                }
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => setShowPasswordPrompt(false)} style={styles.promptCancel}>
              <LocaleText style={[styles.promptCancelText, isDark && { color: '#7A8EA8' }]}>{t('common:actions.cancel')}</LocaleText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Actions */}
      <View style={styles.actionsContainer}>

        {/* ── Case 1 & 2: known player ── */}
        {(isAuthenticated || hasLastAccount) && (
          <View style={styles.continueRow}>
            <Pressable
              onPress={isAuthenticated ? () => useAuthStore.getState().logout() : clearLastPlayer}
              style={({ pressed }) => [styles.trashButton, isDark && { backgroundColor: 'rgba(18,28,50,0.80)', borderColor: 'rgba(255,255,255,0.18)' }, pressed && { opacity: 0.75 }]}
            >
              <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                <Path d="M10 11v6M14 11v6" />
              </Svg>
            </Pressable>

            <Pressable
              onPress={handleMainAction}
              style={({ pressed }) => [styles.continueButton, isDark && { borderColor: 'rgba(255,255,255,0.22)', shadowColor: 'rgba(20,60,20,1)' }, pressed && { opacity: 0.88 }]}
            >
              <LinearGradient colors={isDark ? ['#2E7228', '#1E5018'] : ['#62C84F', '#3FA535']} style={styles.continueGradient}>
                <PlayerAvatar level={playerLevel} size={36} />
                <View style={styles.continueMeta}>
                  <LocaleText style={styles.continueName}>{activePlayerName}</LocaleText>
                  <LocaleText style={styles.continueLabel}>
                    {isAuthenticated ? t('welcome.continueLabel.authenticated') : t('welcome.continueLabel.hasAccount')}
                  </LocaleText>
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
          </View>
        )}

        {/* ── Case 3: first time → guest ── */}
        {isFirstTime && (
          <Pressable
            onPress={handleMainAction}
            style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.88 }]}
          >
            <LinearGradient colors={isDark ? ['#2E7228', '#1E5018'] : ['#62C84F', '#3FA535']} style={styles.playButtonGradient}>
              <View style={styles.playTriangle} />
              <LocaleText style={styles.playButtonText}>{t('welcome.playButton')}</LocaleText>
            </LinearGradient>
          </Pressable>
        )}

        <View style={styles.secondaryRow}>
          <Pressable onPress={onLogin} style={[styles.secondaryButton, isDark && { backgroundColor: 'rgba(18,28,50,0.90)', borderColor: 'rgba(255,255,255,0.22)' }]}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={isDark ? '#A0C0E0' : '#2C4A2A'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={8} r={4} />
              <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </Svg>
            <LocaleText style={[styles.secondaryLabel, isDark && { color: '#D8E4F0' }]}>{t('common:actions.login')}</LocaleText>
          </Pressable>
          <Pressable onPress={onRegister} style={[styles.secondaryButton, isDark && { backgroundColor: 'rgba(18,28,50,0.90)', borderColor: 'rgba(255,255,255,0.22)' }]}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={isDark ? '#A0C0E0' : '#2C4A2A'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
            <LocaleText style={[styles.secondaryLabel, isDark && { color: '#D8E4F0' }]}>{t('common:actions.register')}</LocaleText>
          </Pressable>
        </View>

        {isFirstTime && (
          <LocaleText style={styles.guestNote}>
            {t('welcome.guestNote')}
          </LocaleText>
        )}

        <LocaleText style={styles.termsText}>
          {t('welcome.terms.continuingText')}
          <LocaleText
            style={styles.termsUnderline}
            onPress={() => Linking.openURL('https://TODO/terms')}
          >
            {t('welcome.terms.terms')}
          </LocaleText>
          {t('welcome.terms.and')}
          <LocaleText
            style={styles.termsUnderline}
            onPress={() => Linking.openURL('https://TODO/privacy')}
          >
            {t('welcome.terms.policy')}
          </LocaleText>
        </LocaleText>
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
    top: 64,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
  },
  bubbleWrapper: {
    position: 'absolute',
    top: 270,
    left: 230,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
  },
  bubble: {
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    alignSelf: 'center',
    shadowColor: 'rgba(40,70,40,1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  bubbleText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
    color: '#2C4A2A',
    textAlign: 'center',
    lineHeight: 15,
  },
  bubbleContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    alignSelf: 'center',
    marginLeft: 20,
    width: 15,
    height: 15,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  chipsContainer: {
    position: 'absolute',
    left: 16,
    right: '55%',
    top: 330,
    zIndex: 2,
    gap: 9,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 18,
    shadowColor: 'rgba(40,70,40,1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
    elevation: 6,
  },
  chipValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 18,
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
  chipStatEmoji: {
    fontSize: 28,
    lineHeight: 40,
    width: 40,
    textAlign: 'center',
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
  },
  continueGradient: {
    height: 66,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
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
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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
    bottom: 20,
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
  discordWrapper: {
    position: 'absolute',
    left: 16,
    right: '55%',
    top: 530,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    pointerEvents: 'box-none',
  },
  discordButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueRow: {
    position: 'relative',
    paddingTop: 18,
  },
  trashButton: {
    position: 'absolute',
    top: -22,
    left: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
