import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ExportsService } from './exports.service';

@ApiTags('exports')
@ApiBearerAuth()
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('novels/:slug/txt')
  @ApiOperation({ summary: 'Exportar novela en texto plano' })
  async exportNovelTxt(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const content = await this.exportsService.exportNovelTxt(slug, user.sub);
    const filename = `novel-${slug}-${new Date().toISOString().split('T')[0]}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('novels/:slug/md')
  @ApiOperation({ summary: 'Exportar novela en Markdown' })
  async exportNovelMd(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const content = await this.exportsService.exportNovelMd(slug, user.sub);
    const filename = `novel-${slug}-${new Date().toISOString().split('T')[0]}.md`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('novels/:slug/json')
  @ApiOperation({ summary: 'Exportar novela en JSON' })
  async exportNovelJson(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const content = await this.exportsService.exportNovelJson(slug, user.sub);
    const filename = `novel-${slug}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('novels/:slug/chapter/:chSlug/md')
  @ApiOperation({ summary: 'Exportar capítulo en Markdown' })
  async exportChapterMd(
    @Param('slug') slug: string,
    @Param('chSlug') chSlug: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const content = await this.exportsService.exportChapterMd(
      slug,
      chSlug,
      user.sub,
    );
    const filename = `chapter-${chSlug}-${new Date().toISOString().split('T')[0]}.md`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('worlds/:slug/json')
  @ApiOperation({ summary: 'Exportar mundo en JSON' })
  async exportWorldJson(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const content = await this.exportsService.exportWorldJson(slug, user.sub);
    const filename = `world-${slug}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('characters/:username/:charSlug/json')
  @ApiOperation({ summary: 'Exportar personaje en JSON' })
  async exportCharacterJson(
    @Param('username') username: string,
    @Param('charSlug') charSlug: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const content = await this.exportsService.exportCharacterJson(
      username,
      charSlug,
      user.sub,
    );
    const filename = `character-${charSlug}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}
