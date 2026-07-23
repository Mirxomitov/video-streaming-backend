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

### B. OTP login → JWT ← now

- [ ] `JWT_SECRET`, `JWT_EXPIRES_IN`, `DEFAULT_OTP_CODE` in `.env` + Joi
- [ ] DTOs (`@IsPhoneNumber`) + `ValidationPipe({ whitelist: true })` in main.ts
- [ ] `POST /auth/otp` — stub now, Telegram later
- [ ] `POST /auth/login` — verify code vs config → find-or-create user → sign JWT
- [ ] `AuthModule` imports `UsersModule` — auth talks to `UsersService`, never the model directly
- [ ] `JwtModule.registerAsync` (same pattern as Mongoose)
- [ ] Verify: curl login → paste token into jwt.io; user row created in Mongo

### C. AuthGuard + `/me` ⭐ Phase 0 done

- [ ] `@Public()` decorator (`SetMetadata`)
- [ ] `auth.guard.ts` implements `CanActivate` → sets `request.user`
- [ ] Register globally as `APP_GUARD` (secure by default, opt out with `@Public`)
- [ ] Verify: `/me` → 401 without token, user with token

### D. RBAC

- [ ] `role.enum.ts`, `role` prop on schema
- [ ] `@Roles()` decorator + `roles.guard.ts` (runs *after* AuthGuard)
- [ ] Verify: normal user on an admin route → 403 (not 401)

### Then

- [ ] Swagger `/docs`
- [ ] Monorepo split — deferred until right before Bull queues

Deferred on purpose: refresh tokens (wisdom has none), ownership checks (Phase 1, with Video).

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
- AuthN (401, *who are you*) vs AuthZ (403, *are you allowed*). JWT is **signed, not encrypted** — payload is public, never put secrets in it. Roles don't check ownership; the service must.
