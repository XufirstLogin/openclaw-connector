import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ServerConfigService } from './server-config.service';
import { SaveServerConfigDto } from './dto/save-server-config.dto';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AuthGuard } from '../auth/auth.guard';

@Controller('me/server-config')
@UseGuards(AuthGuard)
export class ServerConfigController {
  constructor(private readonly serverConfigService: ServerConfigService) {}

  @Get()
  getCurrent(@Req() request: AuthenticatedRequest) {
    return this.serverConfigService.getCurrent(request.user.id);
  }

  @Put()
  save(@Req() request: AuthenticatedRequest, @Body() dto: SaveServerConfigDto) {
    return this.serverConfigService.save(request.user.id, dto);
  }
}