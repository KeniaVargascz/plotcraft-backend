import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTtl } from '../../common/decorators/cache-ttl.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LanguagesService } from './languages.service';

@ApiTags('catalogs')
@Controller('catalogs/languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Public()
  @CacheTtl(86400)
  @Get()
  @ApiOperation({ summary: 'Listado completo de idiomas disponibles' })
  listLanguages() {
    return this.languagesService.listLanguages();
  }
}
