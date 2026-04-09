import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { loadConfig } from '../../config/app.config';
import { PrismaService } from '../../db/prisma/prisma.service';
import { SendCodeDto } from './dto/send-code.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../email/email.service';
import { SessionService } from '../session/session.service';
import { AuditService } from '../audit/audit.service';

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
}

@Injectable()
export class AuthService {
  private readonly users = new Map<string, UserRecord>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  async sendCode(dto: SendCodeDto) {
    return this.sendVerificationCode(dto, 'register', 'auth.send_code');
  }

  async sendResetCode(dto: SendCodeDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.findUserByEmail(email);

    if (!user) {
      await this.auditService.record('auth.send_reset_code.miss', email);
      return { accepted: true, email };
    }

    return this.sendVerificationCode(dto, 'reset_password', 'auth.send_reset_code');
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.findUserByEmail(email);

    if (!user) {
      throw new BadRequestException('Verification code is invalid or expired.');
    }

    if (!(await this.emailService.consumeVerificationCode(email, dto.code, 'reset_password'))) {
      throw new BadRequestException('Verification code is invalid or expired.');
    }

    const passwordHash = this.hashPassword(dto.password);
    await this.updateUserPassword(user.id, email, passwordHash);
    await this.sessionService.revokeUserSessions(user.id);
    await this.auditService.record('auth.reset_password', email, user.id);

    return { reset: true };
  }

  async sendVerificationCode(
    dto: SendCodeDto,
    purpose: 'register' | 'reset_password',
    auditAction: string,
  ) {
    const email = dto.email.trim().toLowerCase();
    const code = await this.emailService.issueVerificationCode(email, purpose);
    const sendResult = await this.emailService.sendPurposeCode(email, code, purpose);
    const config = loadConfig();

    if (sendResult.mode !== 'smtp' && !config.authDebugCodeEnabled) {
      throw new ServiceUnavailableException('Unable to send verification email. Please try again later.');
    }

    await this.auditService.record(auditAction, email);

    return config.authDebugCodeEnabled
      ? { accepted: true, email, debugCode: code }
      : { accepted: true, email };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already registered.');
    }

    if (!(await this.emailService.consumeVerificationCode(email, dto.code, 'register'))) {
      throw new BadRequestException('Verification code is invalid or expired.');
    }

    const user = await this.createUser(email, dto.password);
    await this.auditService.record('auth.register', email, user.id);

    return {
      user: {
        email: user.email,
        emailVerified: user.emailVerified,
      },
      tokens: await this.sessionService.issueTokens(user.id, email),
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.findUserByEmail(email);

    if (!user || !this.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.auditService.record('auth.login', email, user.id);
    return {
      user: {
        email: user.email,
        emailVerified: user.emailVerified,
      },
      tokens: await this.sessionService.issueTokens(user.id, email),
    };
  }

  private async findUserByEmail(email: string): Promise<UserRecord | null> {
    if (this.prismaService.isConfigured) {
      const user = await this.prismaService.user.findUnique({ where: { email } });
      return user
        ? {
            id: user.id,
            email: user.email,
            passwordHash: user.passwordHash,
            emailVerified: user.emailVerified,
          }
        : null;
    }

    return this.users.get(email) ?? null;
  }

  private async createUser(email: string, password: string): Promise<UserRecord> {
    const user: UserRecord = {
      id: randomBytes(12).toString('hex'),
      email,
      passwordHash: this.hashPassword(password),
      emailVerified: true,
    };

    if (this.prismaService.isConfigured) {
      const created = await this.prismaService.user.create({
        data: {
          email,
          passwordHash: user.passwordHash,
          emailVerified: true,
          status: 'active',
        },
      });
      return {
        id: created.id,
        email: created.email,
        passwordHash: created.passwordHash,
        emailVerified: created.emailVerified,
      };
    }

    this.users.set(email, user);
    return user;
  }

  private async updateUserPassword(userId: string, email: string, passwordHash: string) {
    if (this.prismaService.isConfigured) {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      return;
    }

    const user = this.users.get(email);
    if (user) {
      this.users.set(email, { ...user, passwordHash });
    }
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, expectedHash] = storedHash.split(':');
    const actualHash = scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    return expectedBuffer.length === actualHash.length && timingSafeEqual(expectedBuffer, actualHash);
  }
}
