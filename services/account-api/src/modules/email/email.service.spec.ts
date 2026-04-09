import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../db/prisma/prisma.service';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

function createPrismaStub(isConfigured = false) {
  return {
    isConfigured,
    emailVerificationCode: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe('EmailService', () => {
  const originalEnv = process.env;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends a real email when SMTP is fully configured', async () => {
    process.env.SMTP_HOST = 'smtp.163.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'xu_zx0107@163.com';
    process.env.SMTP_PASS = 'test-auth-code';
    process.env.SMTP_FROM = 'xu_zx0107@163.com';

    const sendMail = jest.fn().mockResolvedValue({ messageId: 'mail-1' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new EmailService(createPrismaStub(false));
    await service.sendVerificationCode('receiver@example.com', '123456');

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'xu_zx0107@163.com',
        to: 'receiver@example.com',
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SMTP send succeeded'));
  });

  it('can disable strict TLS verification via env config', async () => {
    process.env.SMTP_HOST = 'smtp.163.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'xu_zx0107@163.com';
    process.env.SMTP_PASS = 'test-auth-code';
    process.env.SMTP_FROM = 'xu_zx0107@163.com';
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED = 'false';

    const sendMail = jest.fn().mockResolvedValue({ messageId: 'mail-2' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new EmailService(createPrismaStub(false));
    await service.sendVerificationCode('receiver@example.com', '123456');

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        tls: expect.objectContaining({
          rejectUnauthorized: false,
        }),
      }),
    );
  });

  it('keeps fallback behavior when SMTP is not configured', async () => {
    const service = new EmailService(createPrismaStub(false));
    await service.sendVerificationCode('receiver@example.com', '123456');

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SMTP disabled'));
  });

  it('logs a warning when SMTP send fails', async () => {
    process.env.SMTP_HOST = 'smtp.163.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'xu_zx0107@163.com';
    process.env.SMTP_PASS = 'test-auth-code';
    process.env.SMTP_FROM = 'xu_zx0107@163.com';

    const sendMail = jest.fn().mockRejectedValue(new Error('535 auth failed'));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new EmailService(createPrismaStub(false));
    await service.sendVerificationCode('receiver@example.com', '123456');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SMTP send failed'));
  });
});
