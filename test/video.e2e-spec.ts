import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'

// E2E = boot the whole app once, fire real HTTP at it, hit the real Mongo.
describe('Videos (e2e)', () => {
  let app: INestApplication
  let token: string

  // Runs ONCE before all tests: build the app from the same AppModule main.ts uses.
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    // main.ts's bootstrap() does NOT run in tests, so re-apply the global pipe
    // here so DTO validation behaves the same as production.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init() // wires up modules + connects Mongoose (no network port needed)

    // Log in through the real flow to get a real JWT (fixed OTP in dev).
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '+10000000000', code: '123123' })
      .expect(201)

    token = res.body.access_token
  })

  // Always close the app so Mongoose disconnects and Jest can exit.
  afterAll(async () => {
    await app.close()
  })

  it('rejects POST /videos/upload without a token (guard works)', () => {
    return request(app.getHttpServer())
      .post('/videos/upload')
      .send({ title: 'no auth' })
      .expect(401)
  })

  it('creates a direct storage upload owned by the token holder', async () => {
    const res = await request(app.getHttpServer())
      .post('/videos/upload')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'my first video' })
      .expect(201)

    expect(res.body.video_id).toBeDefined()
    expect(res.body.upload_url).toContain('X-Amz-Signature')
  })

  it('queues processing only after the owner completes the upload', async () => {
    const create = await request(app.getHttpServer())
      .post('/videos/upload')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'ready after ffmpeg' })
      .expect(201)

    const complete = await request(app.getHttpServer())
      .post(`/videos/${create.body.video_id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(202)

    expect(complete.body).toEqual({
      video_id: create.body.video_id,
      status: 'processing',
    })
  })

  it('returns a bounded cursor page of ready videos', async () => {
    const page = await request(app.getHttpServer())
      .get('/videos?limit=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(Array.isArray(page.body.items)).toBe(true)
    expect(page.body).toHaveProperty('next_cursor')
    expect(page.body.items.length).toBeLessThanOrEqual(1)
  })

  it('rejects an unsafe page size', () => {
    return request(app.getHttpServer())
      .get('/videos?limit=51')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
  })
})
