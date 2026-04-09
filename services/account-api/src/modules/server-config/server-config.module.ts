import { Module } from '@nestjs/common';
import { ServerConfigController } from './server-config.controller';
import { ServerConfigService } from './server-config.service';
import { CryptoModule } from '../crypto/crypto.module';
import { SessionModule } from '../session/session.module';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [CryptoModule, SessionModule],
  controllers: [ServerConfigController],
  providers: [ServerConfigService, AuthGuard],
  exports: [ServerConfigService],
})
export class ServerConfigModule {}