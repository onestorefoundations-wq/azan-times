# Edge Functions

Two functions back the security model introduced in `../02_security_hardening.sql`.

| Function | Purpose |
| --- | --- |
| `auth` | Login / register / refresh. Verifies the password server-side (bcrypt, inside `app_login`) and mints a tenant-scoped JWT. |
| `media-proxy` | Uploads and deletes on the PHP media server. Holds the shared PHP key and enforces tenant ownership on delete. |

## Why they exist

Before this change the clients authenticated by running

```sql
select tenant_id, username from admin_users
 where username = $1 and password_hash = $2
```

straight from the browser or the APK. That required `SELECT` on `admin_users`
for the `anon` role — and the anon key is embedded in every shipped bundle, so
anyone could read every tenant's credentials. `password_hash` also held the
password verbatim. Both are fixed: `admin_users` is now unreachable by any
client role, and passwords are bcrypt digests.

## Deploy

```bash
supabase functions deploy auth        --no-verify-jwt
supabase functions deploy media-proxy --no-verify-jwt
```

`--no-verify-jwt` on both: `auth` is by definition called without a token, and
`media-proxy` verifies our own HS256 tokens itself rather than deferring to
Supabase Auth.

## Secrets

```bash
supabase secrets set APP_JWT_SECRET="<Settings -> API -> JWT Settings -> JWT Secret>"
supabase secrets set PHP_API_KEY="<the media server's bearer key>"
supabase secrets set ALLOWED_ORIGINS="https://kiosk.example,https://admin.example"
# optional, defaults to the current endpoint:
supabase secrets set PHP_API_URL="https://.../masjidazan/media_api.php"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

`APP_JWT_SECRET` must be the project's **legacy HS256 JWT secret** — PostgREST,
Realtime and Storage verify incoming tokens against it, so a different key
produces tokens every one of them rejects. If the project has migrated to
asymmetric signing keys, mint with the current signing key instead.

Leaving `ALLOWED_ORIGINS` unset falls back to `*`, which is fine locally but not
for something that hands out auth tokens.

## Rotate the PHP key

The old key shipped inside published bundles, so treat it as public: change it
on the PHP server and set the new value as `PHP_API_KEY` here. Nothing else
needs it any more.
