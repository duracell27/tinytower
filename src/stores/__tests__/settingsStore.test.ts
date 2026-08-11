jest.mock('react-native-mmkv', () => {
  const store: Record<string, unknown> = {};
  const mockInstance = {
    getBoolean: jest.fn((key: string) => store[key] as boolean | undefined),
    set: jest.fn((key: string, value: unknown) => { store[key] = value; }),
  };
  return { createMMKV: jest.fn(() => mockInstance) };
});

import { createMMKV } from 'react-native-mmkv';
import { useSettingsStore } from '../settingsStore';

function getMockInstance() {
  return (createMMKV as jest.Mock).mock.results[0]?.value as {
    getBoolean: jest.Mock;
    set: jest.Mock;
  };
}

beforeEach(() => {
  useSettingsStore.setState({ liftSimplifiedRewards: false });
  getMockInstance()?.getBoolean.mockClear();
  getMockInstance()?.set.mockClear();
});

test('default value is false when MMKV returns undefined', () => {
  expect(useSettingsStore.getState().liftSimplifiedRewards).toBe(false);
});

test('setLiftSimplifiedRewards updates state and persists to MMKV', () => {
  useSettingsStore.getState().setLiftSimplifiedRewards(true);
  expect(useSettingsStore.getState().liftSimplifiedRewards).toBe(true);
  expect(getMockInstance().set).toHaveBeenCalledWith('liftSimplifiedRewards', true);
});

test('setLiftSimplifiedRewards(false) persists false', () => {
  useSettingsStore.setState({ liftSimplifiedRewards: true });
  useSettingsStore.getState().setLiftSimplifiedRewards(false);
  expect(useSettingsStore.getState().liftSimplifiedRewards).toBe(false);
  expect(getMockInstance().set).toHaveBeenCalledWith('liftSimplifiedRewards', false);
});
