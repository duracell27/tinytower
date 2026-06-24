import { useRouter } from 'expo-router';
import LoginScreen from '../src/screens/LoginScreen';

export default function Login() {
  const router = useRouter();

  return (
    <LoginScreen
      onSubmit={() => router.push('/game')}
      onGoogle={() => router.push('/game')}
      onApple={() => router.push('/game')}
      onBack={() => router.back()}
    />
  );
}
