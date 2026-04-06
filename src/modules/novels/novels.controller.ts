import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateNovelDto } from './dto/create-novel.dto';
import { NovelQueryDto } from './dto/novel-query.dto';
import { UpdateNovelDto } from './dto/update-novel.dto';
import { KudosService } from './kudos.service';
import { NovelsService } from './novels.service';
import { TimelineService } from '../timeline/timeline.service';
import { PlannerService } from '../planner/planner.service';

@ApiTags('novels')
@Controller('novels')
export class NovelsController {
  constructor(
    private readonly novelsService: NovelsService,
    private readonly kudosService: KudosService,
    private readonly authService: AuthService,
    private readonly timelineService: TimelineService,
    private readonly plannerService: PlannerService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Catalogo publico de novelas' })
  async listPublicNovels(
    @Query() query: NovelQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);

    return this.novelsService.listPublicNovels(query, viewer?.sub ?? null);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Listado de mis novelas' })
  listMyNovels(@CurrentUser() user: JwtPayload, @Query() query: NovelQueryDto) {
    return this.novelsService.listMyNovels(user.sub, query);
  }

  @Public()
  @Get('user/:username')
  @ApiOperation({ summary: 'Novelas publicas de un autor' })
  async listUserNovels(
    @Param('username') username: string,
    @Query() query: NovelQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);

    return this.novelsService.listUserNovels(
      username,
      query,
      viewer?.sub ?? null,
    );
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Detalle de una novela' })
  async getNovelBySlug(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);

    return this.novelsService.getNovelBySlug(slug, viewer?.sub ?? null);
  }

  @Public()
  @Get(':slug/characters')
  @ApiOperation({ summary: 'Personajes vinculados a una novela' })
  async listNovelCharacters(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);

    return this.novelsService.listNovelCharacters(slug, viewer?.sub ?? null);
  }

  @ApiBearerAuth()
  @Get(':slug/timeline')
  @ApiOperation({ summary: 'Timeline vinculado a esta novela (upsert)' })
  getNovelTimeline(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.timelineService.upsertByNovel(slug, user.sub);
  }

  @ApiBearerAuth()
  @Get(':slug/planner')
  @ApiOperation({ summary: 'Planner vinculado a esta novela (upsert)' })
  getNovelPlanner(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.plannerService.upsertByNovel(slug, user.sub);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear novela' })
  createNovel(@CurrentUser() user: JwtPayload, @Body() dto: CreateNovelDto) {
    return this.novelsService.createNovel(user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':slug')
  @ApiOperation({ summary: 'Editar novela propia' })
  updateNovel(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNovelDto,
  ) {
    return this.novelsService.updateNovel(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':slug')
  @ApiOperation({ summary: 'Eliminar novela propia' })
  deleteNovel(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.novelsService.deleteNovel(slug, user.sub);
  }

  @ApiBearerAuth()
  @Post(':slug/like')
  @ApiOperation({ summary: 'Toggle like sobre una novela' })
  toggleLike(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.novelsService.toggleLike(slug, user.sub);
  }

  @ApiBearerAuth()
  @Post(':slug/bookmark')
  @ApiOperation({ summary: 'Toggle bookmark sobre una novela' })
  toggleBookmark(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.novelsService.toggleBookmark(slug, user.sub);
  }

  @ApiBearerAuth()
  @Post(':slug/kudos')
  @ApiOperation({ summary: 'Dar kudo a una novela' })
  addKudo(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.kudosService.addKudo(slug, user.sub);
  }

  @ApiBearerAuth()
  @Delete(':slug/kudos')
  @ApiOperation({ summary: 'Quitar kudo de una novela' })
  removeKudo(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.kudosService.removeKudo(slug, user.sub);
  }
}
