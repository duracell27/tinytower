import { z } from 'zod';
import { VisitorRoleSchema } from './visitor';

const ProductionBaseSchema = z.object({
  id: z.string(),
  floorId: z.number().int(),
  slotIdx: z.number().int(),
  timestamp: z.number(),
});

export const BuyCommandSchema = ProductionBaseSchema.extend({
  type: z.literal('buy'),
  typeId: z.string(),
});

export const ListCommandSchema = ProductionBaseSchema.extend({
  type: z.literal('list'),
});

export const CollectCommandSchema = ProductionBaseSchema.extend({
  type: z.literal('collect'),
});

export const AssignWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('assign_worker'),
  workerId: z.string(),
  floorId: z.number().int(),
  slotIdx: z.number().int(),
  timestamp: z.number(),
});

export const FireWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('fire_worker'),
  workerId: z.string(),
  timestamp: z.number(),
});

export const EvictWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('evict_worker'),
  workerId: z.string(),
  timestamp: z.number(),
});

const TimestampedBaseSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
});

export const SpawnVisitorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('spawn_visitor'),
  visitorId: z.string(),
  role: VisitorRoleSchema,
  targetFloor: z.number().int().positive(),
  hairColor: z.string(),
  female: z.boolean(),
});

export const LiftVisitorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('lift_visitor'),
  role: VisitorRoleSchema,
  targetFloor: z.number().int().positive(),
});

export const CollectTipCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('collect_tip'),
  newWorker: z.object({
    id: z.string(),
    name: z.string(),
    female: z.boolean(),
    floorType: z.string(),
    dreamJob: z.string(),
    level: z.number().int().min(1).max(9),
    hairColor: z.string(),
  }).optional(),
});

export const DeliverAllCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('deliver_all'),
});

export const UpgradeElevatorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_elevator'),
});

export const UpgradeLobbyCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_lobby'),
});

export const ClaimDailyRewardCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('claim_daily_reward'),
});

export const CommandSchema = z.discriminatedUnion('type', [
  BuyCommandSchema,
  ListCommandSchema,
  CollectCommandSchema,
  AssignWorkerCommandSchema,
  FireWorkerCommandSchema,
  EvictWorkerCommandSchema,
  SpawnVisitorCommandSchema,
  LiftVisitorCommandSchema,
  CollectTipCommandSchema,
  DeliverAllCommandSchema,
  UpgradeElevatorCommandSchema,
  UpgradeLobbyCommandSchema,
  ClaimDailyRewardCommandSchema,
]);
