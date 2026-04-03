import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ReaderPreferencesDto } from './dto/reader-preferences.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { ReaderService } from './reader.service';

@ApiTags('reader')
@ApiBearerAuth()
@Controller('reader')
export class ReaderController {
  constructor(private readonly readerService: ReaderService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Obtener preferencias del lector autenticado' })
  getPreferences(@CurrentUser() user: JwtPayload) {
    return this.readerService.getPreferences(user.sub);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Actualizar preferencias del lector autenticado' })
  updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReaderPreferencesDto,
  ) {
    return this.readerService.updatePreferences(user.sub, dto);
  }

  @Get('progress/:novelId')
  @ApiOperation({ summary: 'Obtener progreso de lectura de una novela' })
  getProgress(
    @CurrentUser() user: JwtPayload,
    @Param('novelId') novelId: string,
  ) {
    return this.readerService.getProgress(user.sub, novelId);
  }

  @Post('progress')
  @ApiOperation({ summary: 'Guardar o actualizar progreso de lectura' })
  saveProgress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.readerService.saveProgress(user.sub, dto);
  }

  @Post('history')
  @ApiOperation({ summary: 'Registrar apertura de un capitulo' })
  addHistory(
    @CurrentUser() user: JwtPayload,
    @Body('novel_id') novelId: string,
    @Body('chapter_id') chapterId: string,
  ) {
    return this.readerService.createHistoryEntry(user.sub, novelId, chapterId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Historial de lectura agrupado por novela' })
  listHistory(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.readerService.listHistory(user.sub, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
