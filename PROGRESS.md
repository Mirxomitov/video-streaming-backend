# PROGRESS

**Goal:** phone upload → storage → transcode → HLS → phone plays it. I build every backend piece.

**Phase 0 — Foundations.** Learning order: NestJS basics ✅ → Mongoose CRUD → JWT → Bull → ffmpeg+S3.

## Done

- [x] `nest new` skeleton
- [x] `/health` endpoint via self-contained `HealthModule`
- [x] docker-compose: MongoDB + Redis running (via Colima)
- [x] `@nestjs/config` + `.env` + Joi validation (fail-fast on boot)
- [x] Mongoose connected via `forRootAsync` (URI from ConfigService)

## Next — Auth plan

Architecture: **feature-based** (everything for a feature in its own folder), not wisdom's central
`models/`. Wisdom centralises schemas because it's a monorepo sharing them across apps; we have one
app. Revisit when we split to `apps/` (schemas then need a shared `libs/`).

```text
src/common/{decorators,enums,guards}   src/health/   src/users/   src/auth/
```

Auth method: **phone + OTP** (Telegram bot later). No passwords → no bcrypt.
For now every OTP is a fixed `DEFAULT_OTP_CODE=123123` from `.env`.
⚠️ Dev only — it's an auth bypass. Before deploy: Telegram sends the real code, and boot must
refuse the default when `NODE_ENV=production`.

### A. User persists ✅

- [x] `user/user.schema.ts` — `phone` (required, unique), snake_case timestamps. No password field.
- [x] `user/user.module.ts` — `MongooseModule.forFeature`, **exports** `UserService`
- [x] `user/user.service.ts` — `@InjectModel`, `find_by_phone`, `find_or_create`
- [x] Register `UserModule` in `app.module.ts`
- [x] Verified: `POST /users` twice → same `_id`; snake_case timestamps in `db.users.find()`

### B. OTP login → JWT ✅

- [x] `JWT_SECRET`, `JWT_EXPIRES_IN`, `DEFAULT_OTP_CODE` in `.env` + Joi
- [x] `LoginDto` + `ValidationPipe({ whitelist: true })` in main.ts (**before** `app.listen`)
- [x] `POST /auth/otp` — stub now, Telegram later
- [x] `POST /auth/login` — verify code vs config → find-or-create user → sign JWT
- [x] `AuthModule` imports `UserModule` — auth talks to `UserService`, never the model directly
- [x] `JwtModule.registerAsync` (same pattern as Mongoose)
- [x] Verified: valid code → token; wrong code → 401; missing field → 400

### C. AuthGuard + `/me` ✅

- [x] `@Public()` decorator (`SetMetadata`) in `common/decorators`
- [x] `auth.guard.ts` implements `CanActivate` → reads token, verifies with `JWT_SECRET`, sets `request.user`
- [x] Registered globally as `APP_GUARD` **in `AuthModule`** (where `JwtService` lives, so DI resolves — not `AppModule`)
- [x] `GET /users/me` reads `req['user'].sub` → `find_by_id`
- [x] Verified: `/users/me` → 401 without token, user doc with token; `@Public()` on auth routes

### Swagger docs ✅

- [x] `@nestjs/swagger` — UI at `/api/docs`
- [x] Protected with `express-basic-auth` (`admin` / `DOCS_PASSWORD`) — gate mounted **before** `SwaggerModule.setup`, same path `/api/docs`
- [x] Verified: no auth → 401, `admin:password` → 200, wrong → 401
- ⚠️ Hardening (Phase 3): boot must fail if `DOCS_PASSWORD` missing (drop the `?? 'changeme'` fallback)

**🎉 Phase 0 complete** — a phone can register, log in, and hit authenticated `/users/me`.

### D. RBAC

- [ ] `role.enum.ts`, `role` prop on schema
- [ ] `@Roles()` decorator + `roles.guard.ts` (runs *after* AuthGuard)
- [ ] Verify: normal user on an admin route → 403 (not 401)

### Then

- [ ] Swagger `/docs`
- [ ] Monorepo split — deferred until right before Bull queues

Deferred on purpose: refresh tokens (wisdom has none), ownership checks (Phase 1, with Video).

## Theory

Homework doc: [THEORY.md](THEORY.md) — TS-vs-Dart, promises, decorators/metadata, DI & modules,
request lifecycle, Mongoose, HTTP codes, config, JWT.

- Read §1–§3 ✅ (quizzed; §3.2 was the miss — `emitDecoratorMetadata` off = app won't boot, not an IDE nag)
- **Next: §4 (DI & modules), then §5 (request lifecycle) before writing the AuthGuard.**
- `await` is structural: it takes anything with `.then()`. Mongoose `Query` is *not* a `Promise`
  subclass — unrelated class, same shape. Dart's `await` is nominal and requires a real `Future`.

Daily startup: `colima start && docker-compose up -d` then `npm run start:dev`.

## Phase 1 — Core loop: upload → transcode → play

Decision: **managed transcoding first** (Mux/Cloudflare Stream) to ship the full slice, then own
ffmpeg later (roadmap key decision; satisfies "wrote every piece" at step 2).

### A. Video model ✅

- [x] `video/enums/video-status.enum.ts` — `uploading → processing → ready → failed`
- [x] `video/video.schema.ts` — `title` (req), `description?`, `status` (enum, default uploading),
      `owner_id` (ObjectId **ref: 'User'**), `hls_url?`, `thumbnail_url?`, `duration?`, snake_case ts
- [x] `video.service.ts` — `create`, `find_ready` (filters `status: READY`), `find_by_id`
- [x] `video.controller.ts` — `POST /videos` (owner from `req.user.sub`, **not** the body),
      `GET /videos` (ready only); `CreateVideoDto` = only `title`/`description`
- [x] Registered `VideoModule` in `app.module.ts`
- [x] **e2e test** (`test/video.e2e-spec.ts`): 401 without token; creates with status uploading +
      owner_id; GET hides non-ready. Test caught real bug → `@Public()` was missing on `/auth/login`.

### Review nits (from mentor pass 2026-08-21)

- [ ] Decide: is `GET /videos` (feed) public? Currently guard-protected → add `@Public()` if browsing shouldn't need login
- [ ] `video.schema.ts`: reuse `COLLECTION_TIMESTAMPS` + `MongooseDocument<Video>` (not inline/`HydratedDocument`); add explicit `collection: 'videos'`
- [ ] Remove dead `AuthGuard` import in `app.module.ts` (it's registered in `AuthModule`)

### Bull queues (stub transcode job)

- [x] `@nestjs/bull` + `bull`; `REDIS_HOST`/`REDIS_PORT` in `.env` + Joi
- [x] `BullModule.forRootAsync` (app.module) = Redis connection, config-driven (like Mongoose `forRootAsync`)
- [x] `BullModule.registerQueue({ name: 'video-transcode' })` in VideoModule (like Mongoose `forFeature`)
- [x] Producer: `VideoService` injects `@InjectQueue`, adds `{ video_id }` job on create — verified in container redis
- [ ] Consumer: `@Processor('video-transcode')` flips `uploading → processing → ready` ← **now**
- [ ] Verify: POST /videos → status ends `ready`; job leaves `:wait`

Redis conflict: brew `redis-server` owns 6379 (auto-starts, like `mongod`) → container remapped `6380:6379`.
`import type { Queue } from 'bull'` — type-only import required under `isolatedModules` + decorated params.

### Next — Upload (managed)

- [ ] Choose Mux vs Cloudflare Stream, create account + creds in `.env` + Joi
- [ ] Direct-upload endpoint (client uploads to the service, not through Node)
- [ ] Bull queue: react to "upload complete" (first real queue)
- [ ] Webhook handler: on `ready` → save playback URL, flip `status`
- [ ] `GET /videos/:id/playback` → returns the HLS URL

## Learned

- Module = feature package; `imports` = other modules, `controllers`/`providers` = what this module owns.
- DI: Nest injects providers by constructor type — never `new` a service. (≈ get_it / BLoC injection.)
- `@Controller('x')` sets the route prefix; empty = `/` (two empty controllers collide on `GET /`).
- TS is structural: `{ status: string }` needs no class. Annotate boundaries, infer internals.
- Docker = client + daemon: the `docker` CLI talks to an engine over a socket. No daemon = nothing runs. (Colima provides the engine on Mac.)
- Compose: service block `volumes:` mounts a named volume; top-level `volumes:` just declares its name. Ports are `HOST:CONTAINER`.
- Config: `ConfigModule.forRoot()` goes *inside* `imports:`; `forRoot()` returns a configured module. Joi `validationSchema` = fail-fast on bad/missing env at boot. `.required()` vs `.default()` = mandatory vs optional. `import * as Joi from 'joi'` (CommonJS namespace import).
- `forRoot` = config known now; `forRootAsync` = config computed from other providers at runtime (`imports`/`inject`/`useFactory`).
- Module boundaries: `providers` = services I own (visible only inside me); `imports` = borrow other modules; `exports` = which of my services others may borrow.
- Schema config must match the document type: `timestamps: true` writes `createdAt`, but `MongooseDocument<T>` types it as `created_at` — pass `COLLECTION_TIMESTAMPS` so both agree, or the type lies and the field is `undefined` at runtime.
- `phone!: string` — definite assignment assertion. Mongoose hydrates the class at runtime, so TS can't see the assignment (ts2564).
- Forgetting `await` on `findOne()` gives a truthy `Query` object, not a document — so `if (!user)` never fires. Same trap as holding a Dart `Future` instead of its value.
- Infra sanity-check: an impossible error (auth required on a no-auth DB) means you're talking to a different server. `lsof -nP -iTCP:<port> -sTCP:LISTEN` before debugging code. Colima doesn't survive reboots; a brew `mongod` owns 27017, so our container maps `27018:27017`.
- TS has no named arguments — `new Foo(message: 'x')` is Dart reflex and a syntax error. Pass positionally, or an object literal.
- Config in `main.ts` (`useGlobalPipes`) must come **before** `app.listen()`.
- `expiresIn` wants a template-literal type (`'7d'`), not plain `string` — assert with `as SignOptions['expiresIn']` rather than hardcoding.
- AuthN (401, *who are you*) vs AuthZ (403, *are you allowed*). JWT is **signed, not encrypted** — payload is public, never put secrets in it. Roles don't check ownership; the service must.
