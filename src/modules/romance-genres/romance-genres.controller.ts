import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RomanceGenresService } from './romance-genres.service';

@ApiTags('catalogs')
@Controller('catalogs/romance-genres')
export class RomanceGenresController {
  constructor(private readonly romanceGenresService: RomanceGenresService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listado de generos de romance disponibles' })
  listRomanceGenres() {
    return this.romanceGenresService.listRomanceGenres();
  }
}
