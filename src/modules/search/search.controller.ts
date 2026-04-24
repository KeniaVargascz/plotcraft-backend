import {
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { AUTH_SERVICE, IAuthService } from '../auth/auth.interface';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import {
  SearchCharactersQueryDto,
  SearchNovelsQueryDto,
  SearchPostsQueryDto,
  SearchQueryDto,
  SearchSuggestionsQueryDto,
  SearchUnifiedQueryDto,
  SearchUsersQueryDto,
  SearchWorldsQueryDto,
} from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { SearchSuggestionsDto } from './dto/search-suggestions.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@RequireFeature('explore.search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Busqueda global agrupada por tipo' })
  @ApiOkResponse({ type: SearchResponseDto })
  async searchGlobal(
    @Query() query: SearchQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.searchService.searchGlobal(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('novels')
  @ApiOperation({ summary: 'Busqueda especifica de novelas' })
  async searchNovels(
    @Query() query: SearchNovelsQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.searchService.searchNovels(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('worlds')
  @ApiOperation({ summary: 'Busqueda especifica de mundos' })
  async searchWorlds(
    @Query() query: SearchWorldsQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.searchService.searchWorlds(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('characters')
  @ApiOperation({ summary: 'Busqueda especifica de personajes' })
  async searchCharacters(
    @Query() query: SearchCharactersQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.searchService.searchCharacters(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('users')
  @ApiOperation({ summary: 'Busqueda especifica de usuarios' })
  async searchUsers(
    @Query() query: SearchUsersQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.searchService.searchUsers(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('posts')
  @ApiOperation({ summary: 'Busqueda especifica de posts' })
  async searchPosts(
    @Query() query: SearchPostsQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.searchService.searchPosts(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('unified')
  @ApiOperation({
    summary: 'Busqueda unificada por tipos (foros, comunidades, posts, etc.)',
  })
  async searchUnified(
    @Query() query: SearchUnifiedQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.searchService.searchUnified(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({ summary: 'Sugerencias rapidas de autocompletado' })
  @ApiOkResponse({ type: SearchSuggestionsDto })
  getSuggestions(@Query() query: SearchSuggestionsQueryDto) {
    return this.searchService.getSuggestions(query);
  }

  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historial reciente de busquedas del usuario' })
  getHistory(@CurrentUser() user: JwtPayload) {
    return this.searchService.getHistory(user.sub);
  }

  @Delete('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Limpiar historial de busqueda' })
  clearHistory(@CurrentUser() user: JwtPayload) {
    return this.searchService.clearHistory(user.sub);
  }

  @Delete('history/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar una busqueda del historial' })
  deleteHistory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.searchService.deleteHistoryEntry(user.sub, id);
  }
}
