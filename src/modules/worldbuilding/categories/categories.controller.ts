import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { InstantiateTemplateDto } from './dto/instantiate-template.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('worldbuilding-categories')
@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get('worlds/wb/templates')
  @ApiOperation({ summary: 'Listar plantillas de categorias disponibles' })
  listTemplates() {
    return this.categoriesService.listTemplates();
  }

  @Public()
  @Get('worlds/:slug/wb/categories')
  @ApiOperation({ summary: 'Listar categorias de un mundo' })
  listCategories(@Param('slug') slug: string) {
    return this.categoriesService.listCategories(slug);
  }

  @ApiBearerAuth()
  @Post('worlds/:slug/wb/categories')
  @ApiOperation({ summary: 'Crear categoria en un mundo' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(user.sub, slug, dto);
  }

  @ApiBearerAuth()
  @Post('worlds/:slug/wb/categories/from-template')
  @ApiOperation({ summary: 'Crear categoria desde plantilla' })
  instantiateTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: InstantiateTemplateDto,
  ) {
    return this.categoriesService.instantiateTemplate(user.sub, slug, dto);
  }

  @ApiBearerAuth()
  @Patch('worlds/:slug/wb/categories/reorder')
  @ApiOperation({ summary: 'Reordenar categorias' })
  reorder(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: ReorderCategoriesDto,
  ) {
    return this.categoriesService.reorder(
      user.sub,
      slug,
      dto.categories.map((c) => ({ id: c.id, order: c.order })),
    );
  }

  @ApiBearerAuth()
  @Patch('worlds/:slug/wb/categories/:catSlug')
  @ApiOperation({ summary: 'Actualizar categoria' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('catSlug') catSlug: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user.sub, slug, catSlug, dto);
  }

  @ApiBearerAuth()
  @Delete('worlds/:slug/wb/categories/:catSlug')
  @ApiOperation({ summary: 'Eliminar categoria' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('catSlug') catSlug: string,
  ) {
    return this.categoriesService.remove(user.sub, slug, catSlug);
  }
}
