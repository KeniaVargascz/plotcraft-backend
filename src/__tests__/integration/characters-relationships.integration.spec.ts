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

describe('Characters relationships integration', () => {
  let app: INestApplication;
  const prefix = `it-characters-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsersByPrefix(prefix);
    await app.close();
    await disconnectTestDb();
  });

  it('creates inverse kinship relationships and removes them as a group', async () => {
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

    const parentResponse = await request(app.getHttpServer())
      .post('/api/characters')
      .set('Authorization', bearer(session.accessToken))
      .send({
        name: 'Elena',
        isPublic: true,
      });

    const childResponse = await request(app.getHttpServer())
      .post('/api/characters')
      .set('Authorization', bearer(session.accessToken))
      .send({
        name: 'Tomas',
        isPublic: true,
      });

    expect(parentResponse.status).toBe(201);
    expect(childResponse.status).toBe(201);

    const parent = unwrapData<{ id: string; slug: string }>(
      parentResponse.body,
    );
    const child = unwrapData<{ id: string; slug: string }>(childResponse.body);

    const createRelationshipResponse = await request(app.getHttpServer())
      .post(`/api/characters/${prefix}/${parent.slug}/relationships`)
      .set('Authorization', bearer(session.accessToken))
      .send({
        targetId: child.id,
        category: 'KINSHIP',
        kinshipType: 'PARENT',
        description: 'Relacion familiar de prueba',
      });

    expect(createRelationshipResponse.status).toBe(201);
    const relationship = unwrapData<{
      id: string;
      label: string;
      kinshipType: string;
      target: { id: string; slug: string };
    }>(createRelationshipResponse.body);

    expect(relationship.label).toBe('Padre/Madre');
    expect(relationship.kinshipType).toBe('PARENT');
    expect(relationship.target.id).toBe(child.id);

    const parentListResponse = await request(app.getHttpServer()).get(
      `/api/characters/${prefix}/${parent.slug}/relationships`,
    );
    const childListResponse = await request(app.getHttpServer()).get(
      `/api/characters/${prefix}/${child.slug}/relationships`,
    );

    expect(parentListResponse.status).toBe(200);
    expect(childListResponse.status).toBe(200);

    const parentRelationships = unwrapData<
      Array<{ label: string; kinshipType: string; target: { id: string } }>
    >(parentListResponse.body);
    const childRelationships = unwrapData<
      Array<{ label: string; kinshipType: string; target: { id: string } }>
    >(childListResponse.body);

    expect(parentRelationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Padre/Madre',
          kinshipType: 'PARENT',
          target: expect.objectContaining({ id: child.id }),
        }),
      ]),
    );
    expect(childRelationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Hijo/Hija',
          kinshipType: 'CHILD',
          target: expect.objectContaining({ id: parent.id }),
        }),
      ]),
    );

    const deleteResponse = await request(app.getHttpServer())
      .delete(
        `/api/characters/${prefix}/${parent.slug}/relationships/${relationship.id}`,
      )
      .set('Authorization', bearer(session.accessToken));

    expect(deleteResponse.status).toBe(200);

    const parentAfterDeleteResponse = await request(app.getHttpServer()).get(
      `/api/characters/${prefix}/${parent.slug}/relationships`,
    );
    const childAfterDeleteResponse = await request(app.getHttpServer()).get(
      `/api/characters/${prefix}/${child.slug}/relationships`,
    );

    expect(unwrapData<unknown[]>(parentAfterDeleteResponse.body)).toHaveLength(
      0,
    );
    expect(unwrapData<unknown[]>(childAfterDeleteResponse.body)).toHaveLength(
      0,
    );
  });

  it('rejects self relationships', async () => {
    const username = `${prefix.slice(0, 18)}self`;
    await registerUser(app.getHttpServer(), {
      email: `${username}@plotcraft.test`,
      username,
      password: 'Demo1234!',
    });
    const session = await loginAs(
      app.getHttpServer(),
      `${username}@plotcraft.test`,
      'Demo1234!',
    );

    const characterResponse = await request(app.getHttpServer())
      .post('/api/characters')
      .set('Authorization', bearer(session.accessToken))
      .send({
        name: 'Solo',
        isPublic: true,
      });

    expect(characterResponse.status).toBe(201);
    const character = unwrapData<{ id: string; slug: string }>(
      characterResponse.body,
    );

    const createRelationshipResponse = await request(app.getHttpServer())
      .post(`/api/characters/${username}/${character.slug}/relationships`)
      .set('Authorization', bearer(session.accessToken))
      .send({
        targetId: character.id,
        category: 'KINSHIP',
        kinshipType: 'SIBLING',
      });

    expect(createRelationshipResponse.status).toBe(400);
  });
});
