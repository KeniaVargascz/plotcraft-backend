import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ChapterQueryDto } from './dto/chapter-query.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChaptersService } from './chapters.service';
import { ChapterCommentsService } from './chapter-comments.service';

@ApiTags('chapters')
@Controller('novels/:slug/chapters')
export class ChaptersController {
  constructor(
    private readonly chaptersService: ChaptersService,
    private readonly chapterCommentsService: ChapterCommentsService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Capitulos publicados de una novela' })
  listPublishedChapters(
    @Param('slug') novelSlug: string,
    @Query() query: ChapterQueryDto,
  ) {
    return this.chaptersService.listPublishedChapters(novelSlug, query);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear capitulo en novela propia' })
  createChapter(
    @Param('slug') novelSlug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateChapterDto,
  ) {
    return this.chaptersService.createChapter(novelSlug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Get('drafts')
  @ApiOperation({ summary: 'Capitulos de borrador del autor' })
  listDraftChapters(
    @Param('slug') novelSlug: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ChapterQueryDto,
  ) {
    return this.chaptersService.listDraftChapters(novelSlug, user.sub, query);
  }

  @ApiBearerAuth()
  @Get(':chapterSlug/edit')
  @ApiOperation({ summary: 'Detalle de capitulo propio para editor' })
  getOwnedChapter(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chaptersService.getOwnedChapter(
      novelSlug,
      chapterSlug,
      user.sub,
    );
  }

  @Public()
  @Get(':chapterSlug')
  @ApiOperation({ summary: 'Detalle publico de capitulo publicado' })
  getPublishedChapter(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
  ) {
    return this.chaptersService.getPublishedChapter(novelSlug, chapterSlug);
  }

  @ApiBearerAuth()
  @Patch('reorder')
  @ApiOperation({ summary: 'Reordenar capitulos propios' })
  reorderChapters(
    @Param('slug') novelSlug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReorderChaptersDto,
  ) {
    return this.chaptersService.reorderChapters(novelSlug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':chapterSlug')
  @ApiOperation({ summary: 'Actualizar capitulo propio' })
  updateChapter(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.chaptersService.updateChapter(
      novelSlug,
      chapterSlug,
      user.sub,
      dto,
    );
  }

  @ApiBearerAuth()
  @Patch(':chapterSlug/autosave')
  @ApiOperation({ summary: 'Autosave de capitulo' })
  autosaveChapter(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.chaptersService.autosaveChapter(
      novelSlug,
      chapterSlug,
      user.sub,
      dto,
    );
  }

  @ApiBearerAuth()
  @Delete(':chapterSlug')
  @ApiOperation({ summary: 'Eliminar capitulo propio' })
  deleteChapter(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chaptersService.deleteChapter(novelSlug, chapterSlug, user.sub);
  }

  @ApiBearerAuth()
  @Post(':chapterSlug/publish')
  @ApiOperation({ summary: 'Publicar capitulo' })
  publishChapter(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chaptersService.publishChapter(
      novelSlug,
      chapterSlug,
      user.sub,
    );
  }

  @ApiBearerAuth()
  @Post(':chapterSlug/unpublish')
  @ApiOperation({ summary: 'Despublicar capitulo' })
  unpublishChapter(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chaptersService.unpublishChapter(
      novelSlug,
      chapterSlug,
      user.sub,
    );
  }

  @ApiBearerAuth()
  @Post(':chapterSlug/schedule')
  @ApiOperation({ summary: 'Programar publicacion de capitulo' })
  scheduleChapter(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUser() user: JwtPayload,
    @Body('scheduledAt') scheduledAt: string,
  ) {
    return this.chaptersService.scheduleChapter(
      novelSlug,
      chapterSlug,
      user.sub,
      scheduledAt,
    );
  }

  // ── Chapter Comments ──

  @Public()
  @Get(':chapterSlug/comments')
  @ApiOperation({ summary: 'List chapter comments' })
  listChapterComments(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chapterCommentsService.list(
      novelSlug,
      chapterSlug,
      cursor,
      limit ? +limit : 20,
    );
  }

  @ApiBearerAuth()
  @Post(':chapterSlug/comments')
  @ApiOperation({ summary: 'Comment on a chapter' })
  createChapterComment(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUser() user: JwtPayload,
    @Body('content') content: string,
  ) {
    return this.chapterCommentsService.create(
      novelSlug,
      chapterSlug,
      user.sub,
      content,
    );
  }

  @ApiBearerAuth()
  @Delete(':chapterSlug/comments/:commentId')
  @ApiOperation({ summary: 'Delete a chapter comment' })
  deleteChapterComment(
    @Param('slug') novelSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chapterCommentsService.remove(
      novelSlug,
      chapterSlug,
      commentId,
      user.sub,
    );
  }
}
