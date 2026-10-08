import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PlayerService } from '../../player/player.service';
import { REDIS_CLIENT } from '../redis.provider';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let authService: AuthService;
  let playerService: jest.Mocked<PlayerService>;
  let jwtService: jest.Mocked<JwtService>;
  let redis: Record<string, jest.Mock>;

  const mockPlayer = {
    id: 'player-uuid',
    email: 'test@test.com',
    passwordHash: 'hashed-password' as string | null,
    googleId: null as string | null,
    appleId: null as string | null,
    playerName: 'TestPlayer',
    balance: 100,
    stateVersion: 0,
    playerLevel: 1,
    playerXp: 0,
    totalBought: 0,
    totalListed: 0,
    totalCollected: 0,
    totalPassengersLifted: 0,
    maxRevenuePerMin: 0,
    openedFloorsCount: 0,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    referralCode: null,
    city: null,
    isAdmin: false,
    isTemporary: false,
  };

  beforeEach(async () => {
    redis = {
      exists: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      setex: jest.fn().mockResolvedValue('OK'),
      keys: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PlayerService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByPlayerName: jest.fn(),
            findByGoogleId: jest.fn(),
            findByAppleId: jest.fn(),
            createWithInitialState: jest.fn(),
            linkSocialId: jest.fn(),
            unlinkSocialId: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_ACCESS_TTL: '15m',
                JWT_REFRESH_TTL: '30d',
                GOOGLE_CLIENT_ID: 'test-google-client-id',
                APPLE_CLIENT_ID: 'com.test.app',
              };
              return config[key];
            }),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: redis,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    playerService = module.get(PlayerService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new player and return tokens', async () => {
      playerService.findByEmail.mockResolvedValue(null);
      playerService.createWithInitialState.mockResolvedValue(mockPlayer);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await authService.register({
        email: 'test@test.com',
        password: '123456',
        playerName: 'TestPlayer',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.player).toEqual({
        id: 'player-uuid',
        email: 'test@test.com',
        playerName: 'TestPlayer',
        isAdmin: false,
      isTemporary: false,
      });
      expect(playerService.createWithInitialState).toHaveBeenCalledWith(
        'test@test.com', 'hashed-password', 'TestPlayer',
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      playerService.findByEmail.mockResolvedValue(mockPlayer);

      await expect(
        authService.register({
          email: 'test@test.com',
          password: '123456',
          playerName: 'TestPlayer',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials and return tokens', async () => {
      playerService.findByEmail.mockResolvedValue(mockPlayer);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login({
        email: 'test@test.com',
        password: '123456',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.player.id).toBe('player-uuid');
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      playerService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'wrong@test.com', password: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      playerService.findByEmail.mockResolvedValue(mockPlayer);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'player-uuid', jti: 'token-jti' } as any);
      redis.exists.mockResolvedValue(1);
      playerService.findById.mockResolvedValue(mockPlayer);

      const result = await authService.refresh('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(redis.del).toHaveBeenCalledWith('refresh:player-uuid:token-jti');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(authService.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for revoked refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'player-uuid', jti: 'token-jti' } as any);
      redis.exists.mockResolvedValue(0);

      await expect(authService.refresh('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should delete all refresh tokens for the player', async () => {
      redis.keys.mockResolvedValue(['refresh:player-uuid:jti1', 'refresh:player-uuid:jti2']);

      await authService.logout('player-uuid');

      expect(redis.del).toHaveBeenCalledWith(
        'refresh:player-uuid:jti1',
        'refresh:player-uuid:jti2',
      );
    });

    it('should handle logout when no refresh tokens exist', async () => {
      redis.keys.mockResolvedValue([]);

      await authService.logout('player-uuid');

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('loginWithGoogle', () => {
    it('returns tokens for existing google account', async () => {
      const googlePlayer = { ...mockPlayer, googleId: 'google-uid-123' };
      jest.spyOn(authService as unknown as { verifyGoogleToken: () => Promise<unknown> }, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-uid-123', email: 'g@gmail.com', name: 'Gtest',
      });
      playerService.findByGoogleId = jest.fn().mockResolvedValue(googlePlayer);
      jwtService.sign.mockReturnValue('token');
      redis.setex.mockResolvedValue('OK');

      const result = await authService.loginWithGoogle('fake-id-token');
      expect(result.player.id).toBe('player-uuid');
      expect(playerService.findByGoogleId).toHaveBeenCalledWith('google-uid-123');
    });

    it('creates new player when google account not found', async () => {
      jest.spyOn(authService as unknown as { verifyGoogleToken: () => Promise<unknown> }, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-new-uid', email: 'new@gmail.com', name: 'NewUser',
      });
      playerService.findByGoogleId = jest.fn().mockResolvedValue(null);
      playerService.findByPlayerName = jest.fn().mockResolvedValue(null);
      playerService.createWithInitialState = jest.fn().mockResolvedValue(mockPlayer);
      playerService.linkSocialId = jest.fn().mockResolvedValue(mockPlayer);
      jwtService.sign.mockReturnValue('token');
      redis.setex.mockResolvedValue('OK');

      await authService.loginWithGoogle('fake-id-token');
      expect(playerService.createWithInitialState).toHaveBeenCalled();
      expect(playerService.linkSocialId).toHaveBeenCalledWith(mockPlayer.id, 'google', 'google-new-uid');
    });
  });

  describe('convertWithGoogle', () => {
    it('returns 409 conflict when googleId belongs to another player', async () => {
      const otherPlayer = { ...mockPlayer, id: 'other-id', playerName: 'OtherGuy' };
      jest.spyOn(authService as unknown as { verifyGoogleToken: () => Promise<unknown> }, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-uid-taken', email: 'x@gmail.com', name: 'X',
      });
      playerService.findByGoogleId = jest.fn().mockResolvedValue(otherPlayer);

      await expect(authService.convertWithGoogle('player-uuid', 'fake-token', false))
        .rejects.toMatchObject({ status: 409, existingPlayerName: 'OtherGuy' });
    });

    it('links and returns tokens when googleId is free', async () => {
      jest.spyOn(authService as unknown as { verifyGoogleToken: () => Promise<unknown> }, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-free-uid', email: 'free@gmail.com', name: 'Free',
      });
      playerService.findByGoogleId = jest.fn().mockResolvedValue(null);
      playerService.linkSocialId = jest.fn().mockResolvedValue(mockPlayer);
      jwtService.sign.mockReturnValue('token');
      redis.setex.mockResolvedValue('OK');

      const result = await authService.convertWithGoogle('player-uuid', 'fake-token', false);
      expect(result.player.id).toBe('player-uuid');
      expect(playerService.linkSocialId).toHaveBeenCalledWith('player-uuid', 'google', 'google-free-uid');
    });

    it('unlinks from old player then links to current when overwrite=true', async () => {
      const otherPlayer = { ...mockPlayer, id: 'other-id', playerName: 'OtherGuy' };
      jest.spyOn(authService as unknown as { verifyGoogleToken: () => Promise<unknown> }, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-taken', email: 'x@gmail.com', name: 'X',
      });
      playerService.findByGoogleId = jest.fn().mockResolvedValue(otherPlayer);
      playerService.unlinkSocialId = jest.fn().mockResolvedValue(undefined);
      playerService.linkSocialId = jest.fn().mockResolvedValue(mockPlayer);
      jwtService.sign.mockReturnValue('token');
      redis.setex.mockResolvedValue('OK');

      await authService.convertWithGoogle('player-uuid', 'fake-token', true);
      expect(playerService.unlinkSocialId).toHaveBeenCalledWith('other-id', 'google');
      expect(playerService.linkSocialId).toHaveBeenCalledWith('player-uuid', 'google', 'google-taken');
    });
  });
});
