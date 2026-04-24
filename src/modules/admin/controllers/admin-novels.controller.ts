import { Controller, Delete, Get, Param, Patch, Query, UseGuards, Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminNovelsService } from '../services/admin-novels.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/novels')
@Controller('admin/novels')
@UseGuards(AdminGuard)
export class AdminNovelsController {
  constructor(private readonly novelsService: AdminNovelsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar novelas con filtros' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('rating') rating?: string,
    @Query('authorId') authorId?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.novelsService.findAll({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      search, status, rating, authorId,
      sort: sort || 'createdAt',
      order: (order as 'asc' | 'desc') || 'desc',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de novela con stats' })
  findOne(@Param('id') id: string) {
    return this.novelsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Moderar novela (cambiar status, visibility)' })
  moderate(
    @Param('id') id: string,
    @Body() body: { status?: string; isPublic?: boolean },
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.novelsService.moderate(id, body, admin);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar novela' })
  remove(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.novelsService.remove(id, admin);
  }
}
