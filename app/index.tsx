import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '../src/stores/authStore';
import WelcomeScreen from '../src/screens/WelcomeScreen';
import i18n from '../src/i18n';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
  }, []);

  const handlePlay = () => {
    router.replace('/game');
  };

  const handleGuest = async () => {
    await useAuthStore.getState().enterAsGuest();
    router.replace('/game');
  };

  const handleGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      try { await GoogleSignin.signOut(); } catch {}
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      await useAuthStore.getState().loginWithSocial('google', tokens.idToken);
      router.replace('/game');
    } catch {
      // cancelled or failed silently
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
      await useAuthStore.getState().loginWithSocial('apple', credential.identityToken!, fullName);
      router.replace('/game');
    } catch {
      Alert.alert('', i18n.t('auth:login.social.error'));
    }
  };

  return (
    <WelcomeScreen
      onPlay={handlePlay}
      onGuest={handleGuest}
      onLogin={() => router.push('/login')}
      onRegister={() => router.push('/login?tab=register')}
      onGoogle={handleGoogle}
      onApple={Platform.OS === 'ios' ? handleApple : undefined}
    />
  );
}
