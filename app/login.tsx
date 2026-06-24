import { useRouter } from 'expo-router';
import LoginScreen from '../src/screens/LoginScreen';

export default function Login() {
  const router = useRouter();

  return (
    <LoginScreen
      onSuccess={() => router.replace('/game')}
      onGoogle={() => {}}
      onApple={() => {}}
      onBack={() => router.back()}
    />
  );
}
