import { z } from 'zod';
import { ProductionStageSchema, ProductionSchema } from '../schemas/production';
import { CommandSchema, BuyCommandSchema, ListCommandSchema, CollectCommandSchema, AssignWorkerCommandSchema, FireWorkerCommandSchema, EvictWorkerCommandSchema } from '../schemas/command';
import { GameConfigSchema, FloorConfigSchema, ProductionTypeConfigSchema, FloorTypeConfigSchema } from '../schemas/gameConfig';
import { GameStateSchema } from '../schemas/gameState';
import { WorkerSchema } from '../schemas/worker';

export type ProductionStage = z.infer<typeof ProductionStageSchema>;
export type Production = z.infer<typeof ProductionSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type BuyCommand = z.infer<typeof BuyCommandSchema>;
export type ListCommand = z.infer<typeof ListCommandSchema>;
export type CollectCommand = z.infer<typeof CollectCommandSchema>;
export type AssignWorkerCommand = z.infer<typeof AssignWorkerCommandSchema>;
export type FireWorkerCommand = z.infer<typeof FireWorkerCommandSchema>;
export type EvictWorkerCommand = z.infer<typeof EvictWorkerCommandSchema>;
export type GameConfig = z.infer<typeof GameConfigSchema>;
export type FloorConfig = z.infer<typeof FloorConfigSchema>;
export type ProductionTypeConfig = z.infer<typeof ProductionTypeConfigSchema>;
export type FloorTypeConfig = z.infer<typeof FloorTypeConfigSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type Worker = z.infer<typeof WorkerSchema>;

export interface Floor {
  id: number;
  name: string;
  productions: Production[];
}

export type EffectiveStage = ProductionStage | 'EMPTY';

export interface DerivedStatus {
  effectiveStage: EffectiveStage;
  timeRemaining: number;
  canAct: boolean;
  actionLabel: string | null;
}
