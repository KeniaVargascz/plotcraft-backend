import request, { type Response } from 'supertest';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
};

function unwrapData<T>(body: { data?: T }): T {
  return body.data as T;
}

export async function loginAs(
  httpServer: Parameters<typeof request>[0],
  email: string,
  password: string,
): Promise<AuthSession> {
  const response = await request(httpServer).post('/api/auth/login').send({
    email,
    password,
  });

  return unwrapData<AuthSession>(response.body);
}

export async function registerUser(
  httpServer: Parameters<typeof request>[0],
  payload: {
    email: string;
    username: string;
    password: string;
  },
): Promise<Response> {
  return request(httpServer).post('/api/auth/register').send(payload);
}

export function bearer(accessToken: string) {
  return `Bearer ${accessToken}`;
}

export { unwrapData };
