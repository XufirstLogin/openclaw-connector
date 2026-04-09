import { describe, expect, it } from 'vitest';
import {
  type AuthTokens,
  type ConnectionStatus,
  type LoginRequest,
  type RegisterRequest,
  type SaveServerConfigRequest,
  type SendCodeRequest,
  type ServerConfigDto,
  DEFAULT_LOCAL_OPENCLAW_URL,
} from './index';

describe('shared contracts', () => {
  it('exports the MVP auth and config contract shapes', () => {
    const sendCode: SendCodeRequest = { email: 'user@example.com' };
    const register: RegisterRequest = {
      email: 'user@example.com',
      code: '123456',
      password: 'P@ssword123',
    };
    const login: LoginRequest = {
      email: 'user@example.com',
      password: 'P@ssword123',
    };
    const tokens: AuthTokens = {
      accessToken: 'access',
      refreshToken: 'refresh',
    };
    const config: SaveServerConfigRequest = {
      serverIp: '121.41.211.153',
      sshPort: 22,
      sshUsername: 'root',
      authType: 'password',
      sshPassword: 'secret',
      openclawToken: 'token',
    };
    const status: ConnectionStatus = 'disconnected';
    const dto: ServerConfigDto = {
      serverIp: config.serverIp,
      sshPort: config.sshPort,
      sshUsername: config.sshUsername,
      authType: config.authType,
      sshPassword: config.sshPassword,
      sshPrivateKey: undefined,
      openclawToken: config.openclawToken,
    };

    expect(sendCode.email).toBe('user@example.com');
    expect(register.code).toBe('123456');
    expect(login.password).toBe('P@ssword123');
    expect(tokens.refreshToken).toBe('refresh');
    expect(dto.serverIp).toBe('121.41.211.153');
    expect(status).toBe('disconnected');
    expect(DEFAULT_LOCAL_OPENCLAW_URL).toBe('http://127.0.0.1:18789');
  });
});
