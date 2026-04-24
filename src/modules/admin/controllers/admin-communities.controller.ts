import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminCommunitiesService } from '../services/admin-communities.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/communities')
@Controller('admin/communities')
@UseGuards(AdminGuard)
export class AdminCommunitiesController {
  constructor(private readonly communitiesService: AdminCommunitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar comunidades con filtros' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.communitiesService.findAll({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      status,
      type,
      search,
    });
  }

  @Get('pending/count')
  @ApiOperation({ summary: 'Cantidad de comunidades pendientes' })
  pendingCount() {
    return this.communitiesService.pendingCount();
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar comunidad' })
  approve(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.communitiesService.approve(id, admin);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Rechazar comunidad' })
  reject(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.communitiesService.reject(id, body.reason, admin);
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspender comunidad activa' })
  suspend(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.communitiesService.suspend(id, admin);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Reactivar comunidad suspendida' })
  activate(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.communitiesService.activate(id, admin);
  }
}
