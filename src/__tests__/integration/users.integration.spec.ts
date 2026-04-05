import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, loginAs, registerUser, unwrapData } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/test-app.helper';
import { cleanupUsersByPrefix, disconnectTestDb } from '../helpers/test-db.helper';

describe('Users integration', () => {
  let app: INestApplication;
  const prefix = `it-users-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsersByPrefix(prefix);
    await app.close();
    await disconnectTestDb();
  });

  it('updates the current user without exposing password hash', async () => {
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

    const response = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', bearer(session.accessToken))
      .send({
        email: `${prefix}-updated@plotcraft.test`,
        username: `${prefix}-updated`,
      });

    expect(response.status).toBe(200);
    const updated = unwrapData<{ email: string; passwordHash?: string }>(
      response.body,
    );

    expect(updated.email).toBe(`${prefix}-updated@plotcraft.test`);
    expect(updated.passwordHash).toBeUndefined();
  });

  it('deletes the current account after password confirmation', async () => {
    await registerUser(app.getHttpServer(), {
      email: `${prefix}-delete@plotcraft.test`,
      username: `${prefix}-delete`,
      password: 'Demo1234!',
    });
    const session = await loginAs(
      app.getHttpServer(),
      `${prefix}-delete@plotcraft.test`,
      'Demo1234!',
    );

    const deleteResponse = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Authorization', bearer(session.accessToken))
      .send({ password: 'Demo1234!' });

    expect(deleteResponse.status).toBe(200);
    expect(unwrapData<{ message: string }>(deleteResponse.body).message).toMatch(
      /Cuenta eliminada/i,
    );

    const reloginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: `${prefix}-delete@plotcraft.test`,
        password: 'Demo1234!',
      });

    expect(reloginResponse.status).toBe(401);
  });
});
