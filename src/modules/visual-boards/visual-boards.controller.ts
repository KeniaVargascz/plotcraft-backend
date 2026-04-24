import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
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
import { AddItemDto } from './dto/add-item.dto';
import { CreateBoardDto } from './dto/create-board.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { VisualBoardQueryDto } from './dto/visual-board-query.dto';
import { VisualBoardsService } from './visual-boards.service';

@ApiTags('visual-boards')
@RequireFeature('author.visual_boards')
@Controller('visual-boards')
export class VisualBoardsController {
  constructor(
    private readonly visualBoardsService: VisualBoardsService,
    private readonly authService: AuthService,
  ) {}

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Lista tableros propios' })
  listMine(
    @CurrentUser() user: JwtPayload,
    @Query() query: VisualBoardQueryDto,
  ) {
    return this.visualBoardsService.listMine(user.sub, query);
  }

  @Public()
  @Get('public/:username')
  @ApiOperation({ summary: 'Lista tableros publicos de un autor' })
  listPublic(
    @Param('username') username: string,
    @Query() query: VisualBoardQueryDto,
  ) {
    return this.visualBoardsService.listPublicByUsername(username, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de tablero' })
  async getById(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.visualBoardsService.getById(id, viewer?.sub ?? null);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear tablero' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBoardDto) {
    return this.visualBoardsService.create(user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Editar tablero propio' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.visualBoardsService.update(id, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar tablero propio' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.visualBoardsService.remove(id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/sections')
  @ApiOperation({ summary: 'Crear seccion' })
  createSection(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSectionDto,
  ) {
    return this.visualBoardsService.createSection(id, user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':id/sections/:sectionId')
  @ApiOperation({ summary: 'Editar seccion' })
  updateSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.visualBoardsService.updateSection(id, sectionId, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':id/sections/:sectionId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar seccion' })
  async removeSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.visualBoardsService.removeSection(id, sectionId, user.sub);
  }

  @ApiBearerAuth()
  @Patch(':id/sections/reorder')
  @ApiOperation({ summary: 'Reordenar secciones' })
  reorderSections(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReorderSectionsDto,
  ) {
    return this.visualBoardsService.reorderSections(id, user.sub, dto);
  }

  @ApiBearerAuth()
  @Post(':id/sections/:sectionId/items')
  @ApiOperation({ summary: 'Agregar imagen a seccion' })
  addItem(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddItemDto,
  ) {
    return this.visualBoardsService.addItem(id, sectionId, user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':id/sections/:sectionId/items/:itemId')
  @ApiOperation({ summary: 'Editar imagen de seccion' })
  updateItem(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateItemDto,
  ) {
    return this.visualBoardsService.updateItem(
      id,
      sectionId,
      itemId,
      user.sub,
      dto,
    );
  }

  @ApiBearerAuth()
  @Delete(':id/sections/:sectionId/items/:itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar imagen de seccion' })
  async removeItem(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.visualBoardsService.removeItem(id, sectionId, itemId, user.sub);
  }

  @ApiBearerAuth()
  @Patch(':id/sections/:sectionId/items/reorder')
  @ApiOperation({ summary: 'Reordenar imagenes de una seccion' })
  reorderItems(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.visualBoardsService.reorderItems(id, sectionId, user.sub, dto);
  }
}
