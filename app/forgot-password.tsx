import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import LocaleText from '../src/components/LocaleText';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { api } from '../src/services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation('auth');
  const { isDark } = useAppTheme();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t('forgotPassword.errors.enterEmail'));
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await api.forgotPassword(trimmed);
      setSent(true);
    } catch {
      setError(t('forgotPassword.errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={isDark ? ['#0D1117', '#131A2E', '#0D1F2D'] : ['#F0F7EE', '#E8F5E3', '#FBFAF5']}
      style={styles.container}
    >
      <Pressable onPress={() => router.back()} style={[styles.backButton, isDark && { backgroundColor: 'rgba(18,28,50,0.90)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }]}>
        <LocaleText style={[styles.backArrow, isDark && { color: '#D8E4F0' }]}>{'‹'}</LocaleText>
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <View style={[styles.card, isDark && { backgroundColor: '#1A2338' }]}>
          <LocaleText style={[styles.title, isDark && { color: '#D8E4F0' }]}>
            {t('forgotPassword.title')}
          </LocaleText>
          <LocaleText style={[styles.subtitle, isDark && { color: '#8FA8C0' }]}>
            {t('forgotPassword.subtitle')}
          </LocaleText>

          {sent ? (
            <View style={styles.successWrap}>
              <LocaleText style={styles.successText}>{t('forgotPassword.success')}</LocaleText>
              <Pressable onPress={() => router.back()} style={styles.backToLoginBtn}>
                <LocaleText style={styles.backToLoginText}>{t('forgotPassword.backToLogin')}</LocaleText>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.inputWrap}>
                <LocaleText style={[styles.label, isDark && { color: '#8FA8C0' }]}>
                  {t('forgotPassword.emailLabel')}
                </LocaleText>
                <TextInput
                  style={[styles.input, isDark && { backgroundColor: '#252D42', borderColor: '#3A4560', color: '#D8E4F0' }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={isDark ? '#4A5A70' : '#B0B8C0'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {error ? <LocaleText style={styles.errorText}>{error}</LocaleText> : null}

              <Pressable
                onPress={handleSubmit}
                style={[styles.submitButton, isDark && { borderColor: 'rgba(255,255,255,0.15)', shadowColor: 'rgba(20,60,20,1)' }]}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color="#fff" />
                  : <LocaleText style={styles.submitText}>{t('forgotPassword.submit')}</LocaleText>
                }
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backArrow: { fontSize: 26, color: '#2D3A4A', marginTop: -2 },
  kav: { flex: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  title: { fontSize: 22, fontFamily: 'Fredoka_600SemiBold', color: '#1A2338', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7C93', marginBottom: 24, lineHeight: 20 },
  inputWrap: { marginBottom: 16 },
  label: { fontSize: 13, color: '#6B7C93', marginBottom: 6, fontFamily: 'Nunito_600SemiBold' },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#DDE4EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A2338',
    backgroundColor: '#F8FAFC',
  },
  errorText: { color: '#E05252', fontSize: 13, marginBottom: 12 },
  submitButton: {
    backgroundColor: '#3FA535',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(40,120,40,0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { color: '#fff', fontSize: 16, fontFamily: 'Fredoka_600SemiBold' },
  successWrap: { alignItems: 'center', paddingVertical: 8 },
  successText: { fontSize: 16, color: '#3FA535', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  backToLoginBtn: {
    backgroundColor: '#3FA535',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
    shadowColor: 'rgba(40,120,40,0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  backToLoginText: { color: '#fff', fontSize: 16, fontFamily: 'Fredoka_600SemiBold' },
});
