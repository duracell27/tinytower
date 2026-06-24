import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import WelcomeScreen from '../src/screens/WelcomeScreen';

export default function Index() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/game');
    }
  }, [isAuthenticated, router]);

  return (
    <WelcomeScreen
      onPlay={() => router.push('/game')}
      onLogin={() => router.push('/login')}
      onRegister={() => router.push('/login')}
    />
  );
}
