import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminPostsService } from '../services/admin-posts.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/posts')
@Controller('admin/posts')
@UseGuards(AdminGuard)
export class AdminPostsController {
  constructor(private readonly postsService: AdminPostsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar posts con filtros' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('authorId') authorId?: string,
    @Query('search') search?: string,
  ) {
    return this.postsService.findAll({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      type, authorId, search,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar post (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.postsService.remove(id, admin);
  }
}
