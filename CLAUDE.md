# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Dev server (--webpack flag; Turbopack is NOT used)
npm run build            # Production build (also --webpack)
npm run lint             # ESLint

# Database (Prisma + PostgreSQL, needs the vector + pg_trgm extensions)
npm run db:generate      # Regenerate Prisma Client after schema changes
npm run db:push          # Sync schema to DB (no migration history) — the usual dev flow
npm run db:migrate       # prisma migrate dev (for production migrations)
npm run db:seed          # Seed admin user, platforms, service types, categories, locations
npm run db:studio        # Prisma Studio
npm run db:backup        # pg_dump wrapper (scripts/backup-db.js)
npm run db:restore       # restore from a backup file
npm run db:export        # dump DB to SQL inserts via Prisma (scripts/export-database.ts)

npm run email:preview    # Render the Resend templates locally
```

Prisma's CLI only reads `.env`, **not** `.env.local` — keep everything in `.env` (see `.env.example`).

One-off data scripts live in `scripts/` and run through `tsx` or `ts-node`:

```bash
npx tsx scripts/migrate-locations.ts
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/update-currency.ts
```

There is no test suite in this repo.

## Architecture

Influencer/UGC creator management platform for an agency: staff build campaigns from a roster of creators, send them to the client for per-service approval, and take inbound briefs from a public form. Next.js 16 (App Router, React 19, `cacheComponents: true`), Prisma/PostgreSQL, NextAuth v5 beta. UI language is Spanish; code comments are mixed Spanish/English.

### Layers — where code is supposed to live

This repo was deliberately refactored into layers; adding Prisma calls or `fetch()` inline will break the pattern.

**Server side:** `src/app/**/route.ts` and server pages → `src/data-access/*` → Prisma. Route handlers do auth + validation + response shaping only; **all Prisma queries belong in `src/data-access/`** (barrel-exported from `src/data-access/index.ts`). Data-access functions throw `ValidationError` / `NotFoundError` (`src/data-access/errors.ts`) and routes map those to 400/404.

**Client side:** components → `src/hooks/queries/*` and `src/hooks/mutations/*` (TanStack Query) → `src/services/*` → `src/services/api.ts` (`apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete`, throwing `ApiError`). Query keys are centralized in `src/lib/query-keys.ts` — use them, don't inline key arrays.

Supporting directories: `src/lib/schemas/*` (zod, one file per entity), `src/models/*` (shared TS types consumed by both sides), `src/stores/*` (zustand), `src/contexts/*`, `src/reducers/*` (the profile filter reducer).

`src/lib/cache.ts` is now only a re-export shim pointing at `src/data-access/` — prefer importing from `@/data-access` directly.

### Caching is the Next 16 `"use cache"` API, not `unstable_cache`

Cached reads live in `src/data-access/` and open with:

```ts
"use cache";
cacheLife("hours");
cacheTag("profiles");          // getCachedProfile also tags `profile-${id}`
```

Tags in use: `profiles`, `profile-<id>`, `categories`, `platforms`, `service-types`, `genders`, `countries`, `departments`, `cities`, `reach-ranges`.

Invalidation uses Next 16's two-arg form, `revalidateTag("profiles", "hours")` — the second argument must match the `cacheLife` profile of the cached function.

**Gotchas that are live right now:**
- Only `profiles`, `categories`, and `reach-ranges` are ever revalidated. The admin CRUD for **platforms, service types, locations, and genders never calls `revalidateTag`**, so those edits take up to an hour to show up in forms and filters.
- `src/app/api/campaigns/[id]/markup/route.ts` calls `revalidateTag("campaigns", "hours")`, but nothing tags `campaigns` — campaign reads in `src/data-access/campaigns.ts` are uncached, so that call does nothing.

Because `"use cache"` functions can't read the session, anything session-dependent must be passed in as an argument (and thereby becomes part of the cache key).

### Data model shape (the part that trips people up)

`Profile` → `SocialAccount` (one per platform, `@@unique([profileId, platformId])`) → `ProfileService` (price per service type).

**Pricing hangs off `SocialAccount`, not `Profile`.** A `ProfileService` is unique per `[socialAccountId, serviceTypeId]`, so the same service on Instagram and TikTok are two separate rows. Any query touching prices must nest through `socialAccounts.services`. Prices are `Decimal(10,2)` and are **serialized to strings** before crossing to the client (`serializeProfile` in `src/data-access/profiles.ts`) — `ProfileWithRelations` types `price` as `string`.

`ServiceType` is scoped by `platformId` **and** a `profileTypes: ProfileType[]` array. That array is read in exactly one place — `getAvailableServices()` in `src/components/forms/profile-form.tsx` — and the rule is not what the seed's shape suggests:

```js
if (type === "BOTH") return true;        // sees every service on the platform
return st.profileTypes.includes(type);   // only INFLUENCER / UGC actually filter
```

A `BOTH` profile therefore sees everything on the platform whatever `profileTypes` says; the seed's `[INFLUENCER, BOTH]` / `[UGC, BOTH]` duplication is convention, not a requirement. **Nothing enforces it server-side** — that client-side filter is the only consumer of the field.

Location is a three-level chain `Country → Department → City`, all optional on `Profile`. `ReachRange` (nano/micro/mid/macro/mega) is a lookup table with a `reachPercentage` used for estimated-reach math.

`SocialAccount` used to carry AI columns — `embedding vector(1536)`, `aiSummary`, `aiMetadata` — filled by a pipeline that never ran. Both were removed (`20260819220000_eliminar_columnas_ia`), so **the table holds only Apify metrics now.** The `vector` and `pg_trgm` extensions stay declared in `schema.prisma` and created by the init migration even though nothing uses them: retiring them would mean editing that first migration, so a fresh database still needs a PostgreSQL image that ships pgvector.

**Campaigns and clients cannot be deleted from the app.** There is no `DELETE` endpoint and no UI for either — removing them is a deliberate database operation, because a campaign is commercial history (what was contracted, at what price, with which markup, and who approved it) and a client drags its contacts and portal access with it. `Campaign.clientId` is `ON DELETE RESTRICT`, so the database refuses to drop a client that still has campaigns. Profiles and categories *can* still be deleted from the app, and those deletions are audited.

Cascade deletes: `Profile` → `SocialAccount` → `ProfileService`; `Client` → `ClientContact`/`ClientUser`; `Campaign` → `CampaignProfile` → `CampaignProfilePlatform` → `CampaignService`, plus `CampaignApprovalToken`. `ServiceType`, `SocialPlatform`, `Category`, and the location tables are never cascaded (deleting them requires clearing references first).

### Campaigns are four levels deep, and approval happens at three of them

`Campaign` → `CampaignProfile` (one creator) → `CampaignProfilePlatform` (that creator's Instagram *or* TikTok) → `CampaignService` (a service + quantity + `basePrice`).

The client approves at every level: `CampaignProfile.status` and `CampaignProfilePlatform.status` are `CampaignProfileStatus` (PENDING/APPROVED/REJECTED), while `CampaignService` uses a boolean `isApproved` plus `clientNotes`/`rejectionReason`. When touching approval logic, remember all three exist and can disagree.

Status flow is `DRAFT → REVIEW → PENDING/ACTIVE → COMPLETED/CANCELLED`; the allowed transitions are declared in `USER_VALID_TRANSITIONS` in `src/lib/campaign-utils.ts` and enforced by `transitionCampaignStatus` in `src/data-access/campaigns.ts`.

**Prices shown to clients carry a 20% markup.** `MARKUP_PERCENTAGE` / `calculateMarkupPrice()` in `src/lib/campaign-utils.ts` — `ProfileService.price` is the base cost, and the cart store applies the markup before displaying anything.

### Public (unauthenticated) surfaces

Three flows deliberately run with no session, all under `/api/public/*`:

1. **`/brief`** — long public intake form writing to `CampaignBrief`, a wide staging table with almost everything optional. Staff review it at `/briefs` and `convertirBriefACampana()` (`src/services/brief-conversion.ts`) turns it into a real `Campaign`. Attachments upload **directly from the browser to Vercel Blob** via `POST /api/public/brief/upload` (`handleUpload`), because Vercel's 4.5 MB request-body cap makes a normal multipart POST fail with 413; the route's protection is the token scope (`briefs/` prefix, allowed MIME types, max size), not a session.
2. **`/approve/[token]`** — the client approval portal, authorized by a `CampaignApprovalToken` (unique, `expiresAt`, single-use `usedAt`). `GET /api/public/approve/[token]` maps `EXPIRED_TOKEN`/`USED_TOKEN`/`INVALID_STATUS` to 410/400 with a `code` field the UI switches on.
3. **`/client-login`** — the entry point of the client portal. The login endpoint itself is public; everything behind it is not. See below.

### The client portal is a second, independent session system

`ClientUser` is not a `User`: no role, no access to `(app)`, sees only its own data. It deliberately does **not** go through NextAuth — folding it in would force the staff session to carry two kinds of subject.

- `src/lib/client-session.ts` signs and verifies an `HS256` JWT (via `jose`) with issuer `influencer-manager` and audience `client-portal`, using `NEXTAUTH_SECRET`. It is imported by the middleware, so it runs on **Edge — never import Prisma or bcryptjs into it**.
- `POST /api/client-auth/login` sets the `client-session` httpOnly cookie; `POST /api/client-auth/logout` overwrites it with `maxAge: 0` (matching options exactly, or the browser keeps the original).
- `/client-dashboard` is in the `src/middleware.ts` matcher and handled by a dedicated branch in `authorized` (`RUTA_CLIENTE`) that redirects to `/client-login`, not `/login`. The page re-verifies because that is where `clientId` comes from.
- `getCampaignsForClientPortal(clientId)` filters by `clientId` and excludes `DRAFT`. **That filter is the only thing separating one client's data from another's** — `clientId` must always come from the signed cookie, never from the request.

Rotating `NEXTAUTH_SECRET` invalidates client sessions too, not just staff ones.

### Route protection

`src/middleware.ts` runs NextAuth on a matcher covering `/dashboard`, `/admin`, `/api/admin`, `/profiles`, `/clients`, `/campaigns`, `/categories`, `/briefs`, `/login`, `/register`. The actual decision is the `authorized` callback in `src/lib/auth.config.ts`, which checks `RUTAS_PRIVADAS` **by full segment** (`pathname === ruta || pathname.startsWith(ruta + "/")`) — that is what keeps the public `/brief` from being swallowed by the private `/briefs`. Admin paths additionally require `role === "ADMIN"` and redirect to `/dashboard`.

Middleware matcher and `RUTAS_PRIVADAS` must be kept in sync: **a path missing from the matcher never reaches the callback at all.** With `cacheComponents` on, a layout-level redirect inside `<Suspense>` is not enough — page content still streams to the client — which is why protection moved into middleware. Server layouts still re-check (`src/app/(app)/admin/layout.tsx` redirects non-admins).

Note `src/app/admin/emails/preview` sits **outside** the `(app)` group, so it does its own `auth()` + role check inline after `await connection()`.

### Access control is inconsistent by design gap, not by intent

- `/api/profiles` GET filters by `createdById` for non-admins.
- `getCachedProfiles(userId, isAdmin, filters)` — used by the `/profiles` page — **accepts those two arguments and ignores them**; the leading `{}` in its `AND` array is where the ownership filter used to be, so every user sees every profile.
- Profile mutations check `role === "ADMIN" || createdById === session.user.id`.
- `/api/admin/*` and `/api/clients/[id]/access` require `ADMIN`.

When changing visibility rules, change both the cached read and the API route or they will disagree.

### Apify sync

`src/lib/apify.ts` — actors `apify/instagram-profile-scraper`, `clockworks/tiktok-profile-scraper`, `streamers/youtube-channel-scraper` and `aitooolsmax/kick-data-scraper` (Kick needs an actor because kick.com's public API answers 403 to server requests — Cloudflare). `syncSocialAccountMetrics(platform, username)` normalizes both into `SocialAccount` field names and **uploads the profile picture to Vercel Blob** (`put()`), storing the returned URL in `profilePicUrl`. `next.config.ts` allowlists `*.public.blob.vercel-storage.com` for `next/image`.

Sync runs inline during `POST /api/profiles` (per account, errors swallowed so creation still succeeds) and on demand via `POST /api/profiles/[id]/sync`. Dispatch is by lowercased `platform.name` — a platform whose name isn't `instagram`/`tiktok`/`youtube`/`kick` is silently skipped.

**Usernames are stored normalized.** `normalizarUsuarioSocial()` in `src/lib/social-handles.ts` accepts the bare handle, `@handle` or a pasted profile URL and stores the handle alone. `normalizarCuentas()` in `src/data-access/profiles.ts` applies it on both create and update — the single gate every write passes through, so no route or form can bypass it. This matters beyond Apify: the stored value also builds the profile links the client sees in the approval portal. YouTube channels pasted as `/channel/UC…` keep the id, and `getYouTubeProfile` builds `/channel/` instead of `/@` for those.

The YouTube actor returns **one row per video**, each repeating the channel info, so `getYouTubeProfile` reads the profile from the first item and averages `viewCount` across the rest — `YOUTUBE_VIDEOS_PARA_MEDIA` caps how many are fetched, since every extra video costs Apify credit. It exposes no likes, so `avgLikes` and `engagementRate` stay null for YouTube rather than being filled with a computed proxy that would sit next to Instagram's real engagement rate in the same filters.

### AI prospect search (`/busqueda-ia`) — the only AI in the app

Campaigns, clients and profiles are built by hand, deliberately: an AI campaign assistant existed under `/api/chat/campaign` and was removed, because creating commercial records from a chat transcript was never wanted. If you are about to add a second AI surface, that is the decision you are reversing.

Finds creators who are **not yet in the database**, from a phrase in natural language. Three stages in `src/app/api/busqueda-ia/route.ts`:

1. `extraerCriterios()` (`src/lib/ai-busqueda.ts`) turns the phrase into `CriteriosBusqueda` — keyword queries plus follower range, place, category — as strict JSON, no tool loop.
2. `buscarProspectosTikTok()` (`src/lib/apify.ts`) runs `clockworks/tiktok-user-search-scraper` on those queries and dedupes by username.
3. The **follower range is filtered in code**, not by the model, and `valorarProspectos()` only judges what a keyword search can't: whether bio and name really match the niche. If that call fails it returns an empty map and everything is shown rather than nothing.

Two properties worth keeping: **the model never invents accounts** — every result comes from Apify — and Apify searches by keyword, not by meaning, so the noise is high and the AI pass is what makes the list usable.

Only TikTok is in `PLATAFORMAS_BUSCABLES`; the other platforms have profile scrapers but no usable discovery actor, and the route answers with an `aviso` instead of failing. Anthropic failures are translated by `ErrorIA` — the raw API error is never sent to the browser.

Results link to `/profiles/new?nombre=&usuario=&plataforma=`, which feeds `ProfileForm`'s `prefill` prop. `prefill` is **not** `initialData`: that one means "editing" and switches the mutation to update.

Each search costs Apify credit (up to 3 queries × 10 profiles) plus two Haiku calls.

### Email

`src/lib/emails/resend.ts` — `sendEmail()` is a **no-op unless `ENABLE_EMAILS === "true"`**, and warns-and-returns when `RESEND_API_KEY` is missing. Templates are plain HTML string builders in `templates.ts`, wrapped by `campaign-notifications.ts` / `brief-notifications.ts`.

## Key patterns

### Forms are mixed — match the neighbours, don't unify

- `src/components/forms/create-*.tsx` (category, city, country, department, platform, user) use **react-hook-form + zodResolver + `src/components/ui/form.tsx`**.
- `profile-form.tsx`, `client-form.tsx`, `campaign-form.tsx`, and the create-service-type / create-reach-range forms are plain `useState` + TanStack Query mutation hooks.

Both styles submit through `src/hooks/mutations/*`. Follow whichever style the file you are editing already uses.

Prices flow as **digit-only strings**: `PriceInput` (`src/components/ui/price-input.tsx`) renders `1.000.000` via `formatNumber` (`src/lib/format.ts`, dot thousands separator, Colombian convention) while emitting bare digits upward; the submit handler does the numeric conversion.

### Client state: zustand for carts and wizards, URL for filters

`src/stores/cart-store.ts` (persisted to localStorage, capped by `MAX_CART_ITEMS`) backs the "add creators to cart → `/campaigns/new/from-cart`" flow. `src/stores/campaign-wizard-store.ts` holds the multi-step campaign editor including budget math (`getIsOverBudget`, `getBudgetRemaining`).

Profile list filters, pagination, and the detail sheet stay in `searchParams`: `ViewProfileButton` pushes `?view=<profileId>` and `ProfileDetailSheet` (mounted once on `/profiles`) reads it. The page is a server component reading `await searchParams`.

### API route pattern

```ts
const session = await auth();                       // 401 if missing
if (session.user.role !== "ADMIN") …                // 403 where relevant
const body = await parseBody(req, someSchema);      // src/lib/validate-request.ts
if (body instanceof NextResponse) return body;      // 400 with zod issue details
const result = await someDataAccessFn(body);        // src/data-access/*
revalidateTag("<tag>", "<cacheLife profile>");      // if it touches a cached read
return NextResponse.json(result);
```

Catch `ValidationError` → 400 and `NotFoundError` → 404. Dynamic params are Promises (`{ params }: { params: Promise<{ id: string }> }`) and must be awaited.

### Adding a new platform

Data-driven; no schema change needed:
1. Add to the `platforms` array in `prisma/seed.ts`
2. Add its `ServiceType` entries in the same seed (`BOTH` in `profileTypes` is the seed's convention, not a functional requirement — see above)
3. Add an actor + normalizer branch in `src/lib/apify.ts` and to the `platformName === ...` checks in `POST /api/profiles` and `/api/profiles/[id]/sync`

### Prisma singleton

`src/lib/prisma.ts` uses a global singleton to survive HMR. `next.config.ts` marks `@prisma/client` and `bcryptjs` as `serverExternalPackages`; `src/lib/auth.config.ts` redeclares `UserRole` locally rather than importing `@prisma/client`, so the Edge middleware bundle stays clean — keep it that way.

## Deployment (OVH + Dokploy)

Built from the repo `Dockerfile` (three stages on `node:22-alpine`, `output: "standalone"`), published at `https://influencer-manager.losdemarketing.com`. `docker-entrypoint.sh` runs `prisma migrate deploy` before starting the server (`RUN_MIGRATIONS=false` skips it). Health probe at `/api/health` — 200 with a `SELECT 1`, 503 when the DB is down.

Four constraints that will bite anyone editing this app:

1. **`export const dynamic` is a build error here.** `cacheComponents: true` rejects the route-segment config outright. Use `await connection()` from `next/server` instead — that is why the health route and the emails-preview page use it.
2. **`docker build` has no database.** Any page that queries Prisma while being prerendered fails the build. Isolate the query in a child component inside `<Suspense>` **and** call `await connection()` before it — see [src/app/brief/page.tsx](src/app/brief/page.tsx). `<Suspense>` alone is not enough, because `cacheComponents` evaluates `"use cache"` functions at build time to prefill them.
3. **Standalone does not serve runtime-written `public/` files.** The public file list is computed at build, so anything written there afterwards returns 404 even though it exists on disk. That is why uploads live outside `public/`: `src/lib/uploads.ts` resolves `UPLOADS_DIR` (`./uploads` locally, a mounted volume in production) and `/api/uploads/[...ruta]` serves them. Both Apify profile pictures and brief attachments go through it, and stored URLs are `/api/uploads/...`. Setting `BLOB_READ_WRITE_TOKEN` switches profile pictures back to Vercel Blob.
4. **The Prisma CLI cannot be copied piecemeal.** It depends on packages outside `node_modules/prisma` and `node_modules/@prisma` (`effect`, among others); a partial copy dies at startup with `Cannot find module 'effect'`. The Dockerfile installs it into its own tree at `/app/prisma-cli`.

**Migration history drifted once already.** `CampaignBrief`, `Profile.email`, `Profile.phone`, and `CampaignService.clientNotes` were applied with `db push` + raw SQL in `prisma/sql/` and were missing from `prisma/migrations` — recovered in `20260213000000_add_campaign_brief`. After any `db push`, verify before deploying:

```bash
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://postgres:devpass@localhost:5433/shadow_tmp" --exit-code
```

The production DB must run a PostgreSQL image that ships pgvector — the first migration does `CREATE EXTENSION vector` and `pg_trgm`.

**Seeding in production:** `prisma/seed.ts` runs through `ts-node`, a devDependency absent from the image, so the Dockerfile bundles `tsx` alongside the Prisma CLI. Run it once from the container shell with `cd /app && SEED_DEMO=false node ./prisma-cli/node_modules/tsx/dist/cli.mjs prisma/seed.ts`. The `cd` matters — Dokploy's terminal opens at `/`, not the image `WORKDIR`, and both paths in that command are relative. Without `SEED_DEMO=false` the seed also inserts fictional profiles, clients, and campaigns meant only for local development.

## Environment variables

See `.env.example` for the annotated list. Required: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. Behind a reverse proxy also set `AUTH_TRUST_HOST=true`.

Optional / feature-gating: `APIFY_API_TOKEN` (sync returns `null` without it), `ANTHROPIC_API_KEY` (AI prospect search; `/busqueda-ia` answers 503 without it), `BLOB_READ_WRITE_TOKEN` (Vercel Blob uploads), `RESEND_API_KEY` + `RESEND_FROM_EMAIL` + `ENABLE_EMAILS=true` (email is off unless all three are set).

Seeded admin: `admin@example.com` / `admin123`.

## Notes

`planes/` holds Spanish design/refactor notes (migrations to TanStack Query, zod, zustand, the data-access layer, pending features, known obsolete code). They record intent, not necessarily current state — verify against the code before relying on them.
