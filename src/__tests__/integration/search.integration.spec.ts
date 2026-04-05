import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, loginAs, unwrapData } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/test-app.helper';
import { disconnectTestDb } from '../helpers/test-db.helper';

describe('Search integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestDb();
  });

  it('returns grouped search results, suggestions and authenticated history', async () => {
    const searchResponse = await request(app.getHttpServer()).get(
      '/api/search?q=velo',
    );

    expect(searchResponse.status).toBe(200);
    expect(
      unwrapData<{ results: { novels: { items: unknown[] } } }>(searchResponse.body)
        .results.novels.items.length,
    ).toBeGreaterThan(0);

    const suggestionsResponse = await request(app.getHttpServer()).get(
      '/api/search/suggestions?q=vel',
    );

    expect(suggestionsResponse.status).toBe(200);
    expect(
      unwrapData<{ suggestions: unknown[] }>(suggestionsResponse.body).suggestions
        .length,
    ).toBeGreaterThan(0);

    const session = await loginAs(
      app.getHttpServer(),
      'demo@plotcraft.com',
      'Demo1234!',
    );

    await request(app.getHttpServer())
      .get('/api/search?q=silencio')
      .set('Authorization', bearer(session.accessToken));

    const historyResponse = await request(app.getHttpServer())
      .get('/api/search/history')
      .set('Authorization', bearer(session.accessToken));

    expect(historyResponse.status).toBe(200);
    expect(
      Array.isArray(unwrapData<{ history: unknown[] }>(historyResponse.body).history),
    ).toBe(true);
  });
});
