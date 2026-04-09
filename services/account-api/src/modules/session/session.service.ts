import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma/prisma.service';

interface SessionRecord {
  userId: string;
  email: string;
  refreshToken: string;
}

@Injectable()
export class SessionService {
  private readonly accessTokens = new Map<string, SessionRecord>();

  constructor(private readonly prismaService: PrismaService) {}

  async issueTokens(userId: string, email: string) {
    const accessToken = randomBytes(24).toString('hex');
    const refreshToken = randomBytes(24).toString('hex');

    if (this.prismaService.isConfigured) {
      await this.prismaService.userSession.create({
        data: {
          userId,
          accessTokenHash: this.hashToken(accessToken),
          refreshTokenHash: this.hashToken(refreshToken),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          clientType: 'desktop',
        },
      });
    } else {
      this.accessTokens.set(accessToken, { userId, email, refreshToken });
    }

    return { accessToken, refreshToken };
  }

  async validateAccessToken(accessToken: string): Promise<{ userId: string; email: string } | null> {
    if (this.prismaService.isConfigured) {
      const session = await this.prismaService.userSession.findFirst({
        where: {
          accessTokenHash: this.hashToken(accessToken),
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!session) {
        return null;
      }

      return {
        userId: session.userId,
        email: session.user.email,
      };
    }

    const session = this.accessTokens.get(accessToken);
    return session ? { userId: session.userId, email: session.email } : null;
  }

  async revokeUserSessions(userId: string) {
    if (this.prismaService.isConfigured) {
      await this.prismaService.userSession.deleteMany({ where: { userId } });
      return;
    }

    for (const [accessToken, session] of this.accessTokens.entries()) {
      if (session.userId === userId) {
        this.accessTokens.delete(accessToken);
      }
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
