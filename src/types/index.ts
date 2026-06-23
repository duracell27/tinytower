import { z } from 'zod';
import { ProductionStageSchema, ProductionSchema } from '../schemas/production';
import { CommandSchema, BuyCommandSchema, ListCommandSchema, CollectCommandSchema } from '../schemas/command';
import { GameConfigSchema, FloorConfigSchema, ProductionTypeConfigSchema } from '../schemas/gameConfig';
import { GameStateSchema } from '../schemas/gameState';

export type ProductionStage = z.infer<typeof ProductionStageSchema>;
export type Production = z.infer<typeof ProductionSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type BuyCommand = z.infer<typeof BuyCommandSchema>;
export type ListCommand = z.infer<typeof ListCommandSchema>;
export type CollectCommand = z.infer<typeof CollectCommandSchema>;
export type GameConfig = z.infer<typeof GameConfigSchema>;
export type FloorConfig = z.infer<typeof FloorConfigSchema>;
export type ProductionTypeConfig = z.infer<typeof ProductionTypeConfigSchema>;
export type GameState = z.infer<typeof GameStateSchema>;

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
