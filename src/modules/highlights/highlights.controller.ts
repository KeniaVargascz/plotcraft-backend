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
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { HighlightQueryDto } from './dto/highlight-query.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import { HighlightsService } from './highlights.service';

@ApiTags('highlights')
@ApiBearerAuth()
@Controller('highlights')
export class HighlightsController {
  constructor(private readonly highlightsService: HighlightsService) {}

  @Get('chapter/:chapterId')
  @ApiOperation({ summary: 'Highlights del usuario en un capitulo' })
  listByChapter(
    @CurrentUser() user: JwtPayload,
    @Param('chapterId') chapterId: string,
  ) {
    return this.highlightsService.listByChapter(user.sub, chapterId);
  }

  @Get()
  @ApiOperation({ summary: 'Todos los highlights del usuario' })
  listAll(@CurrentUser() user: JwtPayload, @Query() query: HighlightQueryDto) {
    return this.highlightsService.listAll(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Crear highlight en un capitulo' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateHighlightDto) {
    return this.highlightsService.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar color o nota de un highlight propio' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') highlightId: string,
    @Body() dto: UpdateHighlightDto,
  ) {
    return this.highlightsService.update(user.sub, highlightId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar highlight propio' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') highlightId: string) {
    return this.highlightsService.remove(user.sub, highlightId);
  }
}
