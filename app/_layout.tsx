import '../src/i18n';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox, useColorScheme } from 'react-native';

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
import { setAuthFailureCallback } from '../src/services/api';
import * as Linking from 'expo-linking';
import { createMMKV } from 'react-native-mmkv';
import GlobalOverlay from '../src/components/GlobalOverlay';
import OnboardingOverlay from '../src/components/OnboardingOverlay';
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

function handleReferralLink(url: string | null) {
  if (!url) return;
  const code = extractReferralCode(url);
  if (code) authStorage.set('referral.pendingCode', code);
}

export default function RootLayout() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
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
    useAuthStore.getState().loadTokens();
    setAuthFailureCallback(() => {
      useAuthStore.getState().logout();
      router.replace('/');
    });
    // Handle deep link that opened the app from cold start
    Linking.getInitialURL().then(handleReferralLink);
    // Handle deep link while app is already open
    const sub = Linking.addEventListener('url', ({ url }) => handleReferralLink(url));
    return () => sub.remove();
  }, [router]);

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
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="referrals" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="chat-screen" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="forum-screen" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="daily-tasks" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-business" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-business/[category]" options={{ headerShown: false }} />
        <Stack.Screen name="city/create" options={{ animation: 'slide_from_bottom', presentation: 'modal', ...cityHeaderOptions }} />
        <Stack.Screen name="city/search" options={{ animation: 'slide_from_right', ...cityHeaderOptions }} />
        <Stack.Screen name="city/[id]" options={{ animation: 'slide_from_right', ...cityHeaderOptions }} />
        <Stack.Screen name="city/settings" options={{ animation: 'slide_from_right', ...cityHeaderOptions }} />
        <Stack.Screen name="city/rankings" options={{ animation: 'slide_from_right', ...cityHeaderOptions }} />
      </Stack>
      <GlobalOverlay />
      <OnboardingOverlay />
      </ClockProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBFAF5',
  },
});
