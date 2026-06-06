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
import { FeatureFlag } from '../../config/feature-flags.constants';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CharacterQueryDto } from './dto/character-query.dto';
import { CreateCharacterDto } from './dto/create-character.dto';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { CharactersService } from './characters.service';
import { CharacterRelationshipService } from './services/character-relationship.service';
import { CharacterNovelLinkService } from './services/character-novel-link.service';

@ApiTags('characters')
@Controller('characters')
export class CharactersController {
  constructor(
    private readonly charactersService: CharactersService,
    private readonly characterRelationshipService: CharacterRelationshipService,
    private readonly characterNovelLinkService: CharacterNovelLinkService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get()
  @RequireFeature(FeatureFlag.EXPLORE_CHARACTERS_CATALOG)
  @ApiOperation({ summary: 'Catalogo publico de personajes' })
  async listPublic(
    @Query() query: CharacterQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.charactersService.listPublic(query, viewer?.sub ?? null);
  }

  @ApiBearerAuth()
  @Get('me')
  @RequireFeature(FeatureFlag.AUTHOR_CHARACTERS)
  @ApiOperation({ summary: 'Mis personajes' })
  listMine(@CurrentUser() user: JwtPayload, @Query() query: CharacterQueryDto) {
    return this.charactersService.listMine(user.sub, query);
  }

  @Public()
  @Get('user/:username')
  @RequireFeature(FeatureFlag.EXPLORE_CHARACTERS_CATALOG)
  @ApiOperation({ summary: 'Personajes publicos de un autor' })
  async listByUser(
    @Param('username') username: string,
    @Query() query: CharacterQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.charactersService.listByUser(
      username,
      query,
      viewer?.sub ?? null,
    );
  }

  @Public()
  @Get('world/:worldSlug')
  @RequireFeature(FeatureFlag.EXPLORE_CHARACTERS_CATALOG)
  @ApiOperation({ summary: 'Personajes publicos por mundo' })
  async listByWorld(
    @Param('worldSlug') worldSlug: string,
    @Query() query: CharacterQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.charactersService.listByWorld(
      worldSlug,
      query,
      viewer?.sub ?? null,
    );
  }

  @Public()
  @Get(':authorUsername/:slug')
  @ApiOperation({ summary: 'Detalle de personaje' })
  async getDetail(
    @Param('authorUsername') authorUsername: string,
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.charactersService.getDetail(
      authorUsername,
      slug,
      viewer?.sub ?? null,
    );
  }

  @Public()
  @Get(':authorUsername/:slug/relationships')
  @RequireFeature(FeatureFlag.AUTHOR_CHARACTERS_RELATIONSHIPS)
  @ApiOperation({ summary: 'Relaciones de un personaje' })
  async listRelationships(
    @Param('authorUsername') authorUsername: string,
    @Param('slug') slug: string,
    @Query() query: CharacterQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.characterRelationshipService.listRelationships(
      authorUsername,
      slug,
      viewer?.sub ?? null,
      query,
    );
  }

  @Public()
  @Get(':authorUsername/:slug/novels')
  @RequireFeature(FeatureFlag.EXPLORE_CHARACTERS_CATALOG)
  @ApiOperation({ summary: 'Novelas vinculadas a un personaje' })
  async listNovels(
    @Param('authorUsername') authorUsername: string,
    @Param('slug') slug: string,
    @Query() query: CharacterQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.characterNovelLinkService.listNovels(
      authorUsername,
      slug,
      viewer?.sub ?? null,
      query,
    );
  }

  @ApiBearerAuth()
  @Post()
  @RequireFeature(FeatureFlag.AUTHOR_CHARACTERS)
  @ApiOperation({ summary: 'Crear personaje' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCharacterDto) {
    return this.charactersService.create(user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':authorUsername/:slug')
  @RequireFeature(FeatureFlag.AUTHOR_CHARACTERS)
  @ApiOperation({ summary: 'Editar personaje propio' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('authorUsername') authorUsername: string,
    @Param('slug') slug: string,
    @Body() dto: UpdateCharacterDto,
  ) {
    return this.charactersService.update(user.sub, authorUsername, slug, dto);
  }

  @ApiBearerAuth()
  @Delete(':authorUsername/:slug')
  @RequireFeature(FeatureFlag.AUTHOR_CHARACTERS)
  @ApiOperation({ summary: 'Eliminar personaje propio' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('authorUsername') authorUsername: string,
    @Param('slug') slug: string,
  ) {
    return this.charactersService.remove(user.sub, authorUsername, slug);
  }

  @ApiBearerAuth()
  @Post(':authorUsername/:slug/relationships')
  @RequireFeature(FeatureFlag.AUTHOR_CHARACTERS_RELATIONSHIPS)
  @ApiOperation({ summary: 'Crear relacion entre personajes propios' })
  createRelationship(
    @CurrentUser() user: JwtPayload,
    @Param('authorUsername') authorUsername: string,
    @Param('slug') slug: string,
    @Body() dto: CreateRelationshipDto,
  ) {
    return this.characterRelationshipService.createRelationship(
      user.sub,
      authorUsername,
      slug,
      dto,
    );
  }

  @ApiBearerAuth()
  @Delete(':authorUsername/:slug/relationships/:relationshipId')
  @RequireFeature(FeatureFlag.AUTHOR_CHARACTERS_RELATIONSHIPS)
  @ApiOperation({ summary: 'Eliminar relacion de personaje propio' })
  removeRelationship(
    @CurrentUser() user: JwtPayload,
    @Param('authorUsername') authorUsername: string,
    @Param('slug') slug: string,
    @Param('relationshipId') relationshipId: string,
  ) {
    return this.characterRelationshipService.removeRelationship(
      user.sub,
      authorUsername,
      slug,
      relationshipId,
    );
  }

  @ApiBearerAuth()
  @Post(':authorUsername/:slug/novels/:novelSlug')
  @RequireFeature(FeatureFlag.AUTHOR_CHARACTERS)
  @ApiOperation({ summary: 'Vincular personaje a novela propia' })
  linkNovel(
    @CurrentUser() user: JwtPayload,
    @Param('authorUsername') authorUsername: string,
    @Param('slug') slug: string,
    @Param('novelSlug') novelSlug: string,
  ) {
    return this.characterNovelLinkService.linkNovel(
      user.sub,
      authorUsername,
      slug,
      novelSlug,
    );
  }

  @ApiBearerAuth()
  @Delete(':authorUsername/:slug/novels/:novelSlug')
  @RequireFeature(FeatureFlag.AUTHOR_CHARACTERS)
  @ApiOperation({ summary: 'Desvincular personaje de novela propia' })
  unlinkNovel(
    @CurrentUser() user: JwtPayload,
    @Param('authorUsername') authorUsername: string,
    @Param('slug') slug: string,
    @Param('novelSlug') novelSlug: string,
  ) {
    return this.characterNovelLinkService.unlinkNovel(
      user.sub,
      authorUsername,
      slug,
      novelSlug,
    );
  }
}
