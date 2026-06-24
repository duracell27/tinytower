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
    passwordHash: 'hashed-password',
    playerName: 'TestPlayer',
    balance: 100,
    stateVersion: 0,
    lastSeenAt: new Date(),
    createdAt: new Date(),
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
            createWithInitialState: jest.fn(),
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
});
