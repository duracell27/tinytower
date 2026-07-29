type CoinCost = { kind: 'coins'; coins: number; tokens: number };
type GemCost  = { kind: 'gems';  gems: number };
export type BusinessUpgradeCost = CoinCost | GemCost;

export const BUSINESS_UPGRADE_COSTS: BusinessUpgradeCost[] = [
  { kind: 'coins', coins: 1_000,           tokens: 3   }, // level 1  → +5%
  { kind: 'coins', coins: 2_500,           tokens: 3   }, // level 2  → +10%
  { kind: 'coins', coins: 5_000,           tokens: 4   }, // level 3  → +15%
  { kind: 'coins', coins: 10_000,          tokens: 5   }, // level 4  → +20%
  { kind: 'gems',  gems:  50              },              // level 5  → +25%
  { kind: 'coins', coins: 15_000,          tokens: 5   }, // level 6  → +30%
  { kind: 'coins', coins: 30_000,          tokens: 6   }, // level 7  → +35%
  { kind: 'coins', coins: 50_000,          tokens: 7   }, // level 8  → +40%
  { kind: 'gems',  gems:  100             },              // level 9  → +45%
  { kind: 'coins', coins: 50_000,          tokens: 8   }, // level 10 → +50%
  { kind: 'coins', coins: 100_000,         tokens: 9   }, // level 11 → +55%
  { kind: 'coins', coins: 200_000,         tokens: 10  }, // level 12 → +60%
  { kind: 'gems',  gems:  200             },              // level 13 → +65%
  { kind: 'coins', coins: 200_000,         tokens: 12  }, // level 14 → +70%
  { kind: 'coins', coins: 350_000,         tokens: 14  }, // level 15 → +75%
  { kind: 'coins', coins: 500_000,         tokens: 16  }, // level 16 → +80%
  { kind: 'gems',  gems:  400             },              // level 17 → +85%
  { kind: 'coins', coins: 500_000,         tokens: 18  }, // level 18 → +90%
  { kind: 'coins', coins: 750_000,         tokens: 20  }, // level 19 → +95%
  { kind: 'coins', coins: 1_000_000,       tokens: 25  }, // level 20 → +100%
  { kind: 'gems',  gems:  1_000           },              // level 21 → +105%
  { kind: 'coins', coins: 1_500_000,       tokens: 28  }, // level 22 → +110%
  { kind: 'coins', coins: 2_000_000,       tokens: 30  }, // level 23 → +115%
  { kind: 'coins', coins: 3_000_000,       tokens: 35  }, // level 24 → +120%
  { kind: 'gems',  gems:  2_000           },              // level 25 → +125%
  { kind: 'coins', coins: 3_000_000,       tokens: 40  }, // level 26 → +130%
  { kind: 'coins', coins: 5_000_000,       tokens: 50  }, // level 27 → +135%
  { kind: 'coins', coins: 7_000_000,       tokens: 55  }, // level 28 → +140%
  { kind: 'gems',  gems:  5_000           },              // level 29 → +145%
  { kind: 'coins', coins: 10_000_000,      tokens: 60  }, // level 30 → +150%
  { kind: 'coins', coins: 25_000_000,      tokens: 70  }, // level 31 → +155%
  { kind: 'coins', coins: 50_000_000,      tokens: 80  }, // level 32 → +160%
  { kind: 'gems',  gems:  8_000           },              // level 33 → +165%
  { kind: 'coins', coins: 100_000_000,     tokens: 100 }, // level 34 → +170%
  { kind: 'coins', coins: 250_000_000,     tokens: 110 }, // level 35 → +175%
  { kind: 'coins', coins: 500_000_000,     tokens: 125 }, // level 36 → +180%
  { kind: 'gems',  gems:  10_000          },              // level 37 → +185%
  { kind: 'coins', coins: 1_000_000_000,   tokens: 145 }, // level 38 → +190%
  { kind: 'coins', coins: 2_500_000_000,   tokens: 165 }, // level 39 → +195%
  { kind: 'coins', coins: 5_000_000_000,   tokens: 200 }, // level 40 → +200%
];
