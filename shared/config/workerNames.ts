import type { GameConfig, Worker } from '../types';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const WORKER_NAMES = {
  male: [
    'Коля Некрасов', 'Дима Громов', 'Миша Шевчук', 'Андрій Семенов',
    'Ваня Вайнер', 'Олег Кравченко', 'Тарас Мельник', 'Богдан Ткаченко',
    'Роман Бондаренко', 'Ігор Шевченко',
  ],
  female: [
    'Надя Бєлкіна', 'Саша Яшина', 'Маша Громова', 'Ірина Коваль',
    'Оля Петренко', 'Юля Сидоренко', 'Аня Лисенко', 'Катя Бойко',
    'Даша Коваленко', 'Віка Мороз',
  ],
};

export const HAIR_COLORS = [
  '#5C3A22', '#E0A93C', '#C9923A', '#4A3322',
  '#6B4A2E', '#7A5430', '#D8A24A', '#B5763A',
];

export function generateRandomWorkers(count: number, config: GameConfig): Worker[] {
  const floorTypeKeys = Object.keys(config.floorTypes);
  const workers: Worker[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const female = Math.random() < 0.5;
    const namePool = female ? WORKER_NAMES.female : WORKER_NAMES.male;
    let name: string;
    do {
      name = namePool[Math.floor(Math.random() * namePool.length)];
    } while (usedNames.has(name));
    usedNames.add(name);

    const floorType = floorTypeKeys[Math.floor(Math.random() * floorTypeKeys.length)];
    const ftConfig = config.floorTypes[floorType];
    const dreamJob = ftConfig.dreamJobs[Math.floor(Math.random() * ftConfig.dreamJobs.length)];

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
    });
  }

  return workers;
}
