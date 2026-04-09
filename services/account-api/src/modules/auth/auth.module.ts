import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailModule } from '../email/email.module';
import { SessionModule } from '../session/session.module';
import { AuditModule } from '../audit/audit.module';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [EmailModule, SessionModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}