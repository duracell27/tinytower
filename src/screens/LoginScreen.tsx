import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '../stores/authStore';

interface LoginScreenProps {
  onSuccess: () => void;
  onGoogle: () => void;
  onApple: () => void;
  onBack: () => void;
}

function GoogleIcon() {
  return (
    <Svg viewBox="0 0 48 48" width={18} height={18}>
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export default function LoginScreen({ onSuccess, onGoogle, onApple, onBack }: LoginScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isLogin = tab === 'login';
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleSubmit = async () => {
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Заповніть всі поля');
      return;
    }

    if (!isLogin && !playerName.trim()) {
      setError("Введіть ім'я гравця");
      return;
    }

    if (password.length < 6) {
      setError('Пароль має бути не менше 6 символів');
      return;
    }

    try {
      if (isLogin) {
        await useAuthStore.getState().login(email.trim(), password);
      } else {
        await useAuthStore.getState().register(email.trim(), password, playerName.trim());
      }
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Щось пішло не так';
      setError(msg);
    }
  };

  const handleTabSwitch = (newTab: 'login' | 'register') => {
    setTab(newTab);
    setError('');
  };

  return (
    <View style={styles.container}>
      {/* Background image */}
      <Image
        source={require('../../assets/welcome-bg.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={{ bottom: 0, left: '50%' }}
      />

      {/* Scrim overlay */}
      <LinearGradient
        colors={[
          'rgba(20,50,80,0.12)',
          'rgba(20,40,60,0.02)',
          'rgba(20,40,30,0.16)',
        ]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Back button */}
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backArrow}>{'‹'}</Text>
      </Pressable>

      {/* Centered card */}
      <KeyboardAvoidingView
        style={styles.cardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Title */}
            <Text style={styles.cardTitle}>
              {isLogin ? 'З поверненням!' : 'Створіть акаунт'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isLogin
                ? 'Увійдіть, щоб продовжити будувати свою вежу'
                : 'Збережіть прогрес і грайте на всіх пристроях'}
            </Text>

            {/* Tabs */}
            <View style={styles.tabBar}>
              <Pressable
                onPress={() => handleTabSwitch('login')}
                style={[styles.tab, isLogin && styles.tabActive]}
              >
                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
                  Вхід
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleTabSwitch('register')}
                style={[styles.tab, !isLogin && styles.tabActive]}
              >
                <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>
                  Реєстрація
                </Text>
              </Pressable>
            </View>

            {/* Error message */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Player name (register only) */}
            {!isLogin && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{"Ім'я гравця"}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Як до вас звертатися?"
                  placeholderTextColor="#B7B3A2"
                  value={playerName}
                  onChangeText={setPlayerName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>
            )}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Ел. пошта</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#B7B3A2"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            {/* Password */}
            <View style={[styles.fieldGroup, { marginBottom: 10 }]}>
              <Text style={styles.label}>Пароль</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="Мінімум 6 символів"
                  placeholderTextColor="#B7B3A2"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <View style={[styles.eyeShape, showPassword && styles.eyeShapeActive]}>
                    <View style={styles.eyeDot} />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Forgot password / terms checkbox */}
            {isLogin ? (
              <View style={styles.forgotWrap}>
                <Pressable>
                  <Text style={styles.forgotText}>Забули пароль?</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.checkboxRow}>
                <View style={styles.checkbox}>
                  <View style={styles.checkmark} />
                </View>
                <Text style={styles.checkboxText}>
                  {'Я приймаю '}
                  <Text style={styles.checkboxLink}>Умови використання</Text>
                  {' та '}
                  <Text style={styles.checkboxLink}>Політику конфіденційності</Text>
                </Text>
              </View>
            )}

            {/* Submit button */}
            <Pressable onPress={handleSubmit} style={styles.submitButton} disabled={isLoading}>
              <LinearGradient
                colors={['#62C84F', '#3FA535']}
                style={styles.submitGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>
                    {isLogin ? 'Увійти' : 'Створити акаунт'}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>або</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={styles.socialRow}>
              <Pressable onPress={onGoogle} style={styles.googleButton}>
                <GoogleIcon />
                <Text style={styles.socialLabel}>Google</Text>
              </Pressable>
              <Pressable onPress={onApple} style={styles.appleButton}>
                <Text style={styles.appleIcon}>{''}</Text>
                <Text style={styles.appleLabelText}>Apple</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },

  /* Back button */
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  backArrow: {
    fontSize: 28,
    color: '#2C4A2A',
    fontWeight: '600',
    marginTop: -2,
  },

  /* Card wrapper */
  cardWrapper: {
    flex: 1,
    zIndex: 6,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    backgroundColor: '#FBFAF5',
    borderRadius: 30,
    padding: 24,
    paddingTop: 30,
    paddingBottom: 26,
    shadowColor: 'rgba(30,50,30,1)',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
    elevation: 12,
  },

  /* Title */
  cardTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 27,
    color: '#27331F',
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#7C8A6E',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 22,
  },

  /* Tabs */
  tabBar: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: '#ECEADF',
    borderRadius: 15,
    padding: 5,
    marginBottom: 22,
  },
  tab: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: 'rgba(60,90,40,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#9A9684',
  },
  tabTextActive: {
    color: '#2C4A2A',
  },

  /* Error */
  errorBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#C62828',
    textAlign: 'center',
  },

  /* Form fields */
  fieldGroup: {
    marginBottom: 15,
  },
  label: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#5A6650',
    paddingLeft: 2,
    marginBottom: 7,
  },
  input: {
    height: 52,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#E4E1D3',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    color: '#27331F',
  },

  /* Password eye icon */
  passwordWrap: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: '100%',
  },
  eyeShape: {
    width: 22,
    height: 15,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: '#B7B3A2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeShapeActive: {
    borderColor: '#3C9A34',
  },
  eyeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#B7B3A2',
  },

  /* Forgot password */
  forgotWrap: {
    alignItems: 'flex-end',
    marginBottom: 20,
    marginTop: 4,
  },
  forgotText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#3C9A34',
  },

  /* Terms checkbox */
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 20,
    marginTop: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#4FB246',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(30,90,25,1)',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 2,
  },
  checkmark: {
    width: 5,
    height: 9,
    borderColor: '#fff',
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '42deg' }],
    marginTop: -2,
  },
  checkboxText: {
    flex: 1,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12.5,
    color: '#7C8A6E',
    lineHeight: 17.5,
  },
  checkboxLink: {
    color: '#3C9A34',
  },

  /* Submit button */
  submitButton: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
    shadowColor: 'rgba(46,130,40,1)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 8,
  },
  submitGradient: {
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 19,
    color: '#fff',
    textShadowColor: 'rgba(20,70,15,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E4E1D3',
  },
  dividerText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#A8A493',
  },

  /* Social buttons */
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  googleButton: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#E4E1D3',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  socialLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#5A6650',
  },
  appleButton: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#1C1C1E',
    backgroundColor: '#1C1C1E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  appleIcon: {
    fontSize: 17,
    color: '#fff',
    marginTop: -2,
  },
  appleLabelText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#fff',
  },
});
