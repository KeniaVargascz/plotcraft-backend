import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { WarningsService } from './warnings.service';

@ApiTags('warnings')
@Controller('warnings')
export class WarningsController {
  constructor(private readonly warningsService: WarningsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar catálogo de warnings' })
  list() {
    return this.warningsService.list();
  }
}
