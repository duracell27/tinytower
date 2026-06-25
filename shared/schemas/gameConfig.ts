import { z } from 'zod';

export const ProductionTypeConfigSchema = z.object({
  buyCost: z.number().positive(),
  deliveryDuration: z.number().positive(),
  sellDuration: z.number().positive(),
  batchValue: z.number().positive(),
  displayName: z.string(),
});

export const FloorTypeConfigSchema = z.object({
  category: z.string(),
  shirtColor: z.string(),
  accent: z.string(),
  dreamJobs: z.array(z.string()).min(1),
});

export const FloorConfigSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slots: z.number().int().min(1).max(3),
  floorType: z.string(),
  availableTypes: z.array(z.string()).min(1),
});

export const LobbyConfigSchema = z.object({
  visitorSpawnInterval: z.number().positive(),
  dailyTipsTarget: z.number().positive(),
  dailyTipsReward: z.number().int().positive(),
  dailyGemLimitBase: z.number().int().positive(),
  guestTipBase: z.number().positive(),
  businessmanFallbackBase: z.number().positive(),
  deliverySpeedBonus: z.number().min(0).max(1),
  sellSpeedBonus: z.number().min(0).max(1),
  elevatorUpgradeBaseCost: z.number().int().positive(),
  lobbyUpgradeBaseCost: z.number().int().positive(),
  lobbyUpgradeSeats: z.number().int().positive(),
  defaultLobbyCapacity: z.number().int().positive(),
});

export const GameConfigSchema = z.object({
  floors: z.array(FloorConfigSchema).min(1),
  productionTypes: z.record(z.string(), ProductionTypeConfigSchema),
  floorTypes: z.record(z.string(), FloorTypeConfigSchema),
  startingBalance: z.number().nonnegative(),
  hotelCapacity: z.number().int().positive(),
  lobbyConfig: LobbyConfigSchema,
});
