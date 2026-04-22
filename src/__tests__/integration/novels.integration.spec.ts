import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  bearer,
  loginAs,
  registerUser,
  unwrapData,
} from '../helpers/auth.helper';
import { createTestApp } from '../helpers/test-app.helper';
import {
  cleanupUsersByPrefix,
  disconnectTestDb,
} from '../helpers/test-db.helper';

describe('Novels integration', () => {
  let app: INestApplication;
  const prefix = `it-novels-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsersByPrefix(prefix);
    await app.close();
    await disconnectTestDb();
  });

  it('creates a novel and requires published chapters before making it public', async () => {
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

    const createNovelResponse = await request(app.getHttpServer())
      .post('/api/v1/novels')
      .set('Authorization', bearer(session.accessToken))
      .send({
        title: 'Novela Integracion',
        synopsis: 'Novela creada desde tests de integracion',
        isPublic: false,
      });

    expect(createNovelResponse.status).toBe(201);
    expect(unwrapData<{ slug: string }>(createNovelResponse.body).slug).toBe(
      'novela-integracion',
    );

    const invalidPublishResponse = await request(app.getHttpServer())
      .patch('/api/v1/novels/novela-integracion')
      .set('Authorization', bearer(session.accessToken))
      .send({ isPublic: true });

    expect(invalidPublishResponse.status).toBe(400);

    const createChapterResponse = await request(app.getHttpServer())
      .post('/api/v1/novels/novela-integracion/chapters')
      .set('Authorization', bearer(session.accessToken))
      .send({
        title: 'Capitulo Integracion',
        content:
          'Este capitulo existe para habilitar la publicacion de la novela y validar el flujo de integracion.',
      });

    expect(createChapterResponse.status).toBe(201);

    const publishChapterResponse = await request(app.getHttpServer())
      .post(
        '/api/v1/novels/novela-integracion/chapters/capitulo-integracion/publish',
      )
      .set('Authorization', bearer(session.accessToken));

    expect(publishChapterResponse.status).toBe(201);

    const publishNovelResponse = await request(app.getHttpServer())
      .patch('/api/v1/novels/novela-integracion')
      .set('Authorization', bearer(session.accessToken))
      .send({ isPublic: true });

    expect(publishNovelResponse.status).toBe(200);
    expect(
      unwrapData<{ isPublic: boolean }>(publishNovelResponse.body).isPublic,
    ).toBe(true);

    const publicDetailResponse = await request(app.getHttpServer()).get(
      '/api/v1/novels/novela-integracion',
    );

    expect(publicDetailResponse.status).toBe(200);
    expect(unwrapData<{ title: string }>(publicDetailResponse.body).title).toBe(
      'Novela Integracion',
    );
  });
});
