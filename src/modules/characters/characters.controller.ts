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
  @ApiOperation({ summary: 'Mis personajes' })
  listMine(@CurrentUser() user: JwtPayload, @Query() query: CharacterQueryDto) {
    return this.charactersService.listMine(user.sub, query);
  }

  @Public()
  @Get('user/:username')
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
  @ApiOperation({ summary: 'Crear personaje' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCharacterDto) {
    return this.charactersService.create(user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':authorUsername/:slug')
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
