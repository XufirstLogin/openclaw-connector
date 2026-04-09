import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { SessionService } from '../session/session.service';
import { AuthService } from './auth.service';

function createPrismaStub() {
  return {
    isConfigured: false,
  } as PrismaService;
}

function createEmailServiceStub() {
  return {
    issueVerificationCode: jest.fn().mockResolvedValue('123456'),
    sendVerificationCode: jest.fn().mockResolvedValue({ mode: 'debug' }),
    sendPurposeCode: jest.fn().mockResolvedValue({ mode: 'debug' }),
    consumeVerificationCode: jest.fn(),
  } as unknown as EmailService;
}

function createSessionServiceStub() {
  return {
    issueTokens: jest.fn(),
  } as unknown as SessionService;
}

function createAuditServiceStub() {
  return {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
}

describe('AuthService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws when real-user mode cannot deliver a verification email', async () => {
    process.env.AUTH_DEBUG_CODE_ENABLED = 'false';

    const authService = new AuthService(
      createPrismaStub(),
      createEmailServiceStub(),
      createSessionServiceStub(),
      createAuditServiceStub(),
    );

    await expect(authService.sendCode({ email: 'user@example.com' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns debugCode only in debug-enabled mode', async () => {
    process.env.AUTH_DEBUG_CODE_ENABLED = 'true';

    const authService = new AuthService(
      createPrismaStub(),
      createEmailServiceStub(),
      createSessionServiceStub(),
      createAuditServiceStub(),
    );

    await expect(authService.sendCode({ email: 'user@example.com' })).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
        email: 'user@example.com',
        debugCode: '123456',
      }),
    );
  });

  it('returns debugCode for reset-password flow in debug-enabled mode', async () => {
    process.env.AUTH_DEBUG_CODE_ENABLED = 'true';

    const authService = new AuthService(
      createPrismaStub(),
      createEmailServiceStub(),
      createSessionServiceStub(),
      createAuditServiceStub(),
    );

    (authService as any).users.set('user@example.com', {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'salt:hash',
      emailVerified: true,
    });

    await expect(authService.sendResetCode({ email: 'user@example.com' })).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
        email: 'user@example.com',
        debugCode: '123456',
      }),
    );
  });
});
