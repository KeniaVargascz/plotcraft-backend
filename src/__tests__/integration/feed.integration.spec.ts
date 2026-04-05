import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, loginAs, registerUser, unwrapData } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/test-app.helper';
import { cleanupUsersByPrefix, disconnectTestDb } from '../helpers/test-db.helper';

describe('Feed integration', () => {
  let app: INestApplication;
  const prefix = `it-feed-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsersByPrefix(prefix);
    await app.close();
    await disconnectTestDb();
  });

  it('shows a created post in explore and keeps personalized feed protected', async () => {
    await registerUser(app.getHttpServer(), {
      email: `${prefix}@plotcraft.test`,
      username: prefix,
      password: 'Demo1234!',
    });
    const session = await loginAs(
      app.getHttpServer(),
      `${prefix}@plotcraft.test`,
      'Demo1234!',
    );

    const createPostResponse = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', bearer(session.accessToken))
      .send({
        content: `Post de integracion ${prefix}`,
      });

    expect(createPostResponse.status).toBe(201);

    const exploreResponse = await request(app.getHttpServer()).get(
      '/api/feed/explore',
    );

    expect(exploreResponse.status).toBe(200);
    const exploreFeed = unwrapData<{ data: Array<{ content?: string }> }>(
      exploreResponse.body,
    );

    expect(
      exploreFeed.data.some(
        (item: { content?: string }) => item.content === `Post de integracion ${prefix}`,
      ),
    ).toBe(true);

    const personalizedWithoutAuth = await request(app.getHttpServer()).get(
      '/api/feed',
    );

    expect(personalizedWithoutAuth.status).toBe(401);

    const personalizedWithAuth = await request(app.getHttpServer())
      .get('/api/feed')
      .set('Authorization', bearer(session.accessToken));

    expect(personalizedWithAuth.status).toBe(200);
  });
});
