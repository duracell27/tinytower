import '../src/i18n';
import { isRunningInExpoGo } from 'expo';
import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  enableLogs: true,
  integrations: [Sentry.mobileReplayIntegration()],
  enableNativeFramesTracking: !isRunningInExpoGo(),
  environment: __DEV__ ? 'development' : 'production',
});
import { View, ActivityIndicator, StyleSheet, LogBox, useColorScheme, Platform } from 'react-native';

LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate` with no listeners registered.']);
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  Geologica_400Regular,
  Geologica_500Medium,
  Geologica_600SemiBold,
  Geologica_700Bold,
  Geologica_800ExtraBold,
} from '@expo-google-fonts/geologica';
import {
  Comfortaa_400Regular,
  Comfortaa_500Medium,
  Comfortaa_600SemiBold,
  Comfortaa_700Bold,
} from '@expo-google-fonts/comfortaa';
import { useAuthStore } from '../src/stores/authStore';
import { setAuthFailureCallback, initAuthStorage } from '../src/services/api';
import { purchaseService } from '../src/services/purchaseService';
import { registerPushNotifications } from '../src/services/notifications';
import * as Linking from 'expo-linking';
import { createMMKV } from 'react-native-mmkv';
import GlobalOverlay from '../src/components/GlobalOverlay';
import OnboardingOverlay from '../src/components/OnboardingOverlay';
import AndroidTabBarGlobal from '../src/components/AndroidTabBarGlobal';
import { ClockProvider } from '../src/context/ClockContext';

const authStorage = createMMKV({ id: 'auth' });

function extractReferralCode(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    if (parsed.hostname !== 'ref') return null;   // ← add this line
    const code = parsed.queryParams?.code;
    return typeof code === 'string' && code.length === 6 ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

function extractResetToken(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    if (parsed.hostname !== 'reset-password') return null;
    const token = parsed.queryParams?.token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function handleReferralLink(url: string | null) {
  if (!url) return;
  const code = extractReferralCode(url);
  if (code) authStorage.set('referral.pendingCode', code);
}

function RootLayout() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const player = useAuthStore((s) => s.player);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const cityHeaderOptions = {
    headerShown: true,
    title: '',
    headerStyle: { backgroundColor: isDark ? '#0D1F2D' : '#FFFFFF' } as any,
    headerTintColor: isDark ? '#DDE8D8' : '#000000',
    headerShadowVisible: false,
  };

  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Geologica_400Regular,
    Geologica_500Medium,
    Geologica_600SemiBold,
    Geologica_700Bold,
    Geologica_800ExtraBold,
    Comfortaa_400Regular,
    Comfortaa_500Medium,
    Comfortaa_600SemiBold,
    Comfortaa_700Bold,
  });

  useEffect(() => {
    initAuthStorage().then(() => useAuthStore.getState().loadTokens());
    setAuthFailureCallback(() => {
      useAuthStore.getState().logout();
      router.replace('/');
    });
    // Handle deep link that opened the app from cold start
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      handleReferralLink(url);
      const resetToken = extractResetToken(url);
      if (resetToken) router.replace(`/reset-password?token=${resetToken}`);
    });
    // Handle deep link while app is already open
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleReferralLink(url);
      const resetToken = extractResetToken(url);
      if (resetToken) router.push(`/reset-password?token=${resetToken}`);
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (player?.id) {
      purchaseService.initialize(player.id);
    }
  }, [player?.id]);

  useEffect(() => {
    if (isAuthenticated && !isGuest && player?.id) {
      registerPushNotifications().catch(() => {});
    }
  }, [isAuthenticated, isGuest, player?.id]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3FA535" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClockProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="reset-password" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="referrals" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="chat-screen" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="forum-screen" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="daily-tasks" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-business" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-business/[category]" options={{ headerShown: false }} />
        <Stack.Screen name="city/create" options={{ animation: 'slide_from_bottom', presentation: 'modal', ...cityHeaderOptions }} />
        <Stack.Screen name="city/search" options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="city/[id]" options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="city/settings" options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="city/rankings" options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="city/citizen-rankings" options={{ animation: 'slide_from_right', headerShown: false }} />
      </Stack>
      <GlobalOverlay />
      <OnboardingOverlay />
      {Platform.OS === 'android' && <AndroidTabBarGlobal />}
      </ClockProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBFAF5',
  },
});
