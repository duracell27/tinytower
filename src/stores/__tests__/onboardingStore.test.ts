import { act } from 'react';
import type { OnboardingStep } from '../onboardingStore';

// Mock MMKV before importing store
const mockSet = jest.fn();
const mockRemove = jest.fn();
const mockGetString = jest.fn<string | undefined, []>(() => undefined);
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ set: mockSet, getString: mockGetString, remove: mockRemove }),
}));

// Reset module between tests so store re-initializes
beforeEach(() => {
  jest.resetModules();
  mockSet.mockClear();
  mockGetString.mockClear();
  mockRemove.mockClear();
});

describe('onboardingStore', () => {
  describe('start()', () => {
    it('sets step to intro when no prior state', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().start());
      expect(useOnboardingStore.getState().step).toBe('intro');
      expect(useOnboardingStore.getState().isActive).toBe(true);
      expect(mockSet).toHaveBeenCalledWith('step', 'intro');
    });

    it('is a no-op when step already exists', async () => {
      mockGetString.mockReturnValue('buy_goods_1');
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().start());
      expect(useOnboardingStore.getState().step).toBe('buy_goods_1');
    });
  });

  describe('advance()', () => {
    it('moves to the next step in sequence', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().start()); // → intro
      act(() => useOnboardingStore.getState().advance()); // → collect_slot_1
      expect(useOnboardingStore.getState().step).toBe('collect_slot_1');
    });

    it('clears targetRect and arrowRect on each advance', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().start());
      act(() => useOnboardingStore.getState().setTargetRect({ x: 10, y: 20, width: 100, height: 50 }));
      act(() => useOnboardingStore.getState().setArrowRect({ x: 5, y: 5, width: 20, height: 20 }));
      act(() => useOnboardingStore.getState().advance());
      expect(useOnboardingStore.getState().targetRect).toBeNull();
      expect(useOnboardingStore.getState().arrowRect).toBeNull();
    });

    it('calls complete() when advancing from final_message', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().start());
      // Advance through every step up to (but not including) final_message
      const { SEQUENCE } = await import('../onboardingStore');
      for (let i = 0; i < SEQUENCE.length - 1; i++) {
        act(() => useOnboardingStore.getState().advance());
      }
      expect(useOnboardingStore.getState().step).toBe('final_message');
      act(() => useOnboardingStore.getState().advance());
      expect(useOnboardingStore.getState().step).toBe('done');
      expect(useOnboardingStore.getState().isActive).toBe(false);
    });

    it('is a no-op when step is null', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().advance());
      expect(useOnboardingStore.getState().step).toBeNull();
    });

    it('is a no-op when step is done', async () => {
      mockGetString.mockReturnValue('done');
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().advance());
      expect(useOnboardingStore.getState().step).toBe('done');
    });
  });

  describe('complete()', () => {
    it('sets step to done and isActive to false', async () => {
      mockGetString.mockReturnValue('open_business');
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().complete());
      expect(useOnboardingStore.getState().step).toBe('done');
      expect(useOnboardingStore.getState().isActive).toBe(false);
      expect(mockSet).toHaveBeenCalledWith('step', 'done');
    });
  });

  describe('reset()', () => {
    it('clears step, isActive and rects, and removes MMKV key', async () => {
      mockGetString.mockReturnValue('assign_worker');
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().setTargetRect({ x: 1, y: 2, width: 3, height: 4 }));
      act(() => useOnboardingStore.getState().reset());
      const state = useOnboardingStore.getState();
      expect(state.step).toBeNull();
      expect(state.isActive).toBe(false);
      expect(state.targetRect).toBeNull();
      expect(state.arrowRect).toBeNull();
      expect(mockRemove).toHaveBeenCalledWith('step');
    });
  });

  describe('goToStep()', () => {
    it('jumps to a given step and persists to MMKV', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().goToStep('buy_floor'));
      expect(useOnboardingStore.getState().step).toBe('buy_floor');
      expect(useOnboardingStore.getState().isActive).toBe(true);
      expect(mockSet).toHaveBeenCalledWith('step', 'buy_floor');
    });

    it('sets isActive=false when jumping to done', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().goToStep('done'));
      expect(useOnboardingStore.getState().isActive).toBe(false);
    });

    it('clears rects when jumping', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().setTargetRect({ x: 0, y: 0, width: 50, height: 50 }));
      act(() => useOnboardingStore.getState().goToStep('choose_floor_type'));
      expect(useOnboardingStore.getState().targetRect).toBeNull();
      expect(useOnboardingStore.getState().arrowRect).toBeNull();
    });
  });

  describe('notifyElevatorOpened()', () => {
    it('advances to deliver_visitor when on open_elevator_1', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().start());           // → intro
      act(() => useOnboardingStore.getState().advance());         // → collect_slot_1
      act(() => useOnboardingStore.getState().advance());         // → collect_slot_2
      act(() => useOnboardingStore.getState().advance());         // → buy_goods_1
      act(() => useOnboardingStore.getState().advance());         // → buy_goods_2
      act(() => useOnboardingStore.getState().advance());         // → open_elevator_1
      act(() => useOnboardingStore.getState().notifyElevatorOpened());
      expect(useOnboardingStore.getState().step).toBe('deliver_visitor');
    });

    it('is a no-op when not on an elevator step', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().start()); // → intro
      act(() => useOnboardingStore.getState().notifyElevatorOpened());
      expect(useOnboardingStore.getState().step).toBe('intro');
    });
  });

  describe('setTargetRect() / setArrowRect()', () => {
    it('stores the provided rects', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      const rect = { x: 10, y: 20, width: 100, height: 50 };
      act(() => useOnboardingStore.getState().setTargetRect(rect));
      act(() => useOnboardingStore.getState().setArrowRect(rect));
      expect(useOnboardingStore.getState().targetRect).toEqual(rect);
      expect(useOnboardingStore.getState().arrowRect).toEqual(rect);
    });

    it('clears rects when null is passed', async () => {
      mockGetString.mockReturnValue(undefined);
      const { useOnboardingStore } = await import('../onboardingStore');
      act(() => useOnboardingStore.getState().setTargetRect({ x: 1, y: 1, width: 1, height: 1 }));
      act(() => useOnboardingStore.getState().setTargetRect(null));
      expect(useOnboardingStore.getState().targetRect).toBeNull();
    });
  });

  describe('persistence', () => {
    it('restores an in-progress step from MMKV with isActive=true', async () => {
      mockGetString.mockReturnValue('assign_worker');
      const { useOnboardingStore } = await import('../onboardingStore');
      expect(useOnboardingStore.getState().step).toBe('assign_worker');
      expect(useOnboardingStore.getState().isActive).toBe(true);
    });

    it('restores step=done with isActive=false', async () => {
      mockGetString.mockReturnValue('done');
      const { useOnboardingStore } = await import('../onboardingStore');
      expect(useOnboardingStore.getState().step).toBe('done');
      expect(useOnboardingStore.getState().isActive).toBe(false);
    });
  });
});
