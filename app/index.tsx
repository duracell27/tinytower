import { View, Text } from 'react-native';
import { createInitialState } from '../src/config/gameConfig';
import { gameConfig } from '../src/config/gameConfig';

export default function HomeScreen() {
  const initialState = createInitialState(gameConfig);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Welcome to Skyscraper Tycoon</Text>
      <Text>Balance: {initialState.balance}</Text>
    </View>
  );
}
