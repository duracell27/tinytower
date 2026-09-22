import type { ShopPackData } from '../types';

export const SHOP_PACKS_DATA: ShopPackData[] = [
  // Diamonds
  { id: 'diamonds_1', rcProductId: 'com.shmidt.vibetower.shop.diamonds_1', priceUsd: 0.99,  rewards: { gems: 200 } },
  { id: 'diamonds_2', rcProductId: 'com.shmidt.vibetower.shop.diamonds_2', priceUsd: 1.99,  rewards: { gems: 420 } },
  { id: 'diamonds_3', rcProductId: 'com.shmidt.vibetower.shop.diamonds_3', priceUsd: 4.99,  rewards: { gems: 1100 } },
  { id: 'diamonds_4', rcProductId: 'com.shmidt.vibetower.shop.diamonds_4', priceUsd: 9.99,  rewards: { gems: 2300 } },
  { id: 'diamonds_5', rcProductId: 'com.shmidt.vibetower.shop.diamonds_5', priceUsd: 19.99, rewards: { gems: 4800 } },
  { id: 'diamonds_6', rcProductId: 'com.shmidt.vibetower.shop.diamonds_6', priceUsd: 49.99, rewards: { gems: 12500 } },
  // Bundles
  { id: 'bundle_1', rcProductId: 'com.shmidt.vibetower.shop.bundle_1', priceUsd: 1.99,
    rewards: { gems: 150, tools: { briks: 3, glass: 3, nails: 3, screw: 3, wood: 3, cement: 3 }, tokens: { green: 3, blue: 3, yellow: 3, purple: 3, red: 3 } } },
  { id: 'bundle_2', rcProductId: 'com.shmidt.vibetower.shop.bundle_2', priceUsd: 4.99,
    rewards: { gems: 500, tools: { briks: 8, glass: 8, nails: 8, screw: 8, wood: 8, cement: 8 }, tokens: { green: 8, blue: 8, yellow: 8, purple: 8, red: 8 } } },
  { id: 'bundle_3', rcProductId: 'com.shmidt.vibetower.shop.bundle_3', priceUsd: 9.99,
    rewards: { gems: 1100, tools: { briks: 15, glass: 15, nails: 15, screw: 15, wood: 15, cement: 15 }, tokens: { green: 20, blue: 20, yellow: 20, purple: 20, red: 20 } } },
  { id: 'bundle_4', rcProductId: 'com.shmidt.vibetower.shop.bundle_4', priceUsd: 24.99,
    rewards: { gems: 3000, tools: { briks: 30, glass: 30, nails: 30, screw: 30, wood: 30, cement: 30 }, tokens: { green: 50, blue: 50, yellow: 50, purple: 50, red: 50 } } },
  // Builder
  { id: 'builder_1', rcProductId: 'com.shmidt.vibetower.shop.builder_1', priceUsd: 1.99,
    rewards: { gems: 100, tools: { briks: 5, glass: 5, nails: 5, screw: 5, wood: 5, cement: 5 } } },
  { id: 'builder_2', rcProductId: 'com.shmidt.vibetower.shop.builder_2', priceUsd: 3.99,
    rewards: { gems: 250, tools: { briks: 12, glass: 12, nails: 12, screw: 12, wood: 12, cement: 12 } } },
  { id: 'builder_3', rcProductId: 'com.shmidt.vibetower.shop.builder_3', priceUsd: 7.99,
    rewards: { gems: 600, tools: { briks: 25, glass: 25, nails: 25, screw: 25, wood: 25, cement: 25 } } },
  { id: 'builder_4', rcProductId: 'com.shmidt.vibetower.shop.builder_4', priceUsd: 14.99,
    rewards: { gems: 1200, tools: { briks: 50, glass: 50, nails: 50, screw: 50, wood: 50, cement: 50 } } },
  // Materials
  { id: 'mat_briks',  rcProductId: 'com.shmidt.vibetower.shop.mat_briks',  priceUsd: 0.99, rewards: { tools: { briks:  5 } } },
  { id: 'mat_glass',  rcProductId: 'com.shmidt.vibetower.shop.mat_glass',  priceUsd: 0.99, rewards: { tools: { glass:  5 } } },
  { id: 'mat_nails',  rcProductId: 'com.shmidt.vibetower.shop.mat_nails',  priceUsd: 0.99, rewards: { tools: { nails:  5 } } },
  { id: 'mat_screw',  rcProductId: 'com.shmidt.vibetower.shop.mat_screw',  priceUsd: 0.99, rewards: { tools: { screw:  5 } } },
  { id: 'mat_wood',   rcProductId: 'com.shmidt.vibetower.shop.mat_wood',   priceUsd: 0.99, rewards: { tools: { wood:   5 } } },
  { id: 'mat_cement', rcProductId: 'com.shmidt.vibetower.shop.mat_cement', priceUsd: 0.99, rewards: { tools: { cement: 5 } } },
];

export const SHOP_PACKS_MAP: Record<string, ShopPackData> =
  Object.fromEntries(SHOP_PACKS_DATA.map(p => [p.id, p]));

export const SHOP_PACKS_BY_RC_PRODUCT: Record<string, ShopPackData> =
  Object.fromEntries(SHOP_PACKS_DATA.map(p => [p.rcProductId, p]));
