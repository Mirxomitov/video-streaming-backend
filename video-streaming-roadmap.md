# Video Streaming Platform — Build Roadmap

> Greenfield project (mobile + backend). Stack deliberately mirrors the `wisdom` project
> so backend colleagues can support you 1:1. This doc is your checklist — tick items as you go.

---

## 0. Tech stack (copy this exactly)

### Backend — NestJS monorepo
| Concern | Choice | Package |
|---|---|---|
| Framework | NestJS 11 (TypeScript) | `@nestjs/core`, `@nestjs/common` |
| HTTP platform | Express | `@nestjs/platform-express` |
| Database | MongoDB + Mongoose | `@nestjs/mongoose`, `mongoose` |
| Background jobs | Bull + Redis | `@nestjs/bull`, `bull` |
| Auth | JWT + Passport | `@nestjs/jwt`, `@nestjs/passport`, `passport` |
| Validation | class-validator / class-transformer | `class-validator`, `class-transformer` |
| Config | `@nestjs/config` + Joi schema | `@nestjs/config`, `joi` |
| API docs | Swagger | `@nestjs/swagger` |
| Push | Firebase Admin | `firebase-admin` |
| Passwords | bcrypt | `bcrypt` |
| Scheduling | `@nestjs/schedule` | `@nestjs/schedule` |
| Rate limiting | `@nestjs/throttler` | `@nestjs/throttler` |
| Deploy | Docker + docker-compose | — |
| Tooling | ESLint + Prettier + Jest + SWC | — |

**Monorepo apps** (same split as wisdom):
- `apps/backend` — public mobile-facing API
- `apps/admin` — admin/moderation API
- `apps/queue` — Bull workers (video transcoding lives here)
- `apps/cron` — scheduled jobs (cleanup, analytics rollups)

### Video-specific additions (wisdom doesn't have these)
| Concern | Choice |
|---|---|
| Transcoding | **ffmpeg** → HLS (adaptive bitrate) — runs as a Bull job in `apps/queue` |
| Object storage | **Cloudflare R2** or **DigitalOcean Spaces** (S3-compatible, no egress fees) |
| CDN | In front of storage for playback |
| S3 client | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |

> **MVP shortcut:** use **Cloudflare Stream** or **Mux** for transcoding+CDN at first
> (you upload a file, get back a playback URL). Swap in your own ffmpeg pipeline later.
> Everything else in the stack stays identical.

### Mobile — Flutter
| Concern | Package |
|---|---|
| State | `flutter_bloc`, `equatable` |
| HTTP | `dio`, `pretty_dio_logger` |
| DI | `get_it` |
| Navigation | `auto_route` |
| Local storage | `get_storage` |
| Images | `cached_network_image`, `flutter_svg` |
| **Video playback** | `better_player` (or `video_player` + `chewie`) — HLS native |
| Upload picker | `image_picker` / `file_picker` |

---

## Phase 0 — Foundations  ⏱ ~1 week

- [ ] `nest new video-backend`, then convert to monorepo (`apps/backend`, `admin`, `queue`, `cron`)
      — ask a colleague for the wisdom `nest-cli.json` to copy the layout
- [ ] `docker-compose.yaml` with **MongoDB** + **Redis** containers
- [ ] `.env` + `.env.example` + Joi config validation (`@nestjs/config`)
- [ ] ESLint + Prettier + Jest wired up
- [ ] Health-check endpoint + Swagger at `/docs`
- [ ] **Auth module**: register / login / JWT guard (bcrypt for passwords)
- [ ] `User` Mongoose model
- [ ] Flutter app skeleton: BLoC + dio + get_it + auto_route, login screen hitting the API

**Done when:** a phone can register, log in, and hit an authenticated `/me` endpoint.

---

## Phase 1 — Core loop: upload → transcode → play  ⏱ ~2–3 weeks  ⭐ the heart of the app

- [ ] `Video` model: `title, description, status, ownerId, hlsUrl, thumbnailUrl, duration, createdAt`
      — `status`: `uploading → processing → ready → failed`
- [ ] S3/R2 bucket + credentials in `.env`
- [ ] **Upload endpoint** using **pre-signed URLs** (phone uploads straight to storage, not through Node)
- [ ] On upload complete → enqueue a **Bull transcode job**
- [ ] **Transcode worker** (`apps/queue`):
  - [ ] ffmpeg → HLS renditions (360p / 720p / 1080p) + `master.m3u8`
  - [ ] generate a thumbnail (ffmpeg frame grab)
  - [ ] upload segments + playlist to storage
  - [ ] update `Video.status = ready`, set `hlsUrl`
  - [ ] on error → `status = failed`, report to Telegram/Slack
- [ ] **Playback endpoint**: returns the CDN `master.m3u8` URL
- [ ] Flutter:
  - [ ] feed screen (list of `ready` videos, `cached_network_image` thumbnails, BLoC)
  - [ ] player screen with `better_player` (HLS)
  - [ ] upload screen with progress

**Done when:** record/pick a video on the phone → it transcodes → plays back adaptively. Full vertical slice.

---

## Phase 2 — Product features  ⏱ ~2–4 weeks

- [ ] Feed pagination + sorting (newest / popular)
- [ ] Categories / tags
- [ ] Search endpoint
- [ ] Likes + view counts (increment view on playback start)
- [ ] Comments
- [ ] Watch history per user
- [ ] User profiles + their uploaded videos
- [ ] **Admin app**: list / moderate / delete videos, ban users
- [ ] Push notifications on new uploads (Firebase Admin)
- [ ] Rate limiting on write endpoints (`@nestjs/throttler`)

---

## Phase 3 — Scale & polish  ⏱ ongoing

- [ ] **Signed / expiring playback URLs** (stop free hotlinking of your video)
- [ ] Resumable / multipart uploads with retry
- [ ] Watch-time & completion analytics (`apps/cron` nightly rollups)
- [ ] Multiple thumbnail options / video preview scrubbing
- [ ] Content moderation queue before publish
- [ ] CDN cache tuning
- [ ] Load testing (Artillery, like wisdom does)
- [ ] (Only if needed) **Live streaming** — separate system: RTMP ingest + `nginx-rtmp`,
      or a managed service (Mux / Livepeer). Don't build until you actually need it.

---

## Key decisions (make early)

| Decision | Recommendation | Why |
|---|---|---|
| Storage | Cloudflare R2 / DO Spaces | S3 API, **no egress fees** — critical for video |
| Streaming format | **HLS** | Works iOS / Android / web, adaptive bitrate |
| Transcoding | Managed (Cloudflare Stream/Mux) for MVP → self-hosted ffmpeg later | Ship fast with a safety net, own it once you understand it |
| Mobile player | `better_player` | HLS + caching + good controls out of the box |
| Large uploads | Pre-signed URLs, never proxy through Node | Keeps your API server light |

---

## Learning order (as a mobile dev new to backend)

1. NestJS basics: modules, controllers, providers, DI (mirrors Flutter's `get_it`)
2. Mongoose schemas + one CRUD resource end-to-end
3. JWT auth + guards
4. **Bull queues** — the concept that makes video work (async jobs)
5. ffmpeg + S3 — the genuinely new part; lean on managed services first

> When stuck, frame questions to colleagues around **these exact packages** — that's the
> whole point of matching the stack.
