import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { AdminAuditService } from '../services/admin-audit.service';

@ApiTags('admin/audit')
@Controller('admin/audit-logs')
@UseGuards(AdminGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: 'Listar audit logs con filtros' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('adminId') adminId?: string,
  ) {
    return this.auditService.findAll({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      action,
      resourceType,
      adminId,
    });
  }
}
