export interface GameClock {
  now(): number;
}

class ServerClock implements GameClock {
  private offset: number = 0;

  updateOffset(serverTime: number): void {
    this.offset = serverTime - Date.now();
  }

  now(): number {
    return Date.now() + this.offset;
  }
}

export const clock: GameClock & { updateOffset: (serverTime: number) => void } = new ServerClock();
