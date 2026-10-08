import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import LoginScreen from '../src/screens/LoginScreen';
import { useAuthStore } from '../src/stores/authStore';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const loginWithSocial = useAuthStore((s) => s.loginWithSocial);
  const { t } = useTranslation('auth');

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
  }, []);

  const handleGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      await loginWithSocial('google', tokens.idToken);
      router.replace('/game');
    } catch {
      Alert.alert('', t('login.social.error'));
    }
  };

  const handleApple = async () => {
    if (Platform.OS !== 'ios') return;
    try {
      const { default: AppleAuthentication } = await import('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ') || undefined;
      await loginWithSocial('apple', credential.identityToken!, fullName);
      router.replace('/game');
    } catch {
      Alert.alert('', t('login.social.error'));
    }
  };

  return (
    <LoginScreen
      onSuccess={() => router.replace('/game')}
      onGoogle={handleGoogle}
      onApple={Platform.OS === 'ios' ? handleApple : undefined}
      onBack={() => router.back()}
      initialTab={tab === 'register' ? 'register' : 'login'}
    />
  );
}
