# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Dev server (--webpack flag; Turbopack is NOT used)
npm run build            # Production build (also --webpack)
npm run lint             # ESLint

# Database (Prisma + PostgreSQL)
npm run db:generate      # Regenerate Prisma Client after schema changes
npm run db:push          # Sync schema to DB (no migration history) — the usual dev flow
npm run db:migrate       # prisma migrate dev (for production migrations)
npm run db:seed          # Seed admin user, platforms, service types, categories
npm run db:studio        # Prisma Studio

# One-off data scripts (run via ts-node, same config as the seed)
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/update-currency.ts
```

There is no test suite in this repo.

## Architecture

Influencer/UGC creator management platform: Next.js 16 (App Router, React 19), Prisma/PostgreSQL, NextAuth v5 beta. UI language is Spanish; code comments are mixed Spanish/English.

### Data model shape (the part that trips people up)

`Profile` → `SocialAccount` (one per platform, `@@unique([profileId, platformId])`) → `ProfileService` (price per service type).

**Pricing hangs off `SocialAccount`, not `Profile`.** A `ProfileService` is unique per `[socialAccountId, serviceTypeId]`, so the same service on Instagram and TikTok are two separate rows. Any query touching prices must nest through `socialAccounts.services`. Prices are `Decimal(10,2)`, currency defaults to `"COP"`.

`ServiceType` is scoped by `platformId` **and** a `profileTypes: ProfileType[]` array. A profile of type `BOTH` only sees service types that explicitly list `BOTH` — the seed duplicates `[INFLUENCER, BOTH]` / `[UGC, BOTH]` for this reason. `ProfileForm.getAvailableServices()` reimplements this filter client-side.

Cascade deletes: `Profile` → `SocialAccount` → `ProfileService`, and `Client` → `ClientContact`/`ClientUser`. `ServiceType`, `SocialPlatform`, and `Category` are never cascaded (deleting them requires clearing references first).

### Two separate auth systems

1. **Staff auth** (`src/lib/auth.ts`) — NextAuth v5 Credentials + JWT. `User` with `ADMIN`/`USER` role, injected into the session via the `jwt`/`session` callbacks. Used by `(dashboard)` and `admin` routes and all `/api/*` routes except `client-auth`.
2. **Client portal** (`ClientUser` model, `/client-login`, `/client-dashboard`, `POST /api/client-auth/login`) — a separate bcrypt check that is **not wired into NextAuth**. The login route verifies the password and returns client data with a `TODO: Create session/JWT`; `/client-dashboard` is a placeholder page with no auth check at all. Treat this half as unfinished — do not assume a client session exists anywhere.

### Route protection has two layers, and they don't cover the same paths

`src/middleware.ts` only matches `/dashboard/:path*`, `/admin/:path*`, `/login`, `/register`. But the `(dashboard)` route group renders at `/profiles`, `/clients`, `/categories` — those URLs bypass middleware entirely and rely on the `await auth()` + `redirect("/login")` in `src/app/(dashboard)/layout.tsx`. Adding a page under `(dashboard)` inherits that layout check; adding a top-level page (like `client-dashboard`) inherits nothing. Admin-only pages additionally re-check the role in `src/app/admin/layout.tsx`.

### Access control is inconsistent by design gap, not by intent

- `/api/profiles` GET filters by `createdById` for non-admins.
- `getCachedProfiles()` in `src/lib/cache.ts` deliberately returns **all** profiles to every user (see the `{}` clause commented `"Todos los usuarios pueden ver todos los perfiles"`), and this is what the `/profiles` page actually renders.
- Mutations (`/api/profiles/[id]` PUT/DELETE, sync) check `role === "ADMIN" || createdById === session.user.id`.
- `/api/admin/*` and `/api/clients/[id]/access` require `ADMIN`.

When changing visibility rules, change both the cache function and the API route or they will disagree.

### Caching layer

`src/lib/cache.ts` wraps read queries in `unstable_cache` with a 2-hour `revalidate` and tags: `platforms`, `categories`, `service-types`, `profiles`, `profile`. Server pages call these instead of Prisma directly.

Mutating routes call `revalidateTag("profiles", "max")` / `revalidateTag("profile", "max")` (Next 16's two-arg form). **Gotcha:** the admin routes for platforms and service types do not call `revalidateTag` at all, so those changes take up to 2 hours to appear in forms and filters.

Any new cached read needs a matching `revalidateTag` in every route that writes to it.

### Apify sync

`src/lib/apify.ts` — actors `apify/instagram-profile-scraper` and `clockworks/tiktok-profile-scraper`. `syncSocialAccountMetrics(platform, username)` normalizes both into the `SocialAccount` field names.

Side effect worth knowing: it **downloads the profile picture to `public/uploads/profiles/<username>_<timestamp>.<ext>`** and stores that relative path in `profilePicUrl`. This writes to the filesystem, so it will not survive a read-only/serverless deploy without changes.

Sync runs in two places: inline during `POST /api/profiles` (per account, errors swallowed so creation still succeeds) and on demand via `POST /api/profiles/[id]/sync`. Platform dispatch is by lowercased `platform.name` — a platform whose name isn't `instagram`/`tiktok` is silently skipped.

### Forms

Despite `react-hook-form`/`zod` being installed and `src/components/ui/form.tsx` existing, **no form uses them**. Every form (`profile-form.tsx`, `client-form.tsx`, the `create-*`/`edit-*` dialogs) is plain `useState` + `fetch()` + `router.refresh()`. Match that style rather than introducing RHF into one form in isolation.

Prices flow as **digit-only strings**: `PriceInput` (`src/components/ui/price-input.tsx`) displays `1.000.000` via `formatNumber` from `src/lib/format.ts` (dot thousands separator, Colombian convention) while emitting bare digits upward; the submit handler does the numeric conversion.

### Detail views via URL state

The profile detail panel is URL-driven, not local state: `ViewProfileButton` pushes `?view=<profileId>` and `ProfileDetailSheet` (mounted once at the bottom of `/profiles`) reads that param and fetches `/api/profiles/[id]`. Filters and pagination on that page work the same way — all state lives in `searchParams`, and the page is a server component reading `await searchParams`.

## Key patterns

### Adding a new platform

Data-driven; no schema change needed:
1. Add to the `platforms` array in `prisma/seed.ts`
2. Add its `ServiceType` entries in the same seed (remember to include `BOTH` in `profileTypes`)
3. Add an actor + normalizer branch in `src/lib/apify.ts` and to the `platformName === ...` checks in `POST /api/profiles` and `/api/profiles/[id]/sync`

### API route pattern

`await auth()` first → 401 if no session → 403 if role/ownership check fails → mutate → `revalidateTag` → `NextResponse.json`. Dynamic params are Promises (`{ params }: { params: Promise<{ id: string }> }`) and must be awaited.

### Prisma singleton

`src/lib/prisma.ts` uses a global singleton to survive HMR. `next.config.ts` marks `@prisma/client` and `bcryptjs` as `serverExternalPackages`.

## Environment variables

Required in `.env` / `.env.local`:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — app URL (`http://localhost:3000` in dev)
- `NEXTAUTH_SECRET` — 32+ char random string
- `APIFY_API_TOKEN` — social scraping; without it sync fails gracefully and returns `null`

Seeded admin: `admin@example.com` / `admin123`.
