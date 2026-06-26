import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SyncService } from '../sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Command } from '@shared/types';

describe('SyncService', () => {
  let syncService: SyncService;
  let prisma: Record<string, any>;

  const mockFloors = [
    {
      id: 1,
      playerId: 'player-uuid',
      floorId: 2,
      productions: [
        { id: 1, floorDbId: 1, slotIdx: 0, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 2, floorDbId: 1, slotIdx: 1, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 3, floorDbId: 1, slotIdx: 2, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
      ],
    },
    {
      id: 2,
      playerId: 'player-uuid',
      floorId: 3,
      productions: [
        { id: 4, floorDbId: 2, slotIdx: 0, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 5, floorDbId: 2, slotIdx: 1, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 6, floorDbId: 2, slotIdx: 2, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
      ],
    },
    {
      id: 3,
      playerId: 'player-uuid',
      floorId: 4,
      productions: [
        { id: 7, floorDbId: 3, slotIdx: 0, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 8, floorDbId: 3, slotIdx: 1, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 9, floorDbId: 3, slotIdx: 2, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
      ],
    },
    {
      id: 4,
      playerId: 'player-uuid',
      floorId: 5,
      productions: [
        { id: 10, floorDbId: 4, slotIdx: 0, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 11, floorDbId: 4, slotIdx: 1, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 12, floorDbId: 4, slotIdx: 2, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
      ],
    },
    {
      id: 5,
      playerId: 'player-uuid',
      floorId: 6,
      productions: [
        { id: 13, floorDbId: 5, slotIdx: 0, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 14, floorDbId: 5, slotIdx: 1, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
        { id: 15, floorDbId: 5, slotIdx: 2, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
      ],
    },
  ];

  const mockWorkers = [
    {
      id: 'worker-1',
      playerId: 'player-uuid',
      name: 'Alice',
      female: true,
      floorType: 'green',
      dreamJob: 'baker',
      level: 1,
      hairColor: '#000',
      assignedFloorId: 2,
      assignedSlotIdx: 0,
    },
    {
      id: 'worker-2',
      playerId: 'player-uuid',
      name: 'Bob',
      female: false,
      floorType: 'green',
      dreamJob: 'baker',
      level: 1,
      hairColor: '#333',
      assignedFloorId: 2,
      assignedSlotIdx: 1,
    },
  ];

  const mockPlayer = {
    id: 'player-uuid',
    email: 'test@test.com',
    passwordHash: 'hashed',
    playerName: 'TestPlayer',
    balance: 100,
    lobbyState: null,
    stateVersion: 0,
    playerLevel: 1,
    playerXp: 0,
    lastSeenAt: new Date(Date.now() - 60000), // 60s ago
    createdAt: new Date(),
    floors: mockFloors,
    workers: mockWorkers,
  };

  let txMock: Record<string, any>;

  beforeEach(async () => {
    txMock = {
      player: { update: jest.fn().mockResolvedValue({}) },
      production: { update: jest.fn().mockResolvedValue({}) },
      worker: { upsert: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
      commandLog: { create: jest.fn().mockResolvedValue({ cursor: 1 }) },
    };

    prisma = {
      player: {
        findUnique: jest.fn(),
      },
      commandLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<void>) => {
        await fn(txMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    syncService = module.get<SyncService>(SyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processSync', () => {
    it('should return current state for empty command list', async () => {
      prisma.player.findUnique
        .mockResolvedValueOnce(mockPlayer)  // initial load
        .mockResolvedValueOnce({ ...mockPlayer }); // post-transaction load

      const result = await syncService.processSync('player-uuid', [], 0);

      expect(result.state.balance).toBe(100);
      expect(result.state.floors).toHaveLength(5);
      expect(result.stateVersion).toBe(0);
      expect(result.ackCursor).toBe(0);
      expect(result.serverTime).toBeGreaterThan(0);
    });

    it('should throw NotFoundException for unknown player', async () => {
      prisma.player.findUnique.mockResolvedValue(null);

      await expect(
        syncService.processSync('nonexistent', [], 0),
      ).rejects.toThrow(NotFoundException);
    });

    it('should process a buy command and update state', async () => {
      prisma.player.findUnique
        .mockResolvedValueOnce(mockPlayer)
        .mockResolvedValueOnce({ ...mockPlayer, stateVersion: 1 });

      const buyCmd: Command = {
        id: 'cmd-1',
        type: 'buy',
        floorId: 2,
        slotIdx: 0,
        typeId: 'bulky',
        timestamp: Date.now(),
      };

      const result = await syncService.processSync('player-uuid', [buyCmd], 0);

      expect(result.state.balance).toBe(91); // 100 - 9 (bulky buyCost 10 with 1% level-1 worker discount)
      expect(result.state.floors[0].productions[0].typeId).toBe('bulky');
      expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
      expect(result.stateVersion).toBe(1);
      expect(txMock.player.update).toHaveBeenCalled();
      expect(txMock.commandLog.create).toHaveBeenCalled();
    });

    it('should deduplicate already-processed commands', async () => {
      prisma.player.findUnique
        .mockResolvedValueOnce(mockPlayer)
        .mockResolvedValueOnce({ ...mockPlayer });
      prisma.commandLog.findMany.mockResolvedValue([{ id: 'cmd-1' }]);

      const buyCmd: Command = {
        id: 'cmd-1',
        type: 'buy',
        floorId: 2,
        slotIdx: 0,
        typeId: 'bulky',
        timestamp: Date.now(),
      };

      const result = await syncService.processSync('player-uuid', [buyCmd], 0);

      // Command was filtered out, balance unchanged
      expect(result.state.balance).toBe(100);
    });

    it('should reject commands that fail engine validation', async () => {
      prisma.player.findUnique
        .mockResolvedValueOnce(mockPlayer)
        .mockResolvedValueOnce({ ...mockPlayer });

      // Try to buy on a non-existent floor
      const badCmd: Command = {
        id: 'cmd-bad',
        type: 'buy',
        floorId: 999,
        slotIdx: 0,
        typeId: 'bulky',
        timestamp: Date.now(),
      };

      const result = await syncService.processSync('player-uuid', [badCmd], 0);

      // No commands accepted, but state is still returned
      expect(result.state.balance).toBe(100);
    });

    it('should process multiple commands in sequence', async () => {
      // Set up cursor incrementing
      let cursorCounter = 0;
      txMock.commandLog.create.mockImplementation(() => {
        cursorCounter++;
        return Promise.resolve({ cursor: cursorCounter });
      });

      prisma.player.findUnique
        .mockResolvedValueOnce(mockPlayer)
        .mockResolvedValueOnce({ ...mockPlayer, stateVersion: 1 });

      const cmds: Command[] = [
        {
          id: 'cmd-1',
          type: 'buy',
          floorId: 2,
          slotIdx: 0,
          typeId: 'bulky',
          timestamp: Date.now(),
        },
        {
          id: 'cmd-2',
          type: 'buy',
          floorId: 2,
          slotIdx: 1,
          typeId: 'bulky',
          timestamp: Date.now(),
        },
      ];

      const result = await syncService.processSync('player-uuid', cmds, 0);

      expect(result.state.balance).toBe(82); // 100 - 9 - 9 (bulky buyCost 10 with 2% discount from 2 level-1 workers)
      expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
      expect(result.state.floors[0].productions[1].stage).toBe('DELIVERING');
      expect(result.ackCursor).toBe(2);
    });

    it('should convert BigInt fields correctly from DB', async () => {
      const playerWithBigIntProd = {
        ...mockPlayer,
        floors: [
          {
            ...mockFloors[0],
            productions: [
              { id: 1, floorDbId: 1, slotIdx: 0, typeId: 'bulky', stage: 'DELIVERING', stageStartedAt: BigInt(1700000000000) },
              { id: 2, floorDbId: 1, slotIdx: 1, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
              { id: 3, floorDbId: 1, slotIdx: 2, typeId: null, stage: 'IDLE', stageStartedAt: BigInt(0) },
            ],
          },
          ...mockFloors.slice(1),
        ],
      };

      prisma.player.findUnique
        .mockResolvedValueOnce(playerWithBigIntProd)
        .mockResolvedValueOnce({ ...mockPlayer });

      const result = await syncService.processSync('player-uuid', [], 0);

      // stageStartedAt should be a regular number, not BigInt
      expect(typeof result.state.floors[0].productions[0].stageStartedAt).toBe('number');
      expect(result.state.floors[0].productions[0].stageStartedAt).toBe(1700000000000);
    });

    it('should return playerLevel and playerXp from DB', async () => {
      const playerWithLevel = { ...mockPlayer, playerLevel: 3, playerXp: 50 };
      prisma.player.findUnique
        .mockResolvedValueOnce(playerWithLevel)
        .mockResolvedValueOnce({ ...playerWithLevel });

      const result = await syncService.processSync('player-uuid', [], 0);

      expect(result.playerLevel).toBe(3);
      expect(result.playerXp).toBe(50);
    });

    it('should accumulate XP from accepted commands and return updated level', async () => {
      // balance 100 → collect command earns 25 coins → XP = 25
      // starting at level 1 with 80 XP: 80 + 25 = 105 >= xpForLevel(1)=100 → level up to 2
      const playerNearLevelUp = { ...mockPlayer, playerLevel: 1, playerXp: 80, balance: 100 };
      const playerAfterTx = {
        ...playerNearLevelUp,
        playerLevel: 2,
        playerXp: 5,       // 80 + 25 - 100 = 5
        balance: 325,      // 100 (original) + 25 (collect) + 200 (level-up coin reward for level 2)
        stateVersion: 1,
      };

      prisma.player.findUnique
        .mockResolvedValueOnce(playerNearLevelUp)
        .mockResolvedValueOnce(playerAfterTx);

      // A collect command on floor 2, slot 0 (worker-1 is assigned there)
      // Production must be in SELLING stage — mock a player whose production is SELLING
      const sellingPlayer = {
        ...playerNearLevelUp,
        floors: [
          {
            ...mockFloors[0],
            productions: [
              { id: 1, floorDbId: 1, slotIdx: 0, typeId: 'bulky', stage: 'SELLING', stageStartedAt: BigInt(0) },
              mockFloors[0].productions[1],
              mockFloors[0].productions[2],
            ],
          },
          ...mockFloors.slice(1),
        ],
      };
      prisma.player.findUnique
        .mockReset()
        .mockResolvedValueOnce(sellingPlayer)
        .mockResolvedValueOnce(playerAfterTx);

      const collectCmd: Command = {
        id: 'cmd-collect',
        type: 'collect',
        floorId: 2,
        slotIdx: 0,
        timestamp: Date.now() + 999_999,
      };

      const result = await syncService.processSync('player-uuid', [collectCmd], 0);

      expect(result.playerLevel).toBe(2);
      expect(result.playerXp).toBe(5);
    });
  });
});
