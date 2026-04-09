import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { hasTestDatabase, resetTestDatabase } from './helpers/test-db';

async function createApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('Account API (e2e)', () => {
  let app: INestApplication;
  const originalDebug = process.env.AUTH_DEBUG_CODE_ENABLED;

  beforeAll(async () => {
    process.env.AUTH_DEBUG_CODE_ENABLED = 'true';
    await resetTestDatabase();
    app = await createApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    process.env.AUTH_DEBUG_CODE_ENABLED = originalDebug;
  });

  it('/health (GET)', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ ok: true });
  });

  it('allows the desktop renderer origin to call auth endpoints', async () => {
    const response = await request(app.getHttpServer())
      .options('/auth/send-code')
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('supports send-code, register, login, and authenticated server-config roundtrip', async () => {
    const email = `user-${Date.now()}@example.com`;
    const password = 'P@ssword123';

    const sendCodeResponse = await request(app.getHttpServer())
      .post('/auth/send-code')
      .send({ email })
      .expect(201);

    expect(sendCodeResponse.body).toEqual(
      expect.objectContaining({
        accepted: true,
        email,
        debugCode: expect.stringMatching(/^\d{6}$/),
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        code: sendCodeResponse.body.debugCode,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const accessToken = loginResponse.body.tokens.accessToken as string;

    await request(app.getHttpServer()).get('/me/server-config').expect(401);

    const payload = {
      serverIp: '121.41.211.153',
      sshPort: 22,
      sshUsername: 'root',
      authType: 'password',
      sshPassword: 'xzx1314.',
      openclawToken: 'a2a5902281e6391e566dc5c18b29d4548a69d509f33644ce',
    };

    await request(app.getHttpServer())
      .put('/me/server-config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(200)
      .expect({ saved: true });

    const configResponse = await request(app.getHttpServer())
      .get('/me/server-config')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(configResponse.body).toEqual(payload);
  });

  it('supports forgot-password reset flow with verification code', async () => {
    const email = `reset-${Date.now()}@example.com`;
    const password = 'P@ssword123';
    const nextPassword = 'N3wP@ssword456';

    const registerCodeResponse = await request(app.getHttpServer())
      .post('/auth/send-code')
      .send({ email })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        code: registerCodeResponse.body.debugCode,
      })
      .expect(201);

    const resetCodeResponse = await request(app.getHttpServer())
      .post('/auth/send-reset-code')
      .send({ email })
      .expect(201);

    expect(resetCodeResponse.body).toEqual(
      expect.objectContaining({
        accepted: true,
        email,
        debugCode: expect.stringMatching(/^\d{6}$/),
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        email,
        code: resetCodeResponse.body.debugCode,
        password: nextPassword,
      })
      .expect(201)
      .expect({ reset: true });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: nextPassword })
      .expect(201);
  });

  const persistenceIt = hasTestDatabase ? it : it.skip;

  persistenceIt('persists account and server config after app recreation when DATABASE_URL is configured', async () => {
    const email = `persist-${Date.now()}@example.com`;
    const password = 'P@ssword123';

    const sendCodeResponse = await request(app.getHttpServer())
      .post('/auth/send-code')
      .send({ email })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        code: sendCodeResponse.body.debugCode,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const accessToken = loginResponse.body.tokens.accessToken as string;
    const payload = {
      serverIp: '10.0.0.8',
      sshPort: 2222,
      sshUsername: 'admin',
      authType: 'key',
      sshPrivateKey: '---PRIVATE KEY---',
      openclawToken: 'persist-token',
    };

    await request(app.getHttpServer())
      .put('/me/server-config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(200);

    await app.close();
    app = await createApp();

    const secondLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const persistedToken = secondLogin.body.tokens.accessToken as string;
    const configResponse = await request(app.getHttpServer())
      .get('/me/server-config')
      .set('Authorization', `Bearer ${persistedToken}`)
      .expect(200);

    expect(configResponse.body).toEqual(payload);
  });
});
