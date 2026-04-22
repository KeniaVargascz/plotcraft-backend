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

/**
 * Ownership violation tests.
 *
 * Verifies that User B cannot modify or delete resources
 * created by User A. Each test:
 *   1. User A creates a resource
 *   2. User B attempts PATCH / DELETE on that resource
 *   3. Expects 403 Forbidden
 */
describe('Ownership violations', () => {
  let app: INestApplication;
  const prefix = `it-own-${Date.now()}`;
  let sessionA: { accessToken: string; refreshToken: string };
  let sessionB: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    app = await createTestApp();

    // Register two independent users
    await registerUser(app.getHttpServer(), {
      email: `${prefix}-a@plotcraft.test`,
      username: `${prefix}-a`,
      password: 'Demo1234!',
    });
    await registerUser(app.getHttpServer(), {
      email: `${prefix}-b@plotcraft.test`,
      username: `${prefix}-b`,
      password: 'Demo1234!',
    });

    sessionA = await loginAs(
      app.getHttpServer(),
      `${prefix}-a@plotcraft.test`,
      'Demo1234!',
    );
    sessionB = await loginAs(
      app.getHttpServer(),
      `${prefix}-b@plotcraft.test`,
      'Demo1234!',
    );
  });

  afterAll(async () => {
    await cleanupUsersByPrefix(prefix);
    await app.close();
    await disconnectTestDb();
  });

  // ── Novels ──────────────────────────────────────────────

  let novelSlug: string;

  it('User A creates a novel', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/novels')
      .set('Authorization', bearer(sessionA.accessToken))
      .send({
        title: `${prefix} Novela Ownership`,
        synopsis: 'Test de ownership',
        isPublic: false,
      });

    expect(res.status).toBe(201);
    novelSlug = unwrapData<{ slug: string }>(res.body).slug;
  });

  it('User B cannot PATCH User A novel → 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/novels/${novelSlug}`)
      .set('Authorization', bearer(sessionB.accessToken))
      .send({ title: 'Hijacked Title' });

    expect(res.status).toBe(403);
  });

  it('User B cannot DELETE User A novel → 403', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/novels/${novelSlug}`)
      .set('Authorization', bearer(sessionB.accessToken));

    expect(res.status).toBe(403);
  });

  // ── Chapters ────────────────────────────────────────────

  let chapterSlug: string;

  it('User A creates a chapter in their novel', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/novels/${novelSlug}/chapters`)
      .set('Authorization', bearer(sessionA.accessToken))
      .send({
        title: `${prefix} Capitulo Ownership`,
        content: 'Contenido del capitulo para test de ownership.',
      });

    expect(res.status).toBe(201);
    chapterSlug = unwrapData<{ slug: string }>(res.body).slug;
  });

  it('User B cannot PATCH User A chapter → 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/novels/${novelSlug}/chapters/${chapterSlug}`)
      .set('Authorization', bearer(sessionB.accessToken))
      .send({ title: 'Hijacked Chapter' });

    expect(res.status).toBe(403);
  });

  it('User B cannot DELETE User A chapter → 403', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/novels/${novelSlug}/chapters/${chapterSlug}`)
      .set('Authorization', bearer(sessionB.accessToken));

    expect(res.status).toBe(403);
  });

  // ── Worlds ──────────────────────────────────────────────

  let worldSlug: string;

  it('User A creates a world', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/worlds')
      .set('Authorization', bearer(sessionA.accessToken))
      .send({
        name: `${prefix} Mundo Ownership`,
        tagline: 'Mundo de test ownership',
        visibility: 'PRIVATE',
      });

    expect(res.status).toBe(201);
    worldSlug = unwrapData<{ slug: string }>(res.body).slug;
  });

  it('User B cannot PATCH User A world → 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/worlds/${worldSlug}`)
      .set('Authorization', bearer(sessionB.accessToken))
      .send({ name: 'Hijacked World' });

    expect(res.status).toBe(403);
  });

  it('User B cannot DELETE User A world → 403', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/worlds/${worldSlug}`)
      .set('Authorization', bearer(sessionB.accessToken));

    expect(res.status).toBe(403);
  });

  // ── Posts ───────────────────────────────────────────────

  let postId: string;

  it('User A creates a post', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', bearer(sessionA.accessToken))
      .send({
        content: `${prefix} Post de test de ownership`,
        type: 'TEXT',
      });

    expect(res.status).toBe(201);
    postId = unwrapData<{ id: string }>(res.body).id;
  });

  it('User B cannot PATCH User A post → 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/posts/${postId}`)
      .set('Authorization', bearer(sessionB.accessToken))
      .send({ content: 'Hijacked Post' });

    expect(res.status).toBe(403);
  });

  it('User B cannot DELETE User A post → 403', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/posts/${postId}`)
      .set('Authorization', bearer(sessionB.accessToken));

    expect(res.status).toBe(403);
  });
});
