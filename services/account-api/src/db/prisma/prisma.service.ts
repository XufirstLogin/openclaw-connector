import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  get isConfigured() {
    return Boolean(process.env.DATABASE_URL);
  }

  async onModuleInit() {
    if (this.isConfigured) {
      await this.$connect();
    }
  }

  async onModuleDestroy() {
    if (this.isConfigured) {
      await this.$disconnect();
    }
  }
}