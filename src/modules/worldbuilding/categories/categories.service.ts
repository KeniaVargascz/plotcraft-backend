import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorldsService } from '../../worlds/worlds.service';
import { createSlug } from '../../novels/utils/slugify.util';
import {
  CATEGORY_TEMPLATES,
  type FieldDefinition,
} from '../constants/category-templates.const';
import { CreateCategoryDto } from './dto/create-category.dto';
import { InstantiateTemplateDto } from './dto/instantiate-template.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worldsService: WorldsService,
  ) {}

  async listCategories(worldSlug: string) {
    const world = await this.prisma.world.findUnique({
      where: { slug: worldSlug },
    });

    if (!world) {
      throw new NotFoundException('Mundo no encontrado');
    }

    const categories = await this.prisma.wbCategory.findMany({
      where: { worldId: world.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { entries: true },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      worldId: cat.worldId,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      description: cat.description,
      color: cat.color,
      fieldSchema: cat.fieldSchema,
      sortOrder: cat.sortOrder,
      isSystem: cat.isSystem,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      entriesCount: cat._count.entries,
    }));
  }

  async getCategory(worldSlug: string, catSlug: string) {
    const world = await this.prisma.world.findUnique({
      where: { slug: worldSlug },
    });

    if (!world) {
      throw new NotFoundException('Mundo no encontrado');
    }

    const category = await this.prisma.wbCategory.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: catSlug } },
      include: { _count: { select: { entries: true } } },
    });

    if (!category) {
      throw new NotFoundException('Categoria no encontrada');
    }

    return this.toCategoryResponse(category);
  }

  async create(userId: string, worldSlug: string, dto: CreateCategoryDto) {
    dto.validateNoDuplicateKeys();

    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);
    const slug = await this.generateUniqueCategorySlug(world.id, dto.name);

    const maxOrder = await this.prisma.wbCategory.aggregate({
      where: { worldId: world.id },
      _max: { sortOrder: true },
    });

    const category = await this.prisma.wbCategory.create({
      data: {
        worldId: world.id,
        name: dto.name.trim(),
        slug,
        icon: dto.icon ?? null,
        description: dto.description?.trim() ?? null,
        color: dto.color ?? null,
        fieldSchema: dto.fieldSchema as unknown as Prisma.InputJsonValue,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        isSystem: false,
      },
      include: {
        _count: { select: { entries: true } },
      },
    });

    return this.toCategoryResponse(category);
  }

  async update(
    userId: string,
    worldSlug: string,
    catSlug: string,
    dto: UpdateCategoryDto,
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const category = await this.prisma.wbCategory.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: catSlug } },
      include: { _count: { select: { entries: true } } },
    });

    if (!category) {
      throw new NotFoundException('Categoria no encontrada');
    }

    const existingSchema = (category.fieldSchema as unknown as FieldDefinition[]) || [];

    let mergedSchema = existingSchema;
    if (dto.newFields && dto.newFields.length > 0) {
      const existingKeys = new Set(existingSchema.map((f) => f.key));
      for (const newField of dto.newFields) {
        if (existingKeys.has(newField.key)) {
          throw new BadRequestException(
            `El campo "${newField.key}" ya existe en el esquema`,
          );
        }
      }

      if (existingSchema.length + dto.newFields.length > 20) {
        throw new BadRequestException(
          'El esquema no puede tener mas de 20 campos',
        );
      }

      mergedSchema = [...existingSchema, ...dto.newFields] as FieldDefinition[];
    }

    const updated = await this.prisma.wbCategory.update({
      where: { id: category.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.newFields && dto.newFields.length > 0
          ? { fieldSchema: mergedSchema as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: {
        _count: { select: { entries: true } },
      },
    });

    return this.toCategoryResponse(updated);
  }

  async remove(userId: string, worldSlug: string, catSlug: string) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const category = await this.prisma.wbCategory.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: catSlug } },
    });

    if (!category) {
      throw new NotFoundException('Categoria no encontrada');
    }

    await this.prisma.wbCategory.delete({ where: { id: category.id } });

    return { message: 'Categoria eliminada correctamente' };
  }

  async reorder(
    userId: string,
    worldSlug: string,
    items: Array<{ id: string; order: number }>,
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.wbCategory.updateMany({
          where: { id: item.id, worldId: world.id },
          data: { sortOrder: item.order },
        }),
      ),
    );

    return this.listCategories(worldSlug);
  }

  async listTemplates() {
    return Object.entries(CATEGORY_TEMPLATES).map(([key, template]) => ({
      key,
      name: template.name,
      icon: template.icon,
      color: template.color,
      description: template.description,
      fieldsCount: template.fieldSchema.length,
    }));
  }

  async instantiateTemplate(
    userId: string,
    worldSlug: string,
    dto: InstantiateTemplateDto,
  ) {
    const template = CATEGORY_TEMPLATES[dto.templateKey];
    if (!template) {
      throw new BadRequestException('Plantilla no encontrada');
    }

    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const name = dto.name?.trim() || template.name;
    const slug = await this.generateUniqueCategorySlug(world.id, name);

    const maxOrder = await this.prisma.wbCategory.aggregate({
      where: { worldId: world.id },
      _max: { sortOrder: true },
    });

    const category = await this.prisma.wbCategory.create({
      data: {
        worldId: world.id,
        name,
        slug,
        icon: dto.icon ?? template.icon,
        description: template.description,
        color: dto.color ?? template.color,
        fieldSchema: template.fieldSchema as unknown as Prisma.InputJsonValue,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        isSystem: false,
      },
      include: {
        _count: { select: { entries: true } },
      },
    });

    return this.toCategoryResponse(category);
  }

  private toCategoryResponse(
    category: Prisma.WbCategoryGetPayload<{
      include: { _count: { select: { entries: true } } };
    }>,
  ) {
    return {
      id: category.id,
      worldId: category.worldId,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      description: category.description,
      color: category.color,
      fieldSchema: category.fieldSchema,
      sortOrder: category.sortOrder,
      isSystem: category.isSystem,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      entriesCount: category._count.entries,
    };
  }

  private async generateUniqueCategorySlug(
    worldId: string,
    name: string,
  ): Promise<string> {
    const baseSlug = createSlug(name);

    if (!baseSlug) {
      throw new BadRequestException(
        'No se pudo generar un slug valido para la categoria',
      );
    }

    let candidate = baseSlug;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.wbCategory.findUnique({
        where: { worldId_slug: { worldId, slug: candidate } },
      });

      if (!existing) {
        return candidate;
      }

      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }
}
