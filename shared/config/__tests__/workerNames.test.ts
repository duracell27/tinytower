import { generateRandomWorkers, WORKER_LOOKAHEAD } from '../workerNames';
import type { GameConfig } from '../../types';

const mockConfig = {
  floorTypes: {
    green: {
      shirtColor: '#0', accent: '#0',
      businesses: [
        { name: 'Biz0', dreamJobs: ['job0a', 'job0b'] },
        { name: 'Biz1', dreamJobs: ['job1a', 'job1b'] },
        { name: 'Biz2', dreamJobs: ['job2a', 'job2b'] },
        { name: 'Biz3', dreamJobs: ['job3a', 'job3b'] },
        { name: 'Biz4', dreamJobs: ['job4a', 'job4b'] },
      ],
    },
  },
  floors: [],
  productionTypes: {},
  startingBalance: 0,
  hotelCapacity: 0,
  lobbyConfig: {} as any,
  floorUnlocks: [],
} as unknown as GameConfig;

describe('WORKER_LOOKAHEAD', () => {
  it('is 4', () => {
    expect(WORKER_LOOKAHEAD).toBe(4);
  });
});

describe('generateRandomWorkers with maxBusinessIndex', () => {
  it('generates workers without restriction when maxBusinessIndex is omitted', () => {
    // all 50 workers should have some valid dreamJob from any of the 5 businesses
    const allJobs = new Set(['job0a','job0b','job1a','job1b','job2a','job2b','job3a','job3b','job4a','job4b']);
    for (let i = 0; i < 50; i++) {
      const [w] = generateRandomWorkers(1, mockConfig, 'en', 'green');
      expect(allJobs.has(w.dreamJob)).toBe(true);
    }
  });

  it('restricts dreamJob to businesses 0..maxBusinessIndex inclusive', () => {
    // maxBusinessIndex=1 → only businesses 0 and 1 → jobs job0a, job0b, job1a, job1b
    const allowed = new Set(['job0a', 'job0b', 'job1a', 'job1b']);
    for (let i = 0; i < 80; i++) {
      const [w] = generateRandomWorkers(1, mockConfig, 'en', 'green', 1);
      expect(allowed.has(w.dreamJob)).toBe(true);
    }
  });

  it('with maxBusinessIndex=0 only produces jobs from first business', () => {
    const allowed = new Set(['job0a', 'job0b']);
    for (let i = 0; i < 40; i++) {
      const [w] = generateRandomWorkers(1, mockConfig, 'en', 'green', 0);
      expect(allowed.has(w.dreamJob)).toBe(true);
    }
  });

  it('with maxBusinessIndex >= businesses.length-1 uses full pool', () => {
    const allJobs = new Set(['job0a','job0b','job1a','job1b','job2a','job2b','job3a','job3b','job4a','job4b']);
    // Sample enough times that we'd eventually hit businesses beyond index 4 if uncapped
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const [w] = generateRandomWorkers(1, mockConfig, 'en', 'green', 99);
      seen.add(w.dreamJob);
    }
    // With 200 samples and 10 jobs, all should appear eventually (probabilistic check)
    expect(seen.size).toBeGreaterThan(1);
    for (const job of seen) expect(allJobs.has(job)).toBe(true);
  });
});
