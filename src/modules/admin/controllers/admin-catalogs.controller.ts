import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminCatalogsService } from '../services/admin-catalogs.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@ApiTags('admin/catalogs')
@Controller('admin/catalogs')
@UseGuards(AdminGuard)
export class AdminCatalogsController {
  constructor(private readonly catalogsService: AdminCatalogsService) {}

  // === GENRES ===
  @Get('genres')
  @ApiOperation({ summary: 'Listar géneros' })
  getGenres() { return this.catalogsService.getGenres(); }

  @Post('genres')
  @ApiOperation({ summary: 'Crear género' })
  createGenre(@Body() body: { slug: string; label: string }, @CurrentUser() admin: JwtPayload) {
    return this.catalogsService.createGenre(body, admin);
  }

  @Patch('genres/:id')
  @ApiOperation({ summary: 'Editar género' })
  updateGenre(@Param('id') id: string, @Body() body: { slug?: string; label?: string; isActive?: boolean }, @CurrentUser() admin: JwtPayload) {
    return this.catalogsService.updateGenre(id, body, admin);
  }

  @Delete('genres/:id')
  @ApiOperation({ summary: 'Eliminar género' })
  deleteGenre(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.catalogsService.deleteGenre(id, admin);
  }

  // === LANGUAGES ===
  @Get('languages')
  @ApiOperation({ summary: 'Listar idiomas' })
  getLanguages() { return this.catalogsService.getLanguages(); }

  @Post('languages')
  @ApiOperation({ summary: 'Crear idioma' })
  createLanguage(@Body() body: { name: string; code: string; description?: string }, @CurrentUser() admin: JwtPayload) {
    return this.catalogsService.createLanguage(body, admin);
  }

  @Patch('languages/:id')
  @ApiOperation({ summary: 'Editar idioma' })
  updateLanguage(@Param('id') id: string, @Body() body: { name?: string; code?: string; isActive?: boolean }, @CurrentUser() admin: JwtPayload) {
    return this.catalogsService.updateLanguage(id, body, admin);
  }

  // === WARNINGS ===
  @Get('warnings')
  @ApiOperation({ summary: 'Listar warnings' })
  getWarnings() { return this.catalogsService.getWarnings(); }

  @Post('warnings')
  @ApiOperation({ summary: 'Crear warning' })
  createWarning(@Body() body: { slug: string; label: string }, @CurrentUser() admin: JwtPayload) {
    return this.catalogsService.createWarning(body, admin);
  }

  @Patch('warnings/:id')
  @ApiOperation({ summary: 'Editar warning' })
  updateWarning(@Param('id') id: string, @Body() body: { slug?: string; label?: string; isActive?: boolean }, @CurrentUser() admin: JwtPayload) {
    return this.catalogsService.updateWarning(id, body, admin);
  }

  // === ROMANCE GENRES ===
  @Get('romance-genres')
  @ApiOperation({ summary: 'Listar romance genres' })
  getRomanceGenres() { return this.catalogsService.getRomanceGenres(); }

  @Post('romance-genres')
  @ApiOperation({ summary: 'Crear romance genre' })
  createRomanceGenre(@Body() body: { slug: string; label: string }, @CurrentUser() admin: JwtPayload) {
    return this.catalogsService.createRomanceGenre(body, admin);
  }

  @Patch('romance-genres/:id')
  @ApiOperation({ summary: 'Editar romance genre' })
  updateRomanceGenre(@Param('id') id: string, @Body() body: { slug?: string; label?: string; isActive?: boolean }, @CurrentUser() admin: JwtPayload) {
    return this.catalogsService.updateRomanceGenre(id, body, admin);
  }
}
