import React from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

interface GuestWallProps {
  message?: string;
}

export default function GuestWall({ message = 'Create a free account to join the community' }: GuestWallProps) {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, isDark && { backgroundColor: '#2A2F38' }]}>
        <Image
          source={require('../../assets/img/users.png')}
          style={styles.icon}
          contentFit="contain"
        />
        <Text style={[styles.title, isDark && { color: '#DDE8D8' }]}>
          Registered players only
        </Text>
        <Text style={[styles.subtitle, isDark && { color: '#8A9A80' }]}>{message}</Text>
        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient colors={['#72C24F', '#5BA63C']} style={styles.btnGradient}>
            <Text style={styles.btnText}>Sign Up — it's free</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  icon: {
    width: 52,
    height: 52,
    marginBottom: 2,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#2A3344',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#6B7585',
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  btnGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
  },
});
