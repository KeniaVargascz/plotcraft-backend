import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NovelsService } from '../src/modules/novels/novels.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const svc = app.get(NovelsService);
  // viewerId = author id from earlier debug
  const r = await svc.getNovelBySlug('la-cocina-del-amor', '1177f764-4b58-4339-bd7f-85b6c4e059ee');
  console.log(JSON.stringify({
    id: (r as any).id,
    novelType: (r as any).novelType,
    characters: (r as any).characters?.length,
    communityCharacters: (r as any).communityCharacters?.length,
    sampleCC: (r as any).communityCharacters?.[0],
  }, null, 2));
  await app.close();
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
