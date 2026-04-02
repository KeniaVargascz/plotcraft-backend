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
import { NovelsService } from './novels.service';

@ApiTags('novels')
@Controller('novels')
export class NovelsController {
  constructor(
    private readonly novelsService: NovelsService,
    private readonly authService: AuthService,
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
}
