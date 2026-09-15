# videostream-backend

NestJS backend for a video-streaming platform. Phone-uploaded video → object storage →
ffmpeg transcode to adaptive HLS → played back on device. Built as a backend-learning project
(stack mirrors the internal `wisdom` project).

## Stack

NestJS 11 · MongoDB/Mongoose · Redis + Bull (queues) · JWT/Passport auth · S3-compatible storage
(`@aws-sdk/client-s3`) · ffmpeg (own HLS transcode) · class-validator · Joi config · Swagger.

## Pipeline

```
POST /videos/upload        → presigned S3 PUT URL (client uploads straight to storage)
PUT <upload_url>           → file lands in storage
POST /videos/:id/complete  → enqueues a Bull transcode job
Bull worker (ffmpeg)       → HLS renditions + thumbnail → status: ready, sets hls_url
GET /videos                → cursor-paginated feed of ready videos (adaptive HLS)
```

Phase 2: likes, view counts, comments, watch history, public profiles, search/filter, admin moderation.

## Run locally

```bash
colima start && docker-compose up -d      # MongoDB + Redis
cp .env.example .env                       # fill values
npm install
npm run start:dev                          # http://localhost:3000, Swagger at /api/docs (basic auth)
npm run test:e2e                           # e2e suite
```

Requires `ffmpeg` on PATH for the transcode worker.

## Docs

- [docs/video-streaming-roadmap.md](docs/video-streaming-roadmap.md) — full roadmap + system-design track
- [PROGRESS.md](PROGRESS.md) — build log + lessons
- [CLAUDE.md](CLAUDE.md) — AI mentor instructions
