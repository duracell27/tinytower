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
  isVip: z.boolean().optional(),
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

const ToolKeySchema = z.enum(['briks', 'glass', 'nails', 'screw', 'wood', 'cement']);

const WorkerDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  female: z.boolean(),
  floorType: z.string(),
  dreamJob: z.string(),
  level: z.number().int().min(1).max(9),
  hairColor: z.string(),
});

export const CollectTipCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('collect_tip'),
  newWorker: WorkerDataSchema.optional(),
  newWorkers: z.array(WorkerDataSchema).optional(),
  builderTool: ToolKeySchema.optional(),
  builderTools: z.array(ToolKeySchema).optional(),
});

export const DeliverAllCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('deliver_all'),
  builderTools: z.array(ToolKeySchema).optional(),
  preGeneratedWorkers: z.array(WorkerDataSchema).optional(),
  vipGuestWorkerBatches: z.array(z.array(WorkerDataSchema)).optional(),
});

export const UpgradeElevatorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_elevator'),
});

export const UpgradeLobbyCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_lobby'),
});

export const ClaimDailyRewardCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('claim_daily_reward'),
  stage: z.union([z.literal(1), z.literal(2)]),
});

export const ExpandHotelCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('expand_hotel'),
});

export const FillLobbyCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('fill_lobby'),
  visitors: z.array(z.object({
    visitorId: z.string(),
    role: VisitorRoleSchema,
    isVip: z.boolean().optional(),
    targetFloor: z.number().int().positive(),
    hairColor: z.string(),
    female: z.boolean(),
    pendingFloorType: z.string().optional(),
  })),
});

export const BuyFloorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('buy_floor'),
  floorId: z.number().int(),
  requiredTools: z.array(z.object({ tool: z.enum(['briks', 'glass', 'nails', 'screw', 'wood', 'cement']) })),
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

export const ShopPurchaseCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('shop_purchase'),
  gems:   z.number().int().nonnegative().default(0),
  tools: z.object({
    briks:  z.number().int().nonnegative().default(0),
    glass:  z.number().int().nonnegative().default(0),
    nails:  z.number().int().nonnegative().default(0),
    screw:  z.number().int().nonnegative().default(0),
    wood:   z.number().int().nonnegative().default(0),
    cement: z.number().int().nonnegative().default(0),
  }).default({ briks: 0, glass: 0, nails: 0, screw: 0, wood: 0, cement: 0 }),
  tokens: z.object({
    green:  z.number().int().nonnegative().default(0),
    blue:   z.number().int().nonnegative().default(0),
    yellow: z.number().int().nonnegative().default(0),
    purple: z.number().int().nonnegative().default(0),
    red:    z.number().int().nonnegative().default(0),
  }).default({ green: 0, blue: 0, yellow: 0, purple: 0, red: 0 }),
});

export const EvictLowLevelWorkersCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('evict_low_level_workers'),
});

export const CollectAllCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('collect_all'),
});

export const ListAllCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('list_all'),
});

export const BuyAllCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('buy_all'),
});

export const ClaimDailyTaskCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('claim_daily_task'),
  taskKey: z.string(),
  tokenCount: z.number().int().min(1).max(5),
  tokenColor: z.enum(['green', 'blue', 'yellow', 'purple', 'red']),
  materialType: z.enum(['briks', 'glass', 'nails', 'screw', 'wood', 'cement']).optional(),
});

export const UpgradeBusinessCategoryCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_business_category'),
  floorType: z.enum(['green', 'blue', 'yellow', 'purple', 'red']),
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
  ShopPurchaseCommandSchema,
  EvictLowLevelWorkersCommandSchema,
  CollectAllCommandSchema,
  ListAllCommandSchema,
  BuyAllCommandSchema,
  ClaimDailyTaskCommandSchema,
  UpgradeBusinessCategoryCommandSchema,
]);
