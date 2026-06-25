import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import WelcomeScreen from '../src/screens/WelcomeScreen';

export default function Index() {
  const router = useRouter();

  const handlePlay = () => {
    if (useAuthStore.getState().isAuthenticated) {
      router.replace('/game');
    } else {
      router.push('/login');
    }
  };

  return (
    <WelcomeScreen
      onPlay={handlePlay}
      onLogin={() => router.push('/login')}
      onRegister={() => router.push('/login')}
    />
  );
}
