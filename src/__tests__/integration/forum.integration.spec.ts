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

describe('Forum integration', () => {
  let app: INestApplication;
  const authorPrefix = `it-forum-author-${Date.now()}`;
  const readerPrefix = `it-forum-reader-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsersByPrefix(authorPrefix);
    await cleanupUsersByPrefix(readerPrefix);
    await app.close();
    await disconnectTestDb();
  });

  it('creates a thread, allows voting and toggles closed state', async () => {
    await registerUser(app.getHttpServer(), {
      email: `${authorPrefix}@plotcraft.test`,
      username: authorPrefix,
      password: 'Demo1234!',
    });
    await registerUser(app.getHttpServer(), {
      email: `${readerPrefix}@plotcraft.test`,
      username: readerPrefix,
      password: 'Demo1234!',
    });

    const authorSession = await loginAs(
      app.getHttpServer(),
      `${authorPrefix}@plotcraft.test`,
      'Demo1234!',
    );
    const readerSession = await loginAs(
      app.getHttpServer(),
      `${readerPrefix}@plotcraft.test`,
      'Demo1234!',
    );

    const createThreadResponse = await request(app.getHttpServer())
      .post('/api/v1/forum')
      .set('Authorization', bearer(authorSession.accessToken))
      .send({
        title: 'Thread de integracion',
        content: 'Contenido del hilo para validar foro.',
        poll: {
          question: 'Que opcion prefieres?',
          options: ['Opcion A', 'Opcion B'],
        },
      });

    expect(createThreadResponse.status).toBe(201);
    const createdThread = unwrapData<{ slug: string }>(
      createThreadResponse.body,
    );
    const slug = createdThread.slug;

    const threadDetailResponse = await request(app.getHttpServer()).get(
      `/api/v1/forum/${slug}`,
    );
    const threadDetail = unwrapData<{
      poll: { options: Array<{ id: string }> };
    }>(threadDetailResponse.body);
    const optionId = threadDetail.poll.options[0]?.id;

    const voteResponse = await request(app.getHttpServer())
      .post(`/api/v1/forum/${slug}/vote`)
      .set('Authorization', bearer(readerSession.accessToken))
      .send({ optionId });

    expect(voteResponse.status).toBe(201);

    const closeResponse = await request(app.getHttpServer())
      .post(`/api/v1/forum/${slug}/close`)
      .set('Authorization', bearer(authorSession.accessToken));

    expect(closeResponse.status).toBe(201);

    const reopenResponse = await request(app.getHttpServer())
      .post(`/api/v1/forum/${slug}/open`)
      .set('Authorization', bearer(authorSession.accessToken));

    expect(reopenResponse.status).toBe(201);
  });
});
