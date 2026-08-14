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

  it('rejects POST /videos without a token (guard works)', () => {
    return request(app.getHttpServer())
      .post('/videos')
      .send({ title: 'no auth' })
      .expect(401)
  })

  it('creates a video owned by the token holder, status uploading', async () => {
    const res = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'my first video' })
      .expect(201)

    expect(res.body.title).toBe('my first video')
    expect(res.body.status).toBe('uploading') // enum default kicked in
    expect(res.body.owner_id).toBeDefined() // came from the verified token, not the body
  })

  it('GET /videos returns only ready videos (the fresh one is hidden)', async () => {
    const create = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'still uploading' })
      .expect(201)

    const list = await request(app.getHttpServer())
      .get('/videos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    // Every returned video must be ready...
    expect(list.body.every((v: { status: string }) => v.status === 'ready')).toBe(true)
    // ...so the uploading one we just made must NOT appear.
    const ids = list.body.map((v: { _id: string }) => v._id)
    expect(ids).not.toContain(create.body._id)
  })
})