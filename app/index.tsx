import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import WelcomeScreen from '../src/screens/WelcomeScreen';

export default function Index() {
  const router = useRouter();

  const handlePlay = () => {
    router.replace('/game');
  };

  const handleGuest = () => {
    useAuthStore.getState().enterAsGuest();
    router.replace('/game');
  };

  return (
    <WelcomeScreen
      onPlay={handlePlay}
      onGuest={handleGuest}
      onLogin={() => router.push('/login')}
      onRegister={() => router.push('/login')}
    />
  );
}
