import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTtl } from '../../common/decorators/cache-ttl.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { WarningsService } from './warnings.service';

@ApiTags('warnings')
@Controller('warnings')
export class WarningsController {
  constructor(private readonly warningsService: WarningsService) {}

  @Public()
  @CacheTtl(86400)
  @Get()
  @ApiOperation({ summary: 'Listar catálogo de warnings' })
  list() {
    return this.warningsService.list();
  }
}
