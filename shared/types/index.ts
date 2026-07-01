import { z } from 'zod';
import { ProductionStageSchema, ProductionSchema } from '../schemas/production';
import { CommandSchema, BuyCommandSchema, ListCommandSchema, CollectCommandSchema, AssignWorkerCommandSchema, FireWorkerCommandSchema, EvictWorkerCommandSchema, SpawnVisitorCommandSchema, LiftVisitorCommandSchema, CollectTipCommandSchema, DeliverAllCommandSchema, UpgradeElevatorCommandSchema, UpgradeLobbyCommandSchema, ClaimDailyRewardCommandSchema } from '../schemas/command';
import { GameConfigSchema, FloorConfigSchema, ProductionTypeConfigSchema, FloorTypeConfigSchema, LobbyConfigSchema } from '../schemas/gameConfig';
import { GameStateSchema } from '../schemas/gameState';
import { WorkerSchema } from '../schemas/worker';
import { VisitorSchema, VisitorRoleSchema } from '../schemas/visitor';

export type ProductionStage = z.infer<typeof ProductionStageSchema>;
export type Production = z.infer<typeof ProductionSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type BuyCommand = z.infer<typeof BuyCommandSchema>;
export type ListCommand = z.infer<typeof ListCommandSchema>;
export type CollectCommand = z.infer<typeof CollectCommandSchema>;
export type AssignWorkerCommand = z.infer<typeof AssignWorkerCommandSchema>;
export type FireWorkerCommand = z.infer<typeof FireWorkerCommandSchema>;
export type EvictWorkerCommand = z.infer<typeof EvictWorkerCommandSchema>;
export type SpawnVisitorCommand = z.infer<typeof SpawnVisitorCommandSchema>;
export type LiftVisitorCommand = z.infer<typeof LiftVisitorCommandSchema>;
export type CollectTipCommand = z.infer<typeof CollectTipCommandSchema>;
export type DeliverAllCommand = z.infer<typeof DeliverAllCommandSchema>;
export type UpgradeElevatorCommand = z.infer<typeof UpgradeElevatorCommandSchema>;
export type UpgradeLobbyCommand = z.infer<typeof UpgradeLobbyCommandSchema>;
export type ClaimDailyRewardCommand = z.infer<typeof ClaimDailyRewardCommandSchema>;
export type GameConfig = z.infer<typeof GameConfigSchema>;
export type FloorConfig = z.infer<typeof FloorConfigSchema>;
export type ProductionTypeConfig = z.infer<typeof ProductionTypeConfigSchema>;
export type FloorTypeConfig = z.infer<typeof FloorTypeConfigSchema>;
export type LobbyConfig = z.infer<typeof LobbyConfigSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type Worker = z.infer<typeof WorkerSchema>;
export type Visitor = z.infer<typeof VisitorSchema>;
export type VisitorRole = z.infer<typeof VisitorRoleSchema>;

export interface Floor {
  id: number;
  productions: Production[];
}

export type EffectiveStage = ProductionStage | 'EMPTY';

export interface DerivedStatus {
  effectiveStage: EffectiveStage;
  timeRemaining: number;
  canAct: boolean;
  actionLabel: string | null;
}
