import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminFeaturesService } from '../services/admin-features.service';
import { UpdateFeatureFlagDto } from '../dto/update-feature-flag.dto';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/features')
@Controller('admin/features')
@UseGuards(AdminGuard)
export class AdminFeaturesController {
  constructor(private readonly featuresService: AdminFeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los feature flags agrupados' })
  findAll() {
    return this.featuresService.findAllGrouped();
  }

  @Get('active')
  @ApiOperation({ summary: 'Listar solo los feature flags activos (para PlotCraft frontend)' })
  findActive() {
    return this.featuresService.findActive();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Actualizar un feature flag' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.featuresService.update(key, dto, user);
  }

  @Patch('group/:group/toggle')
  @ApiOperation({ summary: 'Toggle todos los flags de un grupo' })
  toggleGroup(
    @Param('group') group: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.featuresService.toggleGroup(group, dto.enabled, user);
  }
}
