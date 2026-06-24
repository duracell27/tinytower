import { useRouter } from 'expo-router';
import WelcomeScreen from '../src/screens/WelcomeScreen';

export default function Index() {
  const router = useRouter();

  return (
    <WelcomeScreen
      onPlay={() => router.push('/game')}
      onLogin={() => router.push('/login')}
      onRegister={() => router.push('/login')}
    />
  );
}
