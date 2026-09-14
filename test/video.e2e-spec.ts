import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { User, UserDocument, UserRole } from '../src/user/user.schema'
import { Video, VideoDocument } from '../src/video/video.schema'
import { VideoStatus } from '../src/video/enums/video-status.enum'

// E2E = boot the whole app once, fire real HTTP at it, hit the real Mongo.
describe('Videos (e2e)', () => {
  let app: INestApplication
  let token: string
  let user: UserDocument
  let video: VideoDocument

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
    const user_model = moduleRef.get<Model<UserDocument>>(getModelToken(User.name))
    await user_model.findOneAndUpdate(
      { phone: '+10000000000' },
      { is_banned: false, role: UserRole.USER },
    )

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '+10000000000', code: '123123' })
      .expect(201)

    token = res.body.access_token

    const video_model = moduleRef.get<Model<VideoDocument>>(getModelToken(Video.name))
    user = (await user_model.findOne({ phone: '+10000000000' }))!
    video = await video_model.create({
      owner_id: user.id,
      title: 'Phase two search fixture',
      source_key: 'tests/fixture.mp4',
      status: VideoStatus.READY,
      hls_url: 'http://example.test/master.m3u8',
    })
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

  it('updates metadata and filters the ready feed by category, tag, and search', async () => {
    await request(app.getHttpServer())
      .patch(`/videos/${video.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Education', tags: ['NestJS', 'Backend'] })
      .expect(200)

    const page = await request(app.getHttpServer())
      .get('/videos?category=education&tag=nestjs&q=phase')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(page.body.items.map((item: { _id: string }) => item._id)).toContain(video.id)
  })

  it('records idempotent likes and playback views', async () => {
    const first_like = await request(app.getHttpServer())
      .post(`/videos/${video.id}/like`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(first_like.body).toEqual({ liked: true, likes_count: 1 })

    await request(app.getHttpServer())
      .post(`/videos/${video.id}/like`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const view = await request(app.getHttpServer())
      .post(`/videos/${video.id}/views`)
      .set('Authorization', `Bearer ${token}`)
      .expect(202)
    expect(view.body.views_count).toBe(1)

    const unlike = await request(app.getHttpServer())
      .delete(`/videos/${video.id}/like`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(unlike.body).toEqual({ liked: false, likes_count: 0 })
  })

  it('creates, lists, and removes comments', async () => {
    const created = await request(app.getHttpServer())
      .post(`/videos/${video.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Helpful walkthrough.' })
      .expect(201)

    const comments = await request(app.getHttpServer())
      .get(`/videos/${video.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(comments.body.map((comment: { _id: string }) => comment._id)).toContain(created.body._id)

    await request(app.getHttpServer())
      .delete(`/comments/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)
  })

  it('stores watch history and exposes a public profile', async () => {
    await request(app.getHttpServer())
      .post(`/videos/${video.id}/history`)
      .set('Authorization', `Bearer ${token}`)
      .send({ position_seconds: 12.5 })
      .expect(201)

    const history = await request(app.getHttpServer())
      .get('/users/me/history')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(history.body.some((item: { video_id: { _id: string } }) => item.video_id?._id === video.id)).toBe(true)

    const profile = await request(app.getHttpServer())
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(profile.body._id).toBe(user.id)
  })

  it('restricts moderation to admins', async () => {
    await request(app.getHttpServer())
      .get('/admin/videos')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    user.role = UserRole.ADMIN
    await user.save()

    await request(app.getHttpServer())
      .patch(`/admin/videos/${video.id}/moderation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ hidden: true })
      .expect(200)

    await request(app.getHttpServer())
      .patch(`/admin/users/${user.id}/ban`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_banned: true })
      .expect(200)

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    user.role = UserRole.USER
    user.is_banned = false
    await user.save()
  })
})
