import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma/prisma.service';
import { SaveServerConfigDto } from './dto/save-server-config.dto';
import { CryptoService } from '../crypto/crypto.service';

interface StoredConfigRecord {
  serverIp: string;
  sshPort: number;
  sshUsername: string;
  authType: 'password' | 'key';
  sshPassword?: string;
  sshPrivateKey?: string;
  openclawToken: string;
}

@Injectable()
export class ServerConfigService {
  private readonly configs = new Map<string, StoredConfigRecord>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async save(userId: string, dto: SaveServerConfigDto) {
    const stored = {
      ...dto,
      sshPassword: dto.sshPassword ? this.cryptoService.encrypt(dto.sshPassword) : undefined,
      sshPrivateKey: dto.sshPrivateKey ? this.cryptoService.encrypt(dto.sshPrivateKey) : undefined,
      openclawToken: this.cryptoService.encrypt(dto.openclawToken),
    };

    if (this.prismaService.isConfigured) {
      await this.prismaService.userServerConfig.upsert({
        where: { userId },
        update: {
          serverIp: stored.serverIp,
          sshPort: stored.sshPort,
          sshUsername: stored.sshUsername,
          authType: stored.authType,
          sshPasswordEncrypted: stored.sshPassword,
          sshPrivateKeyEncrypted: stored.sshPrivateKey,
          openclawTokenEncrypted: stored.openclawToken,
        },
        create: {
          userId,
          serverIp: stored.serverIp,
          sshPort: stored.sshPort,
          sshUsername: stored.sshUsername,
          authType: stored.authType,
          sshPasswordEncrypted: stored.sshPassword,
          sshPrivateKeyEncrypted: stored.sshPrivateKey,
          openclawTokenEncrypted: stored.openclawToken,
        },
      });
    } else {
      this.configs.set(userId, stored);
    }

    return { saved: true };
  }

  async getCurrent(userId: string) {
    if (this.prismaService.isConfigured) {
      const config = await this.prismaService.userServerConfig.findUnique({ where: { userId } });
      if (!config) {
        return null;
      }

      return {
        serverIp: config.serverIp,
        sshPort: config.sshPort,
        sshUsername: config.sshUsername,
        authType: config.authType,
        sshPassword: config.sshPasswordEncrypted ? this.cryptoService.decrypt(config.sshPasswordEncrypted) : undefined,
        sshPrivateKey: config.sshPrivateKeyEncrypted ? this.cryptoService.decrypt(config.sshPrivateKeyEncrypted) : undefined,
        openclawToken: this.cryptoService.decrypt(config.openclawTokenEncrypted),
      };
    }

    const config = this.configs.get(userId);
    if (!config) {
      return null;
    }

    return {
      ...config,
      sshPassword: config.sshPassword ? this.cryptoService.decrypt(config.sshPassword) : undefined,
      sshPrivateKey: config.sshPrivateKey ? this.cryptoService.decrypt(config.sshPrivateKey) : undefined,
      openclawToken: this.cryptoService.decrypt(config.openclawToken),
    };
  }
}