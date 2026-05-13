import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { CacheTtl } from '../../../common/decorators/cache-ttl.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('features')
@Controller('features')
export class PublicFeaturesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('active')
  @Public()
  @CacheTtl(60)
  @ApiOperation({ summary: 'Feature flags activos (público, para frontend)' })
  async getActive() {
    const flags = await this.prisma.adminFeatureFlag.findMany({
      where: { enabled: true },
      select: { key: true },
    });
    return flags.map((f) => f.key);
  }

  @Get('banner')
  @Public()
  @CacheTtl(0)
  @ApiOperation({ summary: 'Banner informativo (público)' })
  async getBanner() {
    const settings = await this.prisma.appSetting.findMany({
      where: { key: { in: ['banner.enabled', 'banner.html'] } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const enabled = map['banner.enabled'] === 'true';
    const rawHtml = enabled ? (map['banner.html'] ?? '') : '';
    return { enabled, html: this.sanitizeHtml(rawHtml) };
  }

  /** Strip all tags except safe inline formatting. Removes scripts, events, iframes. */
  private sanitizeHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object\b[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed\b[^>]*\/?>/gi, '')
      .replace(/<link\b[^>]*\/?>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')
      .replace(/javascript\s*:/gi, 'blocked:');
  }

  @Get('maintenance')
  @Public()
  @CacheTtl(0)
  @ApiOperation({ summary: 'Maintenance mode status (público)' })
  async getMaintenance() {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: 'maintenanceMode' },
    });
    return { enabled: setting?.value === 'true' };
  }
}
