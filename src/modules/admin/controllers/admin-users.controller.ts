import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminUsersService } from '../services/admin-users.service';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/users')
@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios con filtros' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('isAdmin') isAdmin?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.usersService.findAll({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      search,
      status,
      isAdmin: isAdmin === 'true' ? true : isAdmin === 'false' ? false : undefined,
      sort: sort || 'createdAt',
      order: (order as 'asc' | 'desc') || 'desc',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de usuario con stats' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar status de usuario (suspend, ban, activate)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.updateStatus(id, dto, admin);
  }

  @Patch(':id/admin')
  @ApiOperation({ summary: 'Toggle admin role' })
  toggleAdmin(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.toggleAdmin(id, admin);
  }
}
