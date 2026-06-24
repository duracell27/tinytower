import { create } from 'zustand';
import { processCommand } from '../../shared/engine/processCommand';
import { gameConfig, createInitialState } from '../../shared/config/gameConfig';
import { clock } from '../services/clock';
import type { GameState, Command, Floor } from '../../shared/types';

const COMMAND_QUEUE_CAP = 10_000;

interface BuildingState {
  hotelOccupied: number;
  hotelTotal: number;
  visitors: number;
}

interface SyncState {
  lastAckCursor: number;
  stateVersion: number;
}

interface GameActions {
  buy: (floorId: number, slotIdx: number, typeId: string) => void;
  list: (floorId: number, slotIdx: number) => void;
  collect: (floorId: number, slotIdx: number) => void;
  liftVisitor: () => void;
  hydrate: (state: GameState & Partial<SyncState>) => void;
  reconcile: (state: GameState, stateVersion: number, ackCursor: number) => void;
  clearAckedCommands: (ackCursor: number) => void;
}

type GameStore = GameState & BuildingState & SyncState & GameActions;

function executeCommand(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  command: Command,
) {
  const { balance, floors, commandQueue } = get();
  const result = processCommand({ balance, floors, commandQueue }, command, gameConfig, command.timestamp);
  if (!result.success) return;

  let newQueue = [...result.state.commandQueue, command];
  if (newQueue.length > COMMAND_QUEUE_CAP) {
    newQueue = newQueue.slice(newQueue.length - COMMAND_QUEUE_CAP);
  }

  set({
    balance: result.state.balance,
    floors: result.state.floors,
    commandQueue: newQueue,
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(gameConfig),
  hotelOccupied: 20,
  hotelTotal: 32,
  visitors: 3,
  lastAckCursor: 0,
  stateVersion: 0,

  buy: (floorId, slotIdx, typeId) => {
    executeCommand(get, set, {
      id: crypto.randomUUID(),
      type: 'buy',
      floorId,
      slotIdx,
      typeId,
      timestamp: clock.now(),
    });
  },

  list: (floorId, slotIdx) => {
    executeCommand(get, set, {
      id: crypto.randomUUID(),
      type: 'list',
      floorId,
      slotIdx,
      timestamp: clock.now(),
    });
  },

  collect: (floorId, slotIdx) => {
    executeCommand(get, set, {
      id: crypto.randomUUID(),
      type: 'collect',
      floorId,
      slotIdx,
      timestamp: clock.now(),
    });
  },

  liftVisitor: () => {
    const { visitors, hotelOccupied, hotelTotal } = get();
    if (visitors <= 0) return;
    set({
      visitors: visitors - 1,
      hotelOccupied: Math.min(hotelOccupied + 1, hotelTotal),
    });
  },

  hydrate: (state) => set({
    balance: state.balance,
    floors: state.floors,
    commandQueue: state.commandQueue,
    lastAckCursor: state.lastAckCursor ?? 0,
    stateVersion: state.stateVersion ?? 0,
  }),

  reconcile: (serverState, newVersion, ackCursor) => set({
    balance: serverState.balance,
    floors: serverState.floors,
    stateVersion: newVersion,
    lastAckCursor: ackCursor,
    commandQueue: [],
  }),

  clearAckedCommands: (ackCursor) => set((state) => ({
    lastAckCursor: ackCursor,
    commandQueue: state.commandQueue,
  })),
}));

export function useBalance(): number {
  return useGameStore((state) => state.balance);
}

export function useFloor(floorId: number): Floor {
  return useGameStore(
    (state) => state.floors.find(f => f.id === floorId)!,
    (a, b) => a.id === b.id && a.productions === b.productions,
  );
}
