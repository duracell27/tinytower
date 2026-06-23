export interface GameClock {
  now(): number;
}

export class DeviceClock implements GameClock {
  now(): number {
    return Date.now();
  }
}

export const clock: GameClock = new DeviceClock();
