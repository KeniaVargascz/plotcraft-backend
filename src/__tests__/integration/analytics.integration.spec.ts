import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, loginAs, unwrapData } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/test-app.helper';
import { disconnectTestDb } from '../helpers/test-db.helper';

describe('Analytics integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestDb();
  });

  it('returns author and novel analytics for an authenticated writer', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs(
      httpServer,
      'demo@plotcraft.com',
      'Demo1234!',
    );

    const authorResponse = await request(httpServer)
      .get('/api/v1/analytics/me?period=30d')
      .set('Authorization', bearer(session.accessToken));
    const authorBody = authorResponse.body as {
      data?: { totals: { totalNovels: number } };
    };

    expect(authorResponse.status).toBe(200);
    expect(
      unwrapData<{ totals: { totalNovels: number } }>(authorBody).totals
        .totalNovels,
    ).toBeGreaterThan(0);

    const novelResponse = await request(httpServer)
      .get('/api/v1/analytics/novels/las-cronicas-del-velo?period=30d')
      .set('Authorization', bearer(session.accessToken));
    const novelBody = novelResponse.body as {
      data?: { novel: { slug: string } };
    };

    expect(novelResponse.status).toBe(200);
    expect(unwrapData<{ novel: { slug: string } }>(novelBody).novel.slug).toBe(
      'las-cronicas-del-velo',
    );
  });
});
