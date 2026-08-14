# THEORY — homework

Targeted at the gaps that actually showed up while building this project. Skips what you already
know as a senior mobile dev (HTTP, JSON, async *concepts*, architecture, git).

Work through it in order. Each section ends with **Check yourself** — answer out loud before
moving on. Where it says **Try it**, actually run the thing; the error messages are the lesson.

---

## 1. TypeScript for a Dart developer

You know OOP and static types. These are the places TS differs from Dart in ways that already bit you.

### 1.1 No named arguments

You wrote this and it was a syntax error:

```ts
throw new UnauthorizedException(message: 'wrong')   // ❌ Dart reflex
```

TS/JS has **positional arguments only**. The idiom that replaces named args is an **object literal**:

```ts
function create_user({ phone, full_name }: { phone: string; full_name?: string }) {}
create_user({ phone: '+998...', full_name: 'Tohir' })    // reads like named args
```

That destructuring-an-object-parameter pattern is everywhere in Node. Learn to read it.

### 1.2 Structural typing (this is the big mental shift)

Dart is **nominal**: a value is a `User` only if it was declared as one.
TS is **structural**: a type is just a *shape*, and anything with that shape fits.

```ts
type HasPhone = { phone: string }

const a: HasPhone = { phone: '+1' }                  // ✅
const b: HasPhone = { phone: '+1', extra: true }     // ❌ excess property check on a fresh literal

const raw = { phone: '+1', extra: true }
const c: HasPhone = raw                              // ✅ extra fields fine once it's a variable
```

That asymmetry is deliberate: structurally the extra field is harmless, but a **fresh object
literal** with unknown keys is almost always a typo, so TS guards that one case.

Consequences you'll feel:
- You rarely write model classes just to move data around — object literals are enough.
- `interface` and `type` are mostly interchangeable for object shapes.
- Two unrelated classes with identical fields are **mutually assignable**. There's no "identity."

### 1.3 `var` / `let` / `const`

You used `var` twice. Don't.

| | Scope | Use |
|---|---|---|
| `var` | function-scoped, hoisted | **never** — legacy, surprising |
| `let` | block-scoped | when you reassign the binding |
| `const` | block-scoped, no reassign | **default** |

`const` prevents *reassignment*, not *mutation* — `const u = {}; u.x = 1` is legal. It's Dart's
`final`, not `const`.

### 1.4 Type assertions

```ts
config.get<string>('JWT_EXPIRES_IN') as SignOptions['expiresIn']
```

Two things here:
- **`as`** = "trust me, compiler." No runtime check happens. It's an escape hatch, not a conversion.
  Dart's `as` *does* check at runtime and throws. TS's does nothing. Use sparingly.
- **`SignOptions['expiresIn']`** = indexed access type — "the type of that property." Reusing a
  library's type beats hardcoding it; if the library changes, you follow automatically.

You needed the assertion because `expiresIn` isn't `string` — it's a **template literal type**
accepting only `'7d'`-shaped strings. TS can constrain string *formats*, not just types.

### 1.5 `strictNullChecks` and `!`

Your [tsconfig.json](tsconfig.json) has `strictNullChecks: true` — so `string` and `string | null`
are different types, like Dart's null safety. Same mental model.

`phone!: string` is the **definite assignment assertion**: "I know nothing in this file assigns it,
but something will." You needed it because Mongoose hydrates schema classes at runtime.
Dart's equivalent is `late String phone`.

There is also the **non-null assertion** on *expressions* — `user!.phone` — meaning "this isn't
null, trust me." Same character, different job. Both are you overriding the compiler; be sure.

### Check yourself
1. Why does `const user = { phone: '+1' }` satisfy a parameter typed `{ phone: string }` with no class involved?
2. What's the difference between Dart's `as` and TypeScript's `as` at runtime?
3. When would you write `let` instead of `const`?

---

## 2. Promises — where your `await` bug came from

You know `Future`/`async`/`await` from Dart. The concepts map 1:1. What bit you was **Mongoose**,
not async itself — but it's worth being precise about why.

### 2.1 A Promise is an object

```ts
const p = fetch_user()        // p is a Promise<User>, an OBJECT — always truthy
const u = await fetch_user()  // u is a User (or null)
```

Your bug:

```ts
const user = this.user_model.findOne({ phone })   // ❌ no await
if (!user) { /* NEVER runs — a Query object is truthy */ }
```

Identical to holding a Dart `Future<User>` and checking `if (user == null)`. The Future isn't null.

### 2.2 Why TypeScript didn't catch it

Because `if (!someObject)` is *legal*. The compiler has no idea you meant to await.

**Fix this properly:** enable the ESLint rule `@typescript-eslint/no-floating-promises` and
`no-misused-promises`. They catch exactly this class of bug. Worth doing before Phase 1.

### 2.3 Thenables — the Mongoose wrinkle

`findOne()` doesn't return a `Promise`. It returns a **`Query`** object that is *thenable* — it has
a `.then()` method, so `await` works on it. But it's **lazy**: the DB isn't hit until you await it
(or call `.exec()`).

A **thenable** is any object with a `.then()` method. `await` doesn't require a real `Promise` — it
accepts anything thenable. Mongoose exploits this so a Query can stay a *builder*:

```ts
const q = this.user_model.findOne({ phone })    // nothing has hit the DB yet
q.select('+password').sort({ created_at: -1 })  // still nothing — just building
await q                                         // ← NOW it runs
```

Returning a real Promise would fire the query immediately and kill chaining. So you get
`.select()`/`.sort()`/`.populate()` **and** plain `await`, with no `.exec()` ceremony.

That's why `return this.user_model.findOne({ phone })` from an `async` function still works — the
caller's `await` resolves it. But `if (!query)` operates on the Query object, not the result.

Rule of thumb: **await Mongoose queries at the point you need the value.**

### 2.4 Sequential vs parallel

```ts
const a = await one()          // these run one after the other
const b = await two()

const [a, b] = await Promise.all([one(), two()])   // concurrent
```

Same as Dart's `Future.wait`. Matters once you're doing several independent DB reads per request.

### Check yourself
1. Why is `if (!this.user_model.findOne({...}))` always false?
2. What does "thenable" mean and why does Mongoose use it?
3. Two independent DB lookups in one request — how do you run them concurrently?

**Try it:** add `console.log(this.user_model.findOne({ phone }))` to `find_by_phone` and look at
what actually prints. It's not a user.

---

## 3. Decorators and metadata — how Nest actually works

This is the machinery behind every `@Something` you've written. Understanding it turns Nest from
magic into plumbing.

### 3.1 A decorator is a function

```ts
@Injectable()
export class UserService {}
```

`@Injectable()` is a **function call** that runs at class-definition time and attaches metadata to
the class. It doesn't change behaviour by itself. Nest reads that metadata later.

Same for `@Controller('users')`, `@Post()`, `@Body()`, `@Prop()`, `@IsString()`.

### 3.2 `emitDecoratorMetadata` is the secret ingredient

Normally TS types are erased at compile time — they don't exist at runtime. So how does this work?

```ts
constructor(private readonly user_service: UserService) {}
```

Because [tsconfig.json](tsconfig.json) sets:

```json
"emitDecoratorMetadata": true,
"experimentalDecorators": true
```

TS emits the *parameter types* into the compiled JS as metadata (via `reflect-metadata`, which is
why it's imported in [main.ts](src/main.ts)). Nest reads `design:paramtypes`, sees `UserService`,
and looks up the matching provider.

**This is why DI-by-type works at all**, and why every NestJS tsconfig has those two flags.

Turn `emitDecoratorMetadata` off and the app **fails to boot** — this is not an IDE nicety. Types
are erased at compile time; the emitted JS is just `constructor(user_service) {}`, with the word
`UserService` gone. Nest asks for `design:paramtypes`, gets `undefined`, and throws
`Nest can't resolve dependencies of the UserController (?)`. That flag is load-bearing.

### 3.3 Writing your own

```ts
export const IS_PUBLIC_KEY = 'is_public'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
```

`SetMetadata` attaches a key/value to a route handler. A guard later reads it with `Reflector`.
That's the entire `@Public()` mechanism — a labelled sticky note, plus something that reads notes.

You'll write this in Milestone C.

### Check yourself
1. What does `@Injectable()` actually *do* to the class?
2. If you set `emitDecoratorMetadata: false`, what breaks and why?
3. How does a guard find out that a route was marked `@Public()`?

---

## 4. Dependency injection and modules

The part you asked about. Nail this and Nest stops surprising you.

### 4.1 The wall metaphor

A **module is a wall.**

| Key | Meaning |
|---|---|
| `providers` | Things this module **owns**. Instantiated once. Visible **only inside** the wall. |
| `exports` | The **doors** — which of my providers others may use. |
| `imports` | Other **walls** I stand next to and borrow from (I get their exports only). |
| `controllers` | HTTP entry points this module owns. |

Your [user.module.ts](src/user/user.module.ts) → [auth.module.ts](src/auth/auth.module.ts)
relationship is exactly this: `UserModule` exports `UserService`, `AuthModule` imports `UserModule`.

### 4.2 Providers are singletons

One instance per application, shared by everyone who imports the module. `get_it`'s
`registerLazySingleton`, not `registerFactory`.

Your `AuthService` and `UserController` hold **the same `UserService` object in memory**.

### 4.3 The graph is built and validated at boot

Nest resolves the whole dependency graph on startup. A missing wire fails **immediately**, with a
message naming the exact position:

```
Nest can't resolve dependencies of the AuthService (ConfigService, JwtService, ?).
Please make sure that the argument UserService at index [2] is available in the AuthModule context.
```

Read that as: *"the 3rd constructor parameter of AuthService can't be found from where AuthModule
stands."* Fix is always one of: add to `providers`, `export` it, or `import` its module.

### 4.4 Dynamic modules: `forRoot` / `forRootAsync` / `forFeature`

A **dynamic module** is a module configured by arguments. The method *returns* a configured module.

| Call | Job |
|---|---|
| `forRoot(opts)` | Configure with values known **now**. Once, app-wide. |
| `forRootAsync({ imports, inject, useFactory })` | Configure with values computed **at runtime** from other providers. |
| `forFeature([...])` | Register **per-feature** resources (one model) in **this** module. |

For Mongoose specifically:
- `forRootAsync` opens the **connection** (the socket pool to Mongo). Knows nothing about schemas.
- `forFeature` binds a **model** (`User` class + schema ↔ `users` collection) so `@InjectModel`
  resolves *inside that module*.

Connection is the pipe; models are typed accessors on it. You need both.

### 4.5 `useFactory` and `inject`

```ts
JwtModule.registerAsync({
  imports: [ConfigModule],     // make providers available to the factory (redundant if global)
  inject: [ConfigService],     // ← what gets passed to the factory, in order
  useFactory: (config: ConfigService) => ({ secret: config.get('JWT_SECRET') }),
})
```

`inject[0]` → factory parameter 0. That's the whole contract. `inject` is the line that matters.

### 4.6 `isGlobal`

`ConfigModule.forRoot({ isGlobal: true })` registers `ConfigService` app-wide, so you don't repeat
`imports: [ConfigModule]` in every module. Use sparingly — global providers hide dependencies.
Config and logging are the usual legitimate cases.

### Check yourself
1. Delete `exports: [UserService]` from [user.module.ts](src/user/user.module.ts) and boot. Read the error. Put it back.
2. Why does `forFeature` exist per-module instead of registering all models globally?
3. Your `AuthService` and `UserController` both use `UserService` — same instance or two?

---

## 5. The request lifecycle

What happens between `curl` and your controller method. You've met pipes; guards are next.

```
Request
   ↓
Middleware
   ↓
Guards            ← "may this request proceed?"   → throws 401/403
   ↓
Interceptors (before)
   ↓
Pipes             ← validate + transform the body → throws 400
   ↓
CONTROLLER METHOD
   ↓
Interceptors (after)   ← transform the response
   ↓
Exception filters      ← turn thrown errors into HTTP responses
   ↓
Response
```

Mapping to what you've built and what's next:

| Piece | Yours | Mobile analogy |
|---|---|---|
| **Guard** | `AuthGuard` (Milestone C) | route guard |
| **Pipe** | `ValidationPipe` in [main.ts](src/main.ts) | form validation |
| **Interceptor** | not yet | dio interceptor |
| **Exception filter** | Nest's default | global error handler |

Two things to internalise:

- **Guards run before pipes.** Authentication is checked before the body is validated — you don't
  waste work parsing a request from someone who isn't logged in.
- **Throwing is the idiom.** `throw new UnauthorizedException()` becomes a 401 JSON response. You
  never build error responses by hand; an exception filter does it. That's why your `auth.service`
  throws instead of returning an error object.

### Scope

Guards/pipes can be applied at **method**, **controller**, or **global** level. Global via `APP_GUARD`:

```ts
providers: [{ provide: APP_GUARD, useClass: AuthGuard }]
```

**Secure by default, opt out with `@Public()`** — better than opt-in protection, because the
endpoint you add next month is protected whether or not you remember.

### Check yourself
1. Request with a bad body AND no token — which error do you get, 400 or 401? Why?
2. Why throw exceptions instead of returning `{ error: ... }`?
3. What's the risk of opt-in (`@Auth()` on each route) vs opt-out (`@Public()`)?

---

## 6. Mongoose

### 6.1 Schema vs Model vs Document

| | What it is |
|---|---|
| **Schema** | The shape + rules. `UserSchema`. No DB access. |
| **Model** | The class you query with. `Model<UserDocument>` — bound to the `users` collection. |
| **Document** | One instance/row you get back. Has `.save()`, `._id`, virtuals. |

Your [user.schema.ts](src/user/user.schema.ts) defines the schema; `@InjectModel` gives you the
model; `find_by_phone` returns a document.

### 6.2 `_id` and `id`

Every document gets an `_id` (an `ObjectId`, not a string). Mongoose also adds a virtual **`id`**
that's the string form. `user.id` and `String(user._id)` are the same value.

### 6.3 Indexes

`@Prop({ unique: true })` creates a **unique index** in MongoDB — enforced by the database, not
your code. This is why your `find_or_create` race isn't a disaster: two simultaneous inserts of the
same phone → the second fails with duplicate-key error `code: 11000`.

**The lesson: the database is your last line of defence against races your code can't see.**
Indexes are also *the* performance tool — a query without one scans every document.

### 6.4 `select: false`

Field is excluded from query results by default; you must ask for it (`.select('+password')`).
Built for exactly one purpose: making it hard to leak secrets accidentally. You don't need it now
(no passwords), but you'll see it in wisdom's schemas.

### 6.5 Lean queries

`.lean()` returns a plain JS object instead of a full document — faster, no `.save()`. Use for
read-only endpoints once you care about performance.

### Check yourself
1. Difference between the schema, the model, and a document?
2. Two requests create the same phone simultaneously — what stops a duplicate, and what error appears?
3. When would you use `.lean()`?

---

## 7. HTTP semantics you'll be judged on

You know HTTP. These are the API-design conventions worth being deliberate about.

| Code | Meaning | In your app |
|---|---|---|
| **200** | OK | successful GET |
| **201** | Created | `POST /users` created a user (Nest does this automatically for `@Post`) |
| **400** | Bad Request | DTO validation failed |
| **401** | Unauthenticated | no/invalid token — *who are you?* |
| **403** | Forbidden | valid token, insufficient rights — *not allowed* |
| **404** | Not Found | no such video |
| **409** | Conflict | duplicate — e.g. that unique-index violation |
| **500** | Server error | you have a bug |

**401 vs 403 is the one people get wrong.** 401 = I don't know you. 403 = I know exactly who you
are, and no.

### Don't leak information

Your `send_otp` returns `{ ok: true }` regardless of whether the phone exists. If it returned
"user not found," anyone could enumerate which numbers have accounts. Auth endpoints should be
deliberately vague.

### Check yourself
1. Login with a wrong OTP — 401 or 403? Why?
2. Registering a phone that already exists — which code?
3. Why shouldn't login say "no account with that phone"?

---

## 8. Config and secrets

The **12-factor** idea: config lives in the environment, not in code, because it differs per
environment and must not be committed.

What you built:
- `.env` — real values, **gitignored**
- `.env.example` — the keys with empty values, **committed** (documentation of what's needed)
- Joi `validationSchema` — **fail fast**: refuse to boot on missing/invalid config rather than
  dying on the first request that needs it

**Rules to carry forward:**
- A new config value means: `.env`, `.env.example`, *and* the Joi schema. All three, always.
- Never log secrets. Never put them in a JWT payload.
- `JWT_SECRET` is the crown jewel — anyone with it can forge a token for any user.
- Dev shortcuts like `DEFAULT_OTP_CODE=123123` must be impossible in production. Before deploy:
  make the app refuse to start with a default OTP when `NODE_ENV=production`.

### Check yourself
1. Why commit `.env.example` but never `.env`?
2. What does Joi validation buy you over reading `process.env` directly?
3. What can someone do with a leaked `JWT_SECRET`?

---

## 9. JWT recap

- Three base64 parts: `header.payload.signature`.
- **Signed, not encrypted.** Anyone can read the payload — you decoded your own with `base64`.
  Never put anything secret in it.
- The signature proves it wasn't **modified**, using `JWT_SECRET`.
- **Stateless**: the server verifies the signature instead of looking up a session. No DB hit for
  auth itself (though your guard *will* load the user, which is a DB hit — a deliberate tradeoff
  so a deleted/banned user can't keep using a valid token).
- `sub` = subject = who the token is about. `iat` = issued at. `exp` = expiry.
- **A JWT can't be revoked** — it's valid until it expires. That's the tradeoff for statelessness,
  and the reason short-lived access tokens + revocable refresh tokens exist. We deliberately
  skipped refresh tokens (wisdom doesn't use them either).

### Check yourself
1. Someone steals a user's token. What can you do about it right now? What would refresh tokens change?
2. Why does the guard load the user from the DB when the token already contains the user id?

---

## Order to study

1. **§4 (DI/modules)** and **§2 (promises)** — highest value, both bit you already.
2. **§5 (lifecycle)** — read before Milestone C, it's exactly what you're about to build.
3. **§3 (decorators)** — the "how does this work at all" section.
4. §1, §6, §7, §8, §9 — reference; skim now, return when relevant.

**The real homework:** do every **Try it** and the boot-error experiment in §4. Breaking it on
purpose and reading the error teaches more than the prose does.
