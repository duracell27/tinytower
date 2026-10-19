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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import LocaleText from '../src/components/LocaleText';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { api } from '../src/services/api';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation('auth');
  const { isDark } = useAppTheme();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      setError(t('resetPassword.errors.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('resetPassword.errors.passwordMismatch'));
      return;
    }
    if (!token) {
      setError(t('resetPassword.errors.invalidToken'));
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setDone(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('invalid') || msg.includes('expired') || msg.includes('400')) {
        setError(t('resetPassword.errors.invalidToken'));
      } else {
        setError(t('resetPassword.errors.somethingWentWrong'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={isDark ? ['#0D1117', '#131A2E', '#0D1F2D'] : ['#F0F7EE', '#E8F5E3', '#FBFAF5']}
      style={styles.container}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <View style={[styles.card, isDark && { backgroundColor: '#1A2338' }]}>
          <LocaleText style={[styles.title, isDark && { color: '#D8E4F0' }]}>
            {t('resetPassword.title')}
          </LocaleText>
          <LocaleText style={[styles.subtitle, isDark && { color: '#8FA8C0' }]}>
            {t('resetPassword.subtitle')}
          </LocaleText>

          {done ? (
            <View style={styles.successWrap}>
              <LocaleText style={styles.successText}>{t('resetPassword.success')}</LocaleText>
              <Pressable onPress={() => router.replace('/login')} style={styles.loginBtn}>
                <LocaleText style={styles.loginBtnText}>{t('login.tabs.login')}</LocaleText>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.inputWrap}>
                <LocaleText style={[styles.label, isDark && { color: '#8FA8C0' }]}>
                  {t('resetPassword.newPasswordLabel')}
                </LocaleText>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.inputFlex, isDark && { backgroundColor: '#252D42', borderColor: '#3A4560', color: '#D8E4F0' }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="••••••"
                    placeholderTextColor={isDark ? '#4A5A70' : '#B0B8C0'}
                    secureTextEntry={!showNew}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowNew(!showNew)} style={[styles.eyeBtn, isDark && { backgroundColor: '#252D42' }]}>
                    <LocaleText style={styles.eyeIcon}>{showNew ? '🙈' : '👁️'}</LocaleText>
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputWrap}>
                <LocaleText style={[styles.label, isDark && { color: '#8FA8C0' }]}>
                  {t('resetPassword.confirmPasswordLabel')}
                </LocaleText>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.inputFlex, isDark && { backgroundColor: '#252D42', borderColor: '#3A4560', color: '#D8E4F0' }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••"
                    placeholderTextColor={isDark ? '#4A5A70' : '#B0B8C0'}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowConfirm(!showConfirm)} style={[styles.eyeBtn, isDark && { backgroundColor: '#252D42' }]}>
                    <LocaleText style={styles.eyeIcon}>{showConfirm ? '🙈' : '👁️'}</LocaleText>
                  </Pressable>
                </View>
              </View>

              {error ? <LocaleText style={styles.errorText}>{error}</LocaleText> : null}

              <Pressable
                onPress={handleSubmit}
                style={[styles.submitButton, isDark && { borderColor: 'rgba(255,255,255,0.15)' }]}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color="#fff" />
                  : <LocaleText style={styles.submitText}>{t('resetPassword.submit')}</LocaleText>
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
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
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
  inputFlex: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    height: 48,
    width: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DDE4EC',
    borderLeftWidth: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: { fontSize: 16 },
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
  successText: { fontSize: 15, color: '#3FA535', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  loginBtn: {
    backgroundColor: '#3FA535',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  loginBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Fredoka_600SemiBold' },
});
