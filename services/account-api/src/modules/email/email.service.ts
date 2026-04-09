import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { loadConfig } from '../../config/app.config';
import { PrismaService } from '../../db/prisma/prisma.service';

interface VerificationCodeRecord {
  code: string;
  expiresAt: number;
}

@Injectable()
export class EmailService {
  private readonly codes = new Map<string, VerificationCodeRecord>();
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly prismaService: PrismaService) {
    const config = this.getRuntimeConfig();
    this.logger.log(
      `SMTP ${config.smtpEnabled ? 'enabled' : 'disabled'} (host=${config.smtpHost || 'unset'}, user=${config.smtpUser || 'unset'})`,
    );
  }

  private getRuntimeConfig() {
    return loadConfig();
  }

  private getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const config = this.getRuntimeConfig();
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      tls: {
        rejectUnauthorized: config.smtpTlsRejectUnauthorized,
      },
    });

    return this.transporter;
  }

  async issueVerificationCode(
    email: string,
    purpose: 'register' | 'reset_password' | 'login' = 'register',
  ): Promise<string> {
    const code = String(Math.floor(100000 + Math.random() * 900000));

    if (this.prismaService.isConfigured) {
      await this.prismaService.emailVerificationCode.deleteMany({
        where: { email, purpose },
      });
      await this.prismaService.emailVerificationCode.create({
        data: {
          email,
          code,
          purpose,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    } else {
      this.codes.set(`${email}:${purpose}`, {
        code,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
    }

    return code;
  }

  async consumeVerificationCode(
    email: string,
    code: string,
    purpose: 'register' | 'reset_password' | 'login' = 'register',
  ): Promise<boolean> {
    if (this.prismaService.isConfigured) {
      const record = await this.prismaService.emailVerificationCode.findFirst({
        where: {
          email,
          code,
          purpose,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        return false;
      }

      await this.prismaService.emailVerificationCode.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      return true;
    }

    const key = `${email}:${purpose}`;
    const record = this.codes.get(key);
    const isValid = Boolean(record && record.code === code && record.expiresAt > Date.now());
    if (isValid) {
      this.codes.delete(key);
    }
    return isValid;
  }

  async sendVerificationCode(email: string, code: string) {
    return this.sendPurposeCode(email, code, 'register');
  }

  async sendPurposeCode(
    email: string,
    code: string,
    purpose: 'register' | 'reset_password' | 'login' = 'register',
  ) {
    const config = this.getRuntimeConfig();
    if (!config.smtpEnabled) {
      this.logger.log(`SMTP disabled; using debug fallback for ${email}`);
      return { email, code, queued: true, mode: 'debug' as const };
    }

    const subject =
      purpose === 'reset_password'
        ? 'OpenClaw Connector Password Reset Code'
        : 'OpenClaw Connector Verification Code';
    const actionText = purpose === 'reset_password' ? 'password reset code' : 'verification code';

    try {
      this.logger.log(`Sending verification email via SMTP to ${email}`);
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: config.smtpFrom,
        to: email,
        subject,
        text: `Your OpenClaw Connector ${actionText} is ${code}. It is valid for 5 minutes. If you did not request this code, please ignore this email.`,
        html: `<div><h2>${subject}</h2><p>Your ${actionText} is <strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p><p>It is valid for 5 minutes. If you did not request this code, please ignore this email.</p></div>`,
      });

      this.logger.log(`SMTP send succeeded for ${email}: ${info.messageId ?? 'no-message-id'}`);

      return {
        email,
        queued: true,
        mode: 'smtp' as const,
        messageId: info.messageId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`SMTP send failed for ${email}: ${message}`);
      return { email, code, queued: true, mode: 'debug' as const };
    }
  }
}
