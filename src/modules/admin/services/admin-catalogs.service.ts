import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { CACHE_SERVICE, CacheService } from '../../../common/services/cache.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class AdminCatalogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  // === GENRES ===
  async getGenres() {
    return this.prisma.genre.findMany({ orderBy: { label: 'asc' } });
  }

  async createGenre(data: { slug: string; label: string }, admin: JwtPayload) {
    const exists = await this.prisma.genre.findUnique({ where: { slug: data.slug } });
    if (exists) throw new ConflictException('El slug ya existe');
    const genre = await this.prisma.genre.create({ data });
    await this.auditService.log({ adminId: admin.sub, adminEmail: admin.email, action: 'GENRE_CREATED', resourceType: 'genre', resourceId: genre.id, details: data });
    return genre;
  }

  async updateGenre(id: string, data: { slug?: string; label?: string; isActive?: boolean }, admin: JwtPayload) {
    const genre = await this.prisma.genre.findUnique({ where: { id } });
    if (!genre) throw new NotFoundException('Género no encontrado');
    const updated = await this.prisma.genre.update({ where: { id }, data });
    await this.cache.del('catalog:genres');
    await this.auditService.log({ adminId: admin.sub, adminEmail: admin.email, action: 'GENRE_UPDATED', resourceType: 'genre', resourceId: id, details: data });
    return updated;
  }

  async deleteGenre(id: string, admin: JwtPayload) {
    const genre = await this.prisma.genre.findUnique({ where: { id } });
    if (!genre) throw new NotFoundException('Género no encontrado');
    await this.prisma.genre.delete({ where: { id } });
    await this.auditService.log({ adminId: admin.sub, adminEmail: admin.email, action: 'GENRE_DELETED', resourceType: 'genre', resourceId: id, details: { label: genre.label } });
    return { deleted: true };
  }

  // === LANGUAGES ===
  async getLanguages() {
    return this.prisma.catalogLanguage.findMany({ orderBy: { name: 'asc' } });
  }

  async createLanguage(data: { name: string; code: string; description?: string }, admin: JwtPayload) {
    const lang = await this.prisma.catalogLanguage.create({ data: { ...data, isActive: true } });
    await this.auditService.log({ adminId: admin.sub, adminEmail: admin.email, action: 'LANGUAGE_CREATED', resourceType: 'language', resourceId: lang.id, details: data });
    return lang;
  }

  async updateLanguage(id: string, data: { name?: string; code?: string; isActive?: boolean }, admin: JwtPayload) {
    const lang = await this.prisma.catalogLanguage.findUnique({ where: { id } });
    if (!lang) throw new NotFoundException('Idioma no encontrado');
    const updated = await this.prisma.catalogLanguage.update({ where: { id }, data });
    await this.auditService.log({ adminId: admin.sub, adminEmail: admin.email, action: 'LANGUAGE_UPDATED', resourceType: 'language', resourceId: id, details: data });
    return updated;
  }

  // === WARNINGS ===
  async getWarnings() {
    return this.prisma.catalogWarning.findMany({ orderBy: { label: 'asc' } });
  }

  async createWarning(data: { slug: string; label: string }, admin: JwtPayload) {
    const warning = await this.prisma.catalogWarning.create({ data: { ...data, isActive: true } });
    await this.auditService.log({ adminId: admin.sub, adminEmail: admin.email, action: 'WARNING_CREATED', resourceType: 'warning', resourceId: warning.id, details: data });
    return warning;
  }

  async updateWarning(id: string, data: { slug?: string; label?: string; isActive?: boolean }, admin: JwtPayload) {
    const warning = await this.prisma.catalogWarning.findUnique({ where: { id } });
    if (!warning) throw new NotFoundException('Warning no encontrado');
    const updated = await this.prisma.catalogWarning.update({ where: { id }, data });
    await this.auditService.log({ adminId: admin.sub, adminEmail: admin.email, action: 'WARNING_UPDATED', resourceType: 'warning', resourceId: id, details: data });
    return updated;
  }

  // === ROMANCE GENRES ===
  async getRomanceGenres() {
    return this.prisma.catalogRomanceGenre.findMany({ orderBy: { label: 'asc' } });
  }

  async createRomanceGenre(data: { slug: string; label: string }, admin: JwtPayload) {
    const rg = await this.prisma.catalogRomanceGenre.create({ data: { ...data, isActive: true } });
    await this.auditService.log({ adminId: admin.sub, adminEmail: admin.email, action: 'ROMANCE_GENRE_CREATED', resourceType: 'romance_genre', resourceId: rg.id, details: data });
    return rg;
  }

  async updateRomanceGenre(id: string, data: { slug?: string; label?: string; isActive?: boolean }, admin: JwtPayload) {
    const rg = await this.prisma.catalogRomanceGenre.findUnique({ where: { id } });
    if (!rg) throw new NotFoundException('Romance genre no encontrado');
    const updated = await this.prisma.catalogRomanceGenre.update({ where: { id }, data });
    await this.auditService.log({ adminId: admin.sub, adminEmail: admin.email, action: 'ROMANCE_GENRE_UPDATED', resourceType: 'romance_genre', resourceId: id, details: data });
    return updated;
  }
}
