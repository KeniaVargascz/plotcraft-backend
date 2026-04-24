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
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AddToListDto } from './dto/add-to-list.dto';
import { CreateReadingListDto } from './dto/create-reading-list.dto';
import { UpdateReadingListDto } from './dto/update-reading-list.dto';
import { ReadingListsService } from './reading-lists.service';

@ApiTags('reading-lists')
@RequireFeature('reader.library.lists')
@Controller('reading-lists')
export class ReadingListsController {
  constructor(
    private readonly readingListsService: ReadingListsService,
    private readonly authService: AuthService,
  ) {}

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Mis listas de lectura' })
  listMine(
    @CurrentUser() user: JwtPayload,
    @Query('novel_id') novelId?: string,
  ) {
    return this.readingListsService.listMine(user.sub, novelId);
  }

  @Public()
  @Get('user/:username')
  @ApiOperation({ summary: 'Listas publicas de un usuario' })
  listPublicByUser(@Param('username') username: string) {
    return this.readingListsService.listPublicByUser(username);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una lista de lectura' })
  async getDetail(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.readingListsService.getDetail(id, viewer?.sub ?? null);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear lista de lectura' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReadingListDto) {
    return this.readingListsService.create(user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Editar lista propia' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReadingListDto,
  ) {
    return this.readingListsService.update(user.sub, id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar lista propia' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.readingListsService.remove(user.sub, id);
  }

  @ApiBearerAuth()
  @Post(':id/items')
  @ApiOperation({ summary: 'Agregar novela a una lista propia' })
  addItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddToListDto,
  ) {
    return this.readingListsService.addItem(user.sub, id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id/items/:novelId')
  @ApiOperation({ summary: 'Quitar novela de una lista propia' })
  removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('novelId') novelId: string,
  ) {
    return this.readingListsService.removeItem(user.sub, id, novelId);
  }

  @ApiBearerAuth()
  @Patch(':id/items/:novelId')
  @ApiOperation({ summary: 'Actualizar nota personal de un item de lista' })
  updateItemNote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('novelId') novelId: string,
    @Body('personal_note') personalNote?: string,
  ) {
    return this.readingListsService.updateItemNote(
      user.sub,
      id,
      novelId,
      personalNote,
    );
  }
}
