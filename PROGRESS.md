# PROGRESS

**Goal:** phone upload → storage → transcode → HLS → phone plays it. I build every backend piece.

**Phase 0 — Foundations.** Learning order: NestJS basics ✅ → Mongoose CRUD → JWT → Bull → ffmpeg+S3.

## Done

- [x] `nest new` skeleton
- [x] `/health` endpoint via self-contained `HealthModule`
- [x] docker-compose: MongoDB + Redis running (via Colima)
- [x] `@nestjs/config` + `.env` + Joi validation (fail-fast on boot)
- [x] Mongoose connected via `forRootAsync` (URI from ConfigService)

## Next

- [ ] First CRUD resource end-to-end: `User` model  ← **now**
- [ ] Then: JWT auth + guards on top of it
- [ ] Swagger `/docs`
- [ ] Auth (register/login/JWT, bcrypt) + `User` model
- [ ] _(deferred)_ monorepo split — right before Bull, not now

## Learned

- Module = feature package; `imports` = other modules, `controllers`/`providers` = what this module owns.
- DI: Nest injects providers by constructor type — never `new` a service. (≈ get_it / BLoC injection.)
- `@Controller('x')` sets the route prefix; empty = `/` (two empty controllers collide on `GET /`).
- TS is structural: `{ status: string }` needs no class. Annotate boundaries, infer internals.
- Docker = client + daemon: the `docker` CLI talks to an engine over a socket. No daemon = nothing runs. (Colima provides the engine on Mac.)
- Compose: service block `volumes:` mounts a named volume; top-level `volumes:` just declares its name. Ports are `HOST:CONTAINER`.
- Config: `ConfigModule.forRoot()` goes _inside_ `imports:`; `forRoot()` returns a configured module. Joi `validationSchema` = fail-fast on bad/missing env at boot. `.required()` vs `.default()` = mandatory vs optional. `import * as Joi from 'joi'` (CommonJS namespace import).
- `forRoot` = config known now; `forRootAsync` = config computed from other providers at runtime (`imports`/`inject`/`useFactory`).
- Module boundaries: `providers` = services I own (visible only inside me); `imports` = borrow other modules; `exports` = which of my services others may borrow.
