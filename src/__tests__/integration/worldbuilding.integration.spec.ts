import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, loginAs, unwrapData } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/test-app.helper';
import { disconnectTestDb } from '../helpers/test-db.helper';

describe('Worldbuilding integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestDb();
  });

  it('lists templates and lets an owner create and fetch a worldbuilding entry', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const templatesResponse = await request(httpServer).get(
      '/api/worlds/wb/templates',
    );
    const templatesBody = templatesResponse.body as {
      data?: Array<{ key: string }>;
    };

    expect(templatesResponse.status).toBe(200);
    expect(
      unwrapData<Array<{ key: string }>>(templatesBody).length,
    ).toBeGreaterThan(0);

    const session = await loginAs(
      httpServer,
      'demo@plotcraft.com',
      'Demo1234!',
    );
    const suffix = Date.now().toString();
    const fieldKey = 'detalle_prueba';

    const categoryResponse = await request(httpServer)
      .post('/api/worlds/el-mundo-del-velo/wb/categories')
      .set('Authorization', bearer(session.accessToken))
      .send({
        name: `Cronica ${suffix}`,
        icon: '📚',
        color: '#4f46e5',
        fieldSchema: [
          {
            key: fieldKey,
            label: 'Detalle',
            type: 'text',
            required: false,
            placeholder: null,
            options: null,
            default: null,
            sortOrder: 1,
          },
        ],
      });
    const categoryBody = categoryResponse.body as {
      data?: { id: string; slug: string };
    };

    expect(categoryResponse.status).toBe(201);
    const category = unwrapData<{ id: string; slug: string }>(categoryBody);

    const entryResponse = await request(httpServer)
      .post('/api/worlds/el-mundo-del-velo/wb/entries')
      .set('Authorization', bearer(session.accessToken))
      .send({
        name: `Entrada ${suffix}`,
        categoryId: category.id,
        summary: 'Smoke integration entry',
        fields: {
          [fieldKey]: 'contenido',
        },
        isPublic: true,
      });
    const entryBody = entryResponse.body as {
      data?: { slug: string };
    };

    expect(entryResponse.status).toBe(201);
    const entry = unwrapData<{ slug: string }>(entryBody);

    const detailResponse = await request(httpServer).get(
      `/api/worlds/el-mundo-del-velo/wb/entries/${entry.slug}`,
    );
    const detailBody = detailResponse.body as {
      data?: { slug: string; category: { slug: string } };
    };

    expect(detailResponse.status).toBe(200);
    expect(
      unwrapData<{ slug: string; category: { slug: string } }>(detailBody)
        .category.slug,
    ).toBe(category.slug);
  });
});
