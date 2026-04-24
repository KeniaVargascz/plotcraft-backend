import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@ApiTags('admin/dashboard')
@Controller('admin/dashboard')
@UseGuards(AdminGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Métricas globales de la plataforma' })
  getStats() {
    return this.dashboardService.getGlobalStats();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Actividad reciente de la plataforma' })
  getActivity(@Query('days') days?: string) {
    return this.dashboardService.getRecentActivity(Number(days) || 7);
  }
}
