import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, loginAs, unwrapData } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/test-app.helper';
import { disconnectTestDb, testPrisma } from '../helpers/test-db.helper';

describe('Reader integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestDb();
  });

  it('updates preferences and persists reading progress for seeded reader', async () => {
    const session = await loginAs(
      app.getHttpServer(),
      'reader.alex@plotcraft.com',
      'Demo1234!',
    );

    const novel = await testPrisma.novel.findUniqueOrThrow({
      where: { slug: 'las-cronicas-del-velo' },
      include: {
        chapters: {
          where: { status: 'PUBLISHED' },
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
    });

    const preferencesResponse = await request(app.getHttpServer())
      .patch('/api/reader/preferences')
      .set('Authorization', bearer(session.accessToken))
      .send({
        font_family: 'outfit',
        font_size: 20,
        reading_mode: 'scroll',
      });

    expect(preferencesResponse.status).toBe(200);
    expect(
      unwrapData<{ font_family: string }>(preferencesResponse.body).font_family,
    ).toBe('outfit');

    const progressResponse = await request(app.getHttpServer())
      .post('/api/reader/progress')
      .set('Authorization', bearer(session.accessToken))
      .send({
        novel_id: novel.id,
        chapter_id: novel.chapters[0]?.id,
        scroll_pct: 0.42,
      });

    expect(progressResponse.status).toBe(201);
    expect(
      unwrapData<{ scroll_pct: number }>(progressResponse.body).scroll_pct,
    ).toBe(0.42);

    const historyResponse = await request(app.getHttpServer())
      .post('/api/reader/history')
      .set('Authorization', bearer(session.accessToken))
      .send({
        novel_id: novel.id,
        chapter_id: novel.chapters[0]?.id,
      });

    expect(historyResponse.status).toBe(201);
  });
});
