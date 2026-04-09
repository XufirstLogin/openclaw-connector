import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { ServerConfigModule } from './modules/server-config/server-config.module';
import { CryptoModule } from './modules/crypto/crypto.module';
import { SessionModule } from './modules/session/session.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    DbModule,
    AuthModule,
    EmailModule,
    ServerConfigModule,
    CryptoModule,
    SessionModule,
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
