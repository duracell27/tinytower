// Cumulative XP required to REACH each level (index = level - 1).
// Source: per-level thresholds provided in design spec.
// cityXp = SUM of all members' playerXp; level derived from this array.
export const CITY_LEVEL_THRESHOLDS: number[] = [
  0,             // level 1
  1_000_000,     // level 2
  2_500_000,     // level 3
  4_500_000,     // level 4
  7_000_000,     // level 5
  10_000_000,    // level 6
  13_500_000,    // level 7
  17_500_000,    // level 8
  22_500_000,    // level 9
  28_500_000,    // level 10
  35_500_000,    // level 11
  43_500_000,    // level 12
  52_500_000,    // level 13
  64_400_000,    // level 14
  85_020_000,    // level 15
  120_620_000,   // level 16
  181_820_000,   // level 17
  286_670_000,   // level 18
  465_740_000,   // level 19
  770_740_000,   // level 20
  1_288_910_000, // level 21
  2_167_260_000, // level 22
  3_647_260_000, // level 23
  6_147_260_000, // level 24
  10_367_260_000,// level 25
  17_477_260_000,// level 26
  29_427_260_000,// level 27
  49_477_260_000,// level 28
  83_087_260_000,// level 29
  139_347_260_000,// level 30
  233_417_260_000,// level 31
  390_547_260_000,// level 32
  652_737_260_000,// level 33
  1_089_837_260_000,// level 34
  1_817_867_260_000,// level 35
  2_717_867_260_000,// level 36
  3_827_867_260_000,// level 37
  5_195_867_260_000,// level 38
  6_880_667_260_000,// level 39
  8_880_667_260_000,// level 40
  11_904_667_260_000,// level 41
  14_928_667_260_000,// level 42
  18_644_467_260_000,// level 43
  23_206_387_260_000,// level 44
  29_956_387_260_000,// level 45
  38_236_387_260_000,// level 46
  48_388_387_260_000,// level 47
  60_829_987_260_000,// level 48
  76_070_983_260_000,// level 49
  94_733_383_260_000,// level 50
  118_527_939_260_000,// level 51
  143_799_939_260_000,// level 52
  175_997_439_260_000,// level 53
  217_003_689_260_000,// level 54
  282_158_066_260_000,// level 55
  354_025_316_260_000,// level 56
  449_121_093_260_000,// level 57
  574_914_428_260_000,// level 58
  741_265_314_260_000,// level 59
  961_187_462_260_000,// level 60
  1_251_850_266_260_000,// level 61
  1_557_046_270_260_000,// level 62
  1_877_501_554_260_000,// level 63 (approximate beyond 62)
  2_213_980_217_260_000,// level 64
  2_567_282_773_260_000,// level 65
  2_938_249_442_260_000,// level 66
  3_327_765_549_260_000,// level 67
  3_736_757_437_260_000,// level 68
  4_166_198_884_260_000,// level 69
  4_617_112_439_260_000,// level 70
  5_090_571_661_260_000,// level 71
  5_587_703_880_260_000,// level 72
  6_109_692_704_260_000,// level 73
  6_657_780_928_260_000,// level 74
  7_233_273_593_260_000,// level 75
  7_837_553_057_260_000,// level 76
  8_472_033_721_260_000,// level 77
  9_138_238_389_260_000,// level 78
  9_837_753_280_260_000,// level 79
];

export const MAX_CITY_LEVEL = CITY_LEVEL_THRESHOLDS.length;

export function getCityLevel(xp: number): number {
  let level = 1;
  for (let i = 1; i < CITY_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= CITY_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

export function getCityMaxMembers(level: number): number {
  return 8 + level * 2;
}

export function getCityXpForNextLevel(level: number): number | null {
  const idx = level; // threshold for level+1 is at index `level`
  if (idx >= CITY_LEVEL_THRESHOLDS.length) return null;
  return CITY_LEVEL_THRESHOLDS[idx];
}
