import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CharacterKinshipType,
  CharacterRelationshipCategory,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRelationshipDto } from '../dto/create-relationship.dto';

type KinshipDefinition = {
  label: string;
  inverseType: CharacterKinshipType;
  inverseLabel: string;
  isMutual: boolean;
};

@Injectable()
export class CharacterRelationshipService {
  constructor(private readonly prisma: PrismaService) {}

  async createRelationship(
    userId: string,
    authorUsername: string,
    slug: string,
    dto: CreateRelationshipDto,
  ) {
    const source = await this.findOwnedCharacter(userId, authorUsername, slug);
    const target = await this.prisma.character.findFirst({
      where: {
        id: dto.targetId,
        authorId: userId,
      },
    });

    if (!target) {
      throw new NotFoundException({ statusCode: 404, message: 'Target character not found', code: 'TARGET_CHARACTER_NOT_FOUND' });
    }

    if (source.id === target.id) {
      throw new BadRequestException({ statusCode: 400, message: 'A character cannot have a relationship with itself', code: 'SELF_RELATIONSHIP_FORBIDDEN' });
    }

    const description = dto.description?.trim() || null;

    if (dto.kinshipType) {
      const definition = this.resolveKinshipDefinition(dto.kinshipType);
      const existing = await this.prisma.characterRelationship.findFirst({
        where: {
          OR: [
            {
              sourceId: source.id,
              targetId: target.id,
              category: CharacterRelationshipCategory.KINSHIP,
              kinshipType: dto.kinshipType,
            },
            {
              sourceId: target.id,
              targetId: source.id,
              category: CharacterRelationshipCategory.KINSHIP,
              kinshipType: definition.inverseType,
            },
          ],
        },
      });

      if (existing) {
        throw new BadRequestException({ statusCode: 400, message: 'Kinship relationship already exists between these characters', code: 'KINSHIP_ALREADY_EXISTS' });
      }

      const relationshipGroupId = randomUUID();
      const relationship = await this.prisma.characterRelationship.create({
        data: {
          sourceId: source.id,
          targetId: target.id,
          type: definition.label,
          category: CharacterRelationshipCategory.KINSHIP,
          kinshipType: dto.kinshipType,
          relationshipGroupId,
          description,
          isMutual: definition.isMutual,
        },
        include: this.relationshipInclude(),
      });

      await this.prisma.characterRelationship.create({
        data: {
          sourceId: target.id,
          targetId: source.id,
          type: definition.inverseLabel,
          category: CharacterRelationshipCategory.KINSHIP,
          kinshipType: definition.inverseType,
          relationshipGroupId,
          description,
          isMutual: definition.isMutual,
        },
      });

      return this.toRelationshipResponse(relationship);
    }

    const type = dto.type?.trim();
    if (!type) {
      throw new BadRequestException({ statusCode: 400, message: 'You must specify a relationship type or a valid kinship', code: 'RELATIONSHIP_TYPE_REQUIRED' });
    }

    const relationshipGroupId = dto.isMutual ? randomUUID() : null;
    const relationship = await this.prisma.characterRelationship.create({
      data: {
        sourceId: source.id,
        targetId: target.id,
        type,
        category: dto.category ?? CharacterRelationshipCategory.OTHER,
        relationshipGroupId,
        description,
        isMutual: dto.isMutual ?? false,
      },
      include: this.relationshipInclude(),
    });

    if (dto.isMutual) {
      await this.prisma.characterRelationship.upsert({
        where: {
          sourceId_targetId_type: {
            sourceId: target.id,
            targetId: source.id,
            type,
          },
        },
        update: {
          category: dto.category ?? CharacterRelationshipCategory.OTHER,
          relationshipGroupId,
          description,
          isMutual: true,
        },
        create: {
          sourceId: target.id,
          targetId: source.id,
          type,
          category: dto.category ?? CharacterRelationshipCategory.OTHER,
          relationshipGroupId,
          description,
          isMutual: true,
        },
      });
    }

    return this.toRelationshipResponse(relationship);
  }

  async removeRelationship(
    userId: string,
    authorUsername: string,
    slug: string,
    relationshipId: string,
  ) {
    const character = await this.findOwnedCharacter(
      userId,
      authorUsername,
      slug,
    );
    const relationship = await this.prisma.characterRelationship.findFirst({
      where: {
        id: relationshipId,
        sourceId: character.id,
      },
    });

    if (!relationship) {
      throw new NotFoundException({ statusCode: 404, message: 'Relationship not found', code: 'RELATIONSHIP_NOT_FOUND' });
    }

    if (relationship.relationshipGroupId) {
      await this.prisma.characterRelationship.deleteMany({
        where: { relationshipGroupId: relationship.relationshipGroupId },
      });
    } else {
      await this.prisma.characterRelationship.delete({
        where: { id: relationship.id },
      });

      if (relationship.isMutual) {
        await this.prisma.characterRelationship.deleteMany({
          where: {
            sourceId: relationship.targetId,
            targetId: relationship.sourceId,
            type: relationship.type,
          },
        });
      }
    }

    return { message: 'Relacion eliminada correctamente' };
  }

  async listRelationships(
    authorUsername: string,
    slug: string,
    viewerId?: string | null,
    query: { cursor?: string; limit?: number } = {},
  ) {
    const character = await this.findCharacter(authorUsername, slug, viewerId);
    const limit = query.limit ?? 20;

    const relationships = await this.prisma.characterRelationship.findMany({
      where: {
        sourceId: character.id,
        target: {
          OR: [
            { isPublic: true },
            ...(viewerId ? [{ authorId: viewerId }] : []),
          ],
        },
      },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [
        { category: 'asc' },
        { isMutual: 'desc' },
        { createdAt: 'desc' },
      ],
      include: this.relationshipInclude(),
    });

    const hasMore = relationships.length > limit;
    const items = relationships.slice(0, limit);

    return {
      data: items.map((relationship) =>
        this.toRelationshipResponse(relationship),
      ),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  private async findOwnedCharacter(
    userId: string,
    authorUsername: string,
    slug: string,
  ) {
    const character = await this.prisma.character.findFirst({
      where: {
        slug,
        authorId: userId,
        author: { username: authorUsername },
      },
    });

    if (!character) {
      throw new NotFoundException({ statusCode: 404, message: 'Character not found', code: 'CHARACTER_NOT_FOUND' });
    }

    return character;
  }

  private async findCharacter(
    authorUsername: string,
    slug: string,
    viewerId?: string | null,
  ) {
    const character = await this.prisma.character.findFirst({
      where: {
        slug,
        author: { username: authorUsername },
      },
    });

    if (!character) {
      throw new NotFoundException({ statusCode: 404, message: 'Character not found', code: 'CHARACTER_NOT_FOUND' });
    }

    if (!character.isPublic && character.authorId !== viewerId) {
      throw new NotFoundException({ statusCode: 404, message: 'Character not found', code: 'CHARACTER_NOT_FOUND' });
    }

    return character;
  }

  private relationshipInclude() {
    return {
      source: {
        include: {
          author: { include: { profile: true } },
        },
      },
      target: {
        include: {
          author: { include: { profile: true } },
          world: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    } satisfies Prisma.CharacterRelationshipInclude;
  }

  private toRelationshipResponse(
    relationship: Prisma.CharacterRelationshipGetPayload<{
      include: ReturnType<CharacterRelationshipService['relationshipInclude']>;
    }>,
  ) {
    return {
      id: relationship.id,
      type: relationship.type,
      label: relationship.type,
      category: relationship.category,
      kinshipType: relationship.kinshipType,
      relationshipGroupId: relationship.relationshipGroupId,
      description: relationship.description,
      isMutual: relationship.isMutual,
      createdAt: relationship.createdAt,
      source: {
        id: relationship.source.id,
        name: relationship.source.name,
        slug: relationship.source.slug,
        username: relationship.source.author.username,
      },
      target: {
        id: relationship.target.id,
        name: relationship.target.name,
        slug: relationship.target.slug,
        username: relationship.target.author.username,
        avatarUrl: relationship.target.avatarUrl,
        world: relationship.target.world,
      },
    };
  }

  private resolveKinshipDefinition(
    kinshipType: CharacterKinshipType,
  ): KinshipDefinition {
    switch (kinshipType) {
      case CharacterKinshipType.PARENT:
        return {
          label: 'Padre/Madre',
          inverseType: CharacterKinshipType.CHILD,
          inverseLabel: 'Hijo/Hija',
          isMutual: false,
        };
      case CharacterKinshipType.CHILD:
        return {
          label: 'Hijo/Hija',
          inverseType: CharacterKinshipType.PARENT,
          inverseLabel: 'Padre/Madre',
          isMutual: false,
        };
      case CharacterKinshipType.SIBLING:
        return {
          label: 'Hermano/a',
          inverseType: CharacterKinshipType.SIBLING,
          inverseLabel: 'Hermano/a',
          isMutual: true,
        };
      case CharacterKinshipType.GRANDPARENT:
        return {
          label: 'Abuelo/a',
          inverseType: CharacterKinshipType.GRANDCHILD,
          inverseLabel: 'Nieto/a',
          isMutual: false,
        };
      case CharacterKinshipType.GRANDCHILD:
        return {
          label: 'Nieto/a',
          inverseType: CharacterKinshipType.GRANDPARENT,
          inverseLabel: 'Abuelo/a',
          isMutual: false,
        };
      case CharacterKinshipType.UNCLE_AUNT:
        return {
          label: 'Tio/Tia',
          inverseType: CharacterKinshipType.NIECE_NEPHEW,
          inverseLabel: 'Sobrino/a',
          isMutual: false,
        };
      case CharacterKinshipType.NIECE_NEPHEW:
        return {
          label: 'Sobrino/a',
          inverseType: CharacterKinshipType.UNCLE_AUNT,
          inverseLabel: 'Tio/Tia',
          isMutual: false,
        };
      case CharacterKinshipType.COUSIN:
        return {
          label: 'Primo/a',
          inverseType: CharacterKinshipType.COUSIN,
          inverseLabel: 'Primo/a',
          isMutual: true,
        };
      case CharacterKinshipType.SPOUSE:
        return {
          label: 'Conyuge',
          inverseType: CharacterKinshipType.SPOUSE,
          inverseLabel: 'Conyuge',
          isMutual: true,
        };
      case CharacterKinshipType.STEP_PARENT:
        return {
          label: 'Padre/Madre adoptivo',
          inverseType: CharacterKinshipType.STEP_CHILD,
          inverseLabel: 'Hijo/Hija adoptivo',
          isMutual: false,
        };
      case CharacterKinshipType.STEP_CHILD:
        return {
          label: 'Hijo/Hija adoptivo',
          inverseType: CharacterKinshipType.STEP_PARENT,
          inverseLabel: 'Padre/Madre adoptivo',
          isMutual: false,
        };
      case CharacterKinshipType.GUARDIAN:
        return {
          label: 'Tutor/a',
          inverseType: CharacterKinshipType.WARD,
          inverseLabel: 'Tutelado/a',
          isMutual: false,
        };
      case CharacterKinshipType.WARD:
        return {
          label: 'Tutelado/a',
          inverseType: CharacterKinshipType.GUARDIAN,
          inverseLabel: 'Tutor/a',
          isMutual: false,
        };
      default:
        throw new BadRequestException({ statusCode: 400, message: 'Unsupported kinship type', code: 'KINSHIP_TYPE_UNSUPPORTED' });
    }
  }
}
