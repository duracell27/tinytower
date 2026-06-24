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

interface GameActions {
  buy: (floorId: number, slotIdx: number, typeId: string) => void;
  list: (floorId: number, slotIdx: number) => void;
  collect: (floorId: number, slotIdx: number) => void;
  liftVisitor: () => void;
  hydrate: (state: GameState) => void;
}

type GameStore = GameState & BuildingState & GameActions;

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
  }),
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
