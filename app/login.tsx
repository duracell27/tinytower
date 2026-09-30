import { useRouter, useLocalSearchParams } from 'expo-router';
import LoginScreen from '../src/screens/LoginScreen';

export default function Login() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();

  return (
    <LoginScreen
      onSuccess={() => router.replace('/game')}
      onGoogle={() => {}}
      onApple={() => {}}
      onBack={() => router.back()}
      initialTab={tab === 'register' ? 'register' : 'login'}
    />
  );
}
