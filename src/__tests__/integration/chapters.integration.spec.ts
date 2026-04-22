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

describe('Chapters integration', () => {
  let app: INestApplication;
  const prefix = `it-chapters-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsersByPrefix(prefix);
    await app.close();
    await disconnectTestDb();
  });

  it('creates, autosaves, publishes and reorders chapters', async () => {
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

    await request(app.getHttpServer())
      .post('/api/v1/novels')
      .set('Authorization', bearer(session.accessToken))
      .send({
        title: 'Novela Capitulos',
        synopsis: 'Base para probar capitulos',
      });

    const chapterOne = await request(app.getHttpServer())
      .post('/api/v1/novels/novela-capitulos/chapters')
      .set('Authorization', bearer(session.accessToken))
      .send({
        title: 'Primero',
        content: 'Contenido inicial del primer capitulo para integracion.',
      });

    const chapterTwo = await request(app.getHttpServer())
      .post('/api/v1/novels/novela-capitulos/chapters')
      .set('Authorization', bearer(session.accessToken))
      .send({
        title: 'Segundo',
        content: 'Contenido inicial del segundo capitulo para integracion.',
      });

    expect(chapterOne.status).toBe(201);
    expect(chapterTwo.status).toBe(201);

    const autosaveResponse = await request(app.getHttpServer())
      .patch('/api/v1/novels/novela-capitulos/chapters/primero/autosave')
      .set('Authorization', bearer(session.accessToken))
      .send({
        content:
          'Contenido actualizado con autosave para verificar la respuesta minima del endpoint.',
      });

    expect(autosaveResponse.status).toBe(200);
    expect(
      unwrapData<{ wordCount: number }>(autosaveResponse.body).wordCount,
    ).toBeGreaterThan(0);

    const reorderResponse = await request(app.getHttpServer())
      .patch('/api/v1/novels/novela-capitulos/chapters/reorder')
      .set('Authorization', bearer(session.accessToken))
      .send({
        chapters: [
          {
            id: unwrapData<{ id: string }>(chapterTwo.body).id,
            order: 1,
          },
          {
            id: unwrapData<{ id: string }>(chapterOne.body).id,
            order: 2,
          },
        ],
      });

    expect(reorderResponse.status).toBe(200);

    const publishResponse = await request(app.getHttpServer())
      .post('/api/v1/novels/novela-capitulos/chapters/primero/publish')
      .set('Authorization', bearer(session.accessToken));

    expect(publishResponse.status).toBe(201);
    expect(unwrapData<{ status: string }>(publishResponse.body).status).toBe(
      'PUBLISHED',
    );

    const draftsResponse = await request(app.getHttpServer())
      .get('/api/v1/novels/novela-capitulos/chapters/drafts')
      .set('Authorization', bearer(session.accessToken));

    expect(draftsResponse.status).toBe(200);
    expect(
      unwrapData<{ data: unknown[] }>(draftsResponse.body).data,
    ).toHaveLength(2);
  });
});
