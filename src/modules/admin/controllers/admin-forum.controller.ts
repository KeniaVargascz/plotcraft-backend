import { Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminForumService } from '../services/admin-forum.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/forum')
@Controller('admin/forum')
@UseGuards(AdminGuard)
export class AdminForumController {
  constructor(private readonly forumService: AdminForumService) {}

  @Get('threads')
  @ApiOperation({ summary: 'Listar hilos del foro' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.forumService.findAllThreads({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      category, status, search,
    });
  }

  @Patch('threads/:id/pin')
  @ApiOperation({ summary: 'Pin/unpin hilo' })
  togglePin(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.forumService.togglePin(id, admin);
  }

  @Patch('threads/:id/close')
  @ApiOperation({ summary: 'Cerrar hilo' })
  close(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.forumService.close(id, admin);
  }

  @Delete('threads/:id')
  @ApiOperation({ summary: 'Eliminar hilo' })
  removeThread(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.forumService.removeThread(id, admin);
  }

  @Delete('replies/:id')
  @ApiOperation({ summary: 'Eliminar respuesta' })
  removeReply(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.forumService.removeReply(id, admin);
  }
}
