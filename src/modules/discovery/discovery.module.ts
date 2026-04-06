import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { CACHE_SERVICE } from '../../common/services/cache.service';
import { MemoryCacheService } from '../../common/services/cache.service';

@Module({
  imports: [PrismaModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    {
      provide: CACHE_SERVICE,
      useClass: MemoryCacheService,
    },
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
