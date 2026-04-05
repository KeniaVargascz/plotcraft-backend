import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, loginAs, registerUser, unwrapData } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/test-app.helper';
import { cleanupUsersByPrefix, disconnectTestDb } from '../helpers/test-db.helper';

describe('Auth integration', () => {
  let app: INestApplication;
  const prefix = `it-auth-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsersByPrefix(prefix);
    await app.close();
    await disconnectTestDb();
  });

  it('registers, logs in, refreshes and logs out a user', async () => {
    const registerResponse = await registerUser(app.getHttpServer(), {
      email: `${prefix}@plotcraft.test`,
      username: prefix,
      password: 'Demo1234!',
    });

    expect(registerResponse.status).toBe(201);
    const registered = unwrapData<{
      user: { email: string; passwordHash?: string };
    }>(registerResponse.body);

    expect(registered.user.email).toBe(`${prefix}@plotcraft.test`);
    expect(registered.user.passwordHash).toBeUndefined();

    const loginSession = await loginAs(
      app.getHttpServer(),
      `${prefix}@plotcraft.test`,
      'Demo1234!',
    );

    const meResponse = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(loginSession.accessToken));

    expect(meResponse.status).toBe(200);
    const me = unwrapData<{ username: string; passwordHash?: string }>(
      meResponse.body,
    );

    expect(me.username).toBe(prefix);
    expect(me.passwordHash).toBeUndefined();

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: loginSession.refreshToken });

    expect(refreshResponse.status).toBe(200);
    const refreshSession = unwrapData<{
      accessToken: string;
      refreshToken: string;
    }>(refreshResponse.body);

    expect(refreshSession.refreshToken).toEqual(expect.any(String));
    expect(refreshSession.accessToken).toEqual(expect.any(String));

    const logoutResponse = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', bearer(refreshSession.accessToken))
      .send({ refreshToken: refreshSession.refreshToken });

    expect(logoutResponse.status).toBe(200);
    expect(unwrapData<{ message: string }>(logoutResponse.body).message).toMatch(
      /Sesion cerrada/i,
    );
  });
});
