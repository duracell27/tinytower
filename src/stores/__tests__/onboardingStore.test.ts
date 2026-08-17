import { act } from 'react';
import type { OnboardingStep } from '../onboardingStore';

// Mock MMKV before importing store
const mockSet = jest.fn();
const mockGetString = jest.fn<string | undefined, []>(() => undefined);
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ set: mockSet, getString: mockGetString }),
}));

// Reset module between tests so store re-initializes
beforeEach(() => {
  jest.resetModules();
  mockSet.mockClear();
  mockGetString.mockClear();
});

describe('onboardingStore', () => {
  it('start() sets step to collect_slot_1 when no prior state', async () => {
    mockGetString.mockReturnValue(undefined);
    const { useOnboardingStore } = await import('../onboardingStore');
    act(() => useOnboardingStore.getState().start());
    expect(useOnboardingStore.getState().step).toBe('collect_slot_1');
    expect(useOnboardingStore.getState().isActive).toBe(true);
    expect(mockSet).toHaveBeenCalledWith('step', 'collect_slot_1');
  });

  it('start() is a no-op when step already exists', async () => {
    mockGetString.mockReturnValue('buy_goods_1');
    const { useOnboardingStore } = await import('../onboardingStore');
    act(() => useOnboardingStore.getState().start());
    expect(useOnboardingStore.getState().step).toBe('buy_goods_1');
  });

  it('advance() moves through the sequence', async () => {
    mockGetString.mockReturnValue(undefined);
    const { useOnboardingStore } = await import('../onboardingStore');
    act(() => useOnboardingStore.getState().start());
    act(() => useOnboardingStore.getState().advance());
    expect(useOnboardingStore.getState().step).toBe('collect_slot_2');
  });

  it('advance() from final_message calls complete()', async () => {
    mockGetString.mockReturnValue(undefined);
    const { useOnboardingStore } = await import('../onboardingStore');
    act(() => useOnboardingStore.getState().start());
    // Fast-forward to final_message
    const sequence: OnboardingStep[] = [
      'collect_slot_1','collect_slot_2','buy_goods_1','buy_goods_2',
      'open_elevator_1','deliver_visitor','open_elevator_2','deliver_worker',
      'assign_worker','choose_floor_type','speed_up_construction',
      'construction_tip','open_business','final_message',
    ];
    for (let i = 0; i < sequence.length - 1; i++) {
      act(() => useOnboardingStore.getState().advance());
    }
    expect(useOnboardingStore.getState().step).toBe('final_message');
    act(() => useOnboardingStore.getState().advance());
    expect(useOnboardingStore.getState().step).toBe('done');
    expect(useOnboardingStore.getState().isActive).toBe(false);
  });

  it('notifyElevatorOpened() advances only on elevator steps', async () => {
    mockGetString.mockReturnValue(undefined);
    const { useOnboardingStore } = await import('../onboardingStore');
    act(() => useOnboardingStore.getState().start());
    // Not on elevator step — no-op
    act(() => useOnboardingStore.getState().notifyElevatorOpened());
    expect(useOnboardingStore.getState().step).toBe('collect_slot_1');
    // Advance to open_elevator_1
    act(() => useOnboardingStore.getState().advance()); // → collect_slot_2
    act(() => useOnboardingStore.getState().advance()); // → buy_goods_1
    act(() => useOnboardingStore.getState().advance()); // → buy_goods_2
    act(() => useOnboardingStore.getState().advance()); // → open_elevator_1
    act(() => useOnboardingStore.getState().notifyElevatorOpened());
    expect(useOnboardingStore.getState().step).toBe('deliver_visitor');
  });

  it('restores step from MMKV on init', async () => {
    mockGetString.mockReturnValue('assign_worker');
    const { useOnboardingStore } = await import('../onboardingStore');
    expect(useOnboardingStore.getState().step).toBe('assign_worker');
    expect(useOnboardingStore.getState().isActive).toBe(true);
  });

  it('step=done restores with isActive=false', async () => {
    mockGetString.mockReturnValue('done');
    const { useOnboardingStore } = await import('../onboardingStore');
    expect(useOnboardingStore.getState().step).toBe('done');
    expect(useOnboardingStore.getState().isActive).toBe(false);
  });
});
