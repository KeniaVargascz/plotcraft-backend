import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BookmarksService } from './bookmarks.service';
import { BookmarkQueryDto } from './dto/bookmark-query.dto';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';

@ApiTags('bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  @ApiOperation({ summary: 'Bookmarks del usuario paginados' })
  listAll(@CurrentUser() user: JwtPayload, @Query() query: BookmarkQueryDto) {
    return this.bookmarksService.listAll(user.sub, query);
  }

  @Get('chapter/:chapterId')
  @ApiOperation({ summary: 'Bookmarks del usuario en un capitulo' })
  listByChapter(
    @CurrentUser() user: JwtPayload,
    @Param('chapterId') chapterId: string,
  ) {
    return this.bookmarksService.listByChapter(user.sub, chapterId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear bookmark de capitulo o posicion' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBookmarkDto) {
    return this.bookmarksService.create(user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar bookmark propio' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') bookmarkId: string) {
    return this.bookmarksService.remove(user.sub, bookmarkId);
  }
}
