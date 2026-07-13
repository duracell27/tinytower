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

export const UpgradeToSpecialistCommandSchema = z.object({
  id: z.string(),
  type: z.literal('upgrade_to_specialist'),
  workerId: z.string(),
  timestamp: z.number(),
});

export const FireAndEvictWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('fire_and_evict_worker'),
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
  pendingFloorType: z.string().optional(),
});

export const LiftVisitorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('lift_visitor'),
  role: VisitorRoleSchema,
  targetFloor: z.number().int().positive(),
});

const ToolKeySchema = z.enum(['briks', 'glass', 'nails', 'screw']);

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
  builderTool: ToolKeySchema.optional(),
});

export const DeliverAllCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('deliver_all'),
  builderTools: z.array(ToolKeySchema).optional(),
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

export const ExpandHotelCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('expand_hotel'),
});

export const FillLobbyCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('fill_lobby'),
  visitors: z.array(z.object({
    visitorId: z.string(),
    role: VisitorRoleSchema,
    targetFloor: z.number().int().positive(),
    hairColor: z.string(),
    female: z.boolean(),
    pendingFloorType: z.string().optional(),
  })),
});

export const BuyFloorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('buy_floor'),
  floorId: z.number().int(),
  requiredTools: z.array(z.object({ tool: z.enum(['briks', 'glass', 'nails', 'screw']) })),
});

export const OpenFloorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('open_floor'),
  floorId: z.number().int(),
  floorType: z.string(),
});

export const ExchangeGemsCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('exchange_gems'),
  gems: z.number().int().positive(),
});

export const SpeedUpConstructionCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('speed_up_construction'),
  floorId: z.number().int().positive(),
});

export const SpeedUpDeliveryCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('speed_up_delivery'),
  floorId: z.number().int(),
  slotIdx: z.number().int().nonnegative(),
});

export const DevAddGemsCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('dev_add_gems'),
  amount: z.number().int().positive(),
});

export const EvictLowLevelWorkersCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('evict_low_level_workers'),
});

export const CommandSchema = z.discriminatedUnion('type', [
  BuyCommandSchema,
  ListCommandSchema,
  CollectCommandSchema,
  AssignWorkerCommandSchema,
  FireWorkerCommandSchema,
  EvictWorkerCommandSchema,
  UpgradeToSpecialistCommandSchema,
  FireAndEvictWorkerCommandSchema,
  SpawnVisitorCommandSchema,
  LiftVisitorCommandSchema,
  CollectTipCommandSchema,
  DeliverAllCommandSchema,
  UpgradeElevatorCommandSchema,
  UpgradeLobbyCommandSchema,
  ClaimDailyRewardCommandSchema,
  ExpandHotelCommandSchema,
  FillLobbyCommandSchema,
  BuyFloorCommandSchema,
  OpenFloorCommandSchema,
  ExchangeGemsCommandSchema,
  SpeedUpConstructionCommandSchema,
  SpeedUpDeliveryCommandSchema,
  DevAddGemsCommandSchema,
  EvictLowLevelWorkersCommandSchema,
]);
