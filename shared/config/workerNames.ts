import type { GameConfig, Worker } from '../types';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type SupportedWorkerLocale = 'en';

interface WorkerNamePool {
  male: string[];
  female: string[];
}

export const WORKER_NAME_POOLS: Record<SupportedWorkerLocale, WorkerNamePool> = {
  en: {
    male: [
      'Cole Nichols', 'Dean Grover', 'Mike Shevchuk', 'Andrew Simmons',
      'Van Weiner', 'Oliver Craig', 'Terry Miller', 'Bo Tucker',
      'Roman Bond', 'Gregory Ivens',
    ],
    female: [
      'Nadia Belkin', 'Sasha Yashin', 'Mary Grover', 'Irene Cole',
      'Olive Peters', 'Julia Sidon', 'Anna Foxley', 'Kate Boyko',
      'Dasha Cole', 'Vicky Frost',
    ],
  },
};

const DEFAULT_WORKER_LOCALE: SupportedWorkerLocale = 'en';

export const HAIR_COLORS = [
  '#5C3A22', '#E0A93C', '#C9923A', '#4A3322',
  '#6B4A2E', '#7A5430', '#D8A24A', '#B5763A',
];

export function generateRandomWorkers(
  count: number,
  config: GameConfig,
  locale: SupportedWorkerLocale = DEFAULT_WORKER_LOCALE,
  floorTypeOverride?: string,
): Worker[] {
  const floorTypeKeys = Object.keys(config.floorTypes);
  const workers: Worker[] = [];
  const usedNames = new Set<string>();
  const pool = WORKER_NAME_POOLS[locale];

  for (let i = 0; i < count; i++) {
    const female = Math.random() < 0.5;
    const namePool = female ? pool.female : pool.male;
    let name: string;
    do {
      name = namePool[Math.floor(Math.random() * namePool.length)];
    } while (usedNames.has(name));
    usedNames.add(name);

    const floorType = (floorTypeOverride && config.floorTypes[floorTypeOverride])
      ? floorTypeOverride
      : floorTypeKeys[Math.floor(Math.random() * floorTypeKeys.length)];
    const ftConfig = config.floorTypes[floorType];
    const business = ftConfig.businesses[Math.floor(Math.random() * ftConfig.businesses.length)];
    const dreamJob = business.dreamJobs[Math.floor(Math.random() * business.dreamJobs.length)];

    workers.push({
      id: uuidv4(),
      name,
      female,
      floorType,
      dreamJob,
      level: 1 + Math.floor(Math.random() * 9),
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      assignedFloorId: null,
      assignedSlotIdx: null,
      isSpecialist: false,
    });
  }

  return workers;
}
