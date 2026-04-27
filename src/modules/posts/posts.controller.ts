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
import { CreatePostDto } from './dto/create-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@RequireFeature(FeatureFlag.SOCIAL_FEED)
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly authService: AuthService,
  ) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear post' })
  createPost(@CurrentUser() user: JwtPayload, @Body() dto: CreatePostDto) {
    return this.postsService.createPost(user.sub, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listado publico global de posts' })
  async listPosts(
    @Query() query: PostQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.postsService.listPosts({
      query,
      viewerId: viewer?.sub ?? null,
    });
  }

  @Get('saved')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Posts guardados del usuario autenticado' })
  getSavedPosts(@CurrentUser() user: JwtPayload, @Query() query: PostQueryDto) {
    return this.postsService.listPosts({
      query,
      viewerId: user.sub,
      onlySavedByUserId: user.sub,
    });
  }

  @Public()
  @Get('user/:username')
  @ApiOperation({ summary: 'Posts de un usuario especifico' })
  async getUserPosts(
    @Param('username') username: string,
    @Query() query: PostQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.postsService.listPosts({
      query: {
        ...query,
        author: username,
      },
      viewerId: viewer?.sub ?? null,
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un post' })
  async getPostById(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);
    return this.postsService.getPostById(id, viewer?.sub ?? null);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Editar post propio' })
  updatePost(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(id, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete de post propio' })
  deletePost(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.postsService.deletePost(id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/save')
  @ApiOperation({ summary: 'Guardar post' })
  savePost(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.postsService.savePost(id, user.sub);
  }

  @ApiBearerAuth()
  @Delete(':id/save')
  @ApiOperation({ summary: 'Quitar post guardado' })
  unsavePost(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.postsService.unsavePost(id, user.sub);
  }
}
