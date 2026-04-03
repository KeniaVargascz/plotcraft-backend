import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { LibraryService } from './library.service';
import { ReadingGoalDto } from './dto/reading-goal.dto';

@ApiTags('library')
@ApiBearerAuth()
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  @ApiOperation({ summary: 'Vista consolidada de la biblioteca personal' })
  getLibrary(@CurrentUser() user: JwtPayload) {
    return this.libraryService.getLibrary(user.sub);
  }

  @Get('in-progress')
  @ApiOperation({ summary: 'Novelas que el usuario esta leyendo' })
  listInProgress(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.listInProgress(user.sub, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('completed')
  @ApiOperation({ summary: 'Novelas completadas por el usuario' })
  listCompleted(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.listCompleted(user.sub, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('bookmarked')
  @ApiOperation({ summary: 'Novelas guardadas en bookmarks del usuario' })
  listBookmarked(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.listBookmarked(user.sub, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('history')
  @ApiOperation({ summary: 'Historial cronologico de lectura' })
  listHistory(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.listHistory(user.sub, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('goals')
  @ApiOperation({ summary: 'Metas de lectura del usuario' })
  listGoals(@CurrentUser() user: JwtPayload) {
    return this.libraryService.listGoals(user.sub);
  }

  @Post('goals')
  @ApiOperation({ summary: 'Crear o actualizar meta de lectura' })
  upsertGoal(@CurrentUser() user: JwtPayload, @Body() dto: ReadingGoalDto) {
    return this.libraryService.upsertGoal(user.sub, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadisticas de lectura del usuario' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.libraryService.getStats(user.sub);
  }
}
