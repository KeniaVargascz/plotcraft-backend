import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminSettingsService } from '../services/admin-settings.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/settings')
@Controller('admin/settings')
@UseGuards(AdminGuard)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener configuración de plataforma' })
  getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  @ApiOperation({ summary: 'Actualizar configuración' })
  update(@Body() body: Record<string, string>, @CurrentUser() admin: JwtPayload) {
    return this.settingsService.update(body, admin);
  }
}
