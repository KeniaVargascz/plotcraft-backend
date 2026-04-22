import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CacheTtl } from '../../common/decorators/cache-ttl.decorator';
import { GenresService } from './genres.service';

@ApiTags('genres')
@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Public()
  @CacheTtl(86400)
  @Get()
  @ApiOperation({ summary: 'Listado completo de generos disponibles' })
  listGenres() {
    return this.genresService.listGenres();
  }
}
