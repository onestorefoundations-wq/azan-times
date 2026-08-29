# Security + sync migration

This is a breaking change. Every client older than it stops syncing the moment
step 1 runs, because the old clients authenticate by reading `admin_users`
directly. Plan the rollout, don't run step 1 and go to lunch.

## What was wrong

**Cross-tenant isolation did not exist.** The anon key ships inside every bundle
and `01_create_db.sql` granted it `USING (true)` on everything:

- `admin_users` was `SELECT`-able by anon, and `password_hash` held the password
  **verbatim** — one query returned every mosque's credentials.
- `mosque_configs` and `device_registry` were fully readable and writable by any
  client for any tenant. Separation was a client-side `.eq('tenant_id', …)`,
  i.e. cosmetic.
- `linkAccount` interpolated the typed identifier into a PostgREST `.or()`
  filter — filter injection.
- The PHP media server's shared bearer key sat in the client source, and its
  delete endpoint takes a bare filename, so any user could delete any mosque's
  media.

**Config sync lost writes.**

- An edit saved while offline was gone for good: the push threw, the local
  `config_version` was never bumped, and the next `syncNow` compared
  `local == remote` and did nothing.
- `increment_and_push_config` was called by both clients but had never been
  created, so every push took the read-increment-write fallback, where two
  devices compute the same next version and one write is silently lost.
- `media_library` was likewise missing from the schema file.
- Nothing enforced one config row per tenant, or scoped `device_id` uniqueness
  to a tenant.
- `online_status` was only ever written `true`, so a TV that lost power stayed
  "online" forever.

## What changed

| Area | Before | After |
| --- | --- | --- |
| Password storage | plaintext in `password_hash` | bcrypt via pgcrypto, hashed inside `app_register` |
| Login | client-side query against `admin_users` | `auth` Edge Function → tenant-scoped JWT |
| RLS | `USING (true)` everywhere | `tenant_id = jwt_tenant_id()`; `admin_users` unreachable by any client role |
| Anon key | full data access | granted nothing |
| Config push | read-increment-write, racy | atomic `increment_and_push_config` |
| Offline edits | silently dropped | `pending_config_push` flag, retried and wins the merge |
| Media upload/delete | PHP key in the bundle, delete by filename | `media-proxy` Edge Function, delete by row id with a tenant check |
| Device liveness | `online_status` latch | `device_status.is_online`, derived from `last_seen` |

Conflict rule when a device has an unpushed local edit and the cloud has moved
on: **the local edit wins** and the conflict is logged. Discarding what someone
just typed on the screen in front of them is the worse failure.

## Rollout order

1. **Deploy the Edge Functions and their secrets first** — see
   `supabase/functions/README.md`. They are inert until step 2, so this is safe
   to do ahead of time.
2. Build and stage the new clients (`react_vite`, `superadmin_web`,
   `flutter_app`) so they are ready to ship.
3. Run `supabase/02_security_hardening.sql`. **Old clients break here.** The
   migration bcrypts existing passwords in place; users keep the passwords they
   have.
4. Ship the clients. Each device has to log in once more — the config already on
   the device is untouched, so a display that has not been re-linked keeps
   showing correct prayer times; it just stops receiving updates.
5. Rotate the PHP media key (the old one was public) and set the new value as
   the `PHP_API_KEY` function secret. The key is no longer hardcoded anywhere:
   `php_server/uploads.php` and the `flutter_app/tool/test_*.dart` probe scripts
   now read `PHP_API_KEY` from the environment, so set it there too. The live
   `media_api.php` is not in this repo — rotate it on the server by hand.

### Accounts registered without a password

The dashboard used to allow passwordless registration, which meant knowing a
username was enough to own a mosque. `app_register` now requires 6+ characters
and both registration forms enforce it. Existing passwordless accounts have an
empty string bcrypted at step 3 — they cannot be logged into and need a password
set by hand:

```sql
set search_path = public, extensions;
update admin_users
   set password_hash = crypt('<new password>', gen_salt('bf', 12))
 where username = '<username>';
```

## Later migrations

`03_section_sync.sql` and `04_public_page.sql` run after `02`, in order. Both are
idempotent.

- **03** gives each config section its own version so concurrent edits stop
  clobbering each other, and moves orientation, the local background path, the
  admin theme and the PIN to a device-local tier that never leaves the device.
  It strips those keys from configs that already stored them.
- **04** adds the opt-in public prayer-times page (`/m/<slug>`). Off for every
  mosque until someone turns it on in settings.

Deploy `public-times` alongside the other two Edge Functions.

The web app builds two entries now — `index.html` for the display and
`masjid.html` for the congregation page — so the host needs rewrites, or QR
links 404 before any JS loads:

    /m, /m/*   ->  /masjid.html
    everything else (non-asset)  ->  /index.html

`react_vite/public/_redirects` covers Netlify and Cloudflare Pages,
`react_vite/vercel.json` covers Vercel. On nginx or Apache write the equivalent
by hand — serving `/m/<slug>` from `index.html` loads the whole TV display on a
phone instead of the prayer-times page.

## Verification

Run as anon (a plain `curl` with the anon key) — every one of these must fail:

```bash
curl "$SUPABASE_URL/rest/v1/admin_users?select=*"    -H "apikey: $ANON"   # 401/permission denied
curl "$SUPABASE_URL/rest/v1/mosque_configs?select=*" -H "apikey: $ANON"   # empty / denied
```

With a token for tenant A, `select * from mosque_configs` must return only
tenant A's row.

For the public page, confirm the payload carries no `display_settings` and so no
`pin_hash`, and that a disabled or unknown mosque is a flat 404:

```bash
curl "$SUPABASE_URL/functions/v1/public-times?slug=<enabled-slug>"   # display fields only
curl "$SUPABASE_URL/functions/v1/public-times?slug=does-not-exist"   # 404
```

## Not verified here

The Flutter changes are unbuilt — no Flutter/Dart toolchain on this machine.
`flutter analyze` and a device run are still needed. In particular confirm that
the resolved `supabase_flutter` accepts the `accessToken:` parameter on
`Supabase.initialize` (added in the 2.x third-party-auth releases; the pubspec
floor is `^2.7.0`). The `react_vite` and `superadmin_web` builds are clean.
