import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async record(action: string, detail?: string, userId?: string) {
    if (this.prismaService.isConfigured) {
      return this.prismaService.auditLog.create({
        data: {
          action,
          detail,
          userId,
        },
      });
    }

    return { action, detail, userId };
  }
}