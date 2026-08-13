# Supabase setup

FLY uses Supabase for pairing, Realtime and Storage. Vercel functions add
production rate limiting and privacy-safe telemetry; local development works
without them.

## What the app does

Open `/` and a QR code is already on screen. Scan it from a phone, or open the
same link on another laptop, and the two devices can send each other text, URLs
and files. **No account is required for any of that.**

Pressing **Disconnect** ends the session, deletes every file shared in it from
Storage, and issues a fresh QR code.

---

## 1. Create the project

Create a project at [supabase.com/dashboard](https://supabase.com/dashboard),
then copy **Project Settings → API → Project URL** and the **anon / publishable**
key into `FLY-Frontend/.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

> Use the **anon** key. The `service_role` key bypasses row level security and
> must never be shipped to a browser.

## 2. Run the schema

**SQL Editor → New query**, paste all of [`schema.sql`](./schema.sql), Run. It
is idempotent, so re-running after an edit is safe.

| Object | Replaces |
| --- | --- |
| `public.pairing_sessions` | the in-memory `Map` in the old `pairing.service.js` |
| `create_` / `get_` / `touch_` / `end_pairing_session()` | the `/api/pairing` routes |
| `is_live_pairing_session()` | upload authorisation the old endpoint never had |
| `pairing_rate_limits` + `check_pairing_rate_limit()` | atomic server-side gateway limits |
| private `pairing-files` bucket | `multer` + the `uploads/` directory |

## 3. Verify

```bash
npm run verify:supabase
```

Exercises the whole backend with only the anon key — the same access the browser
has. Creates a session, subscribes two devices, checks Presence sees both,
relays a Broadcast message, uploads a file, deletes it again, ends the session,
and confirms the policies actually bite (sessions unlistable and uploads into
an unknown session refused).

Exit codes: `0` all passed, `2` schema not applied yet, `1` something failed.

## 4. Run it

```bash
cd FLY-Frontend
npm install
npm run dev
```

Open the **Network** URL rather than `localhost` — a QR code pointing at
`localhost` resolves to the phone itself.

## 5. Enable production safeguards

On Vercel, configure these server-only environment variables:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your-server-only-key
RATE_LIMIT_SALT=a-long-random-secret
CRON_SECRET=another-long-random-secret
```

Set these browser build variables:

```text
VITE_USE_PAIRING_GATEWAY=true
VITE_TELEMETRY_ENDPOINT=/api/telemetry
```

The older `SUPABASE_SERVICE_ROLE_KEY` is supported as a fallback, but new
projects should use `SUPABASE_SECRET_KEY`. `api/pairing.js` then protects session creation and join-code attempts with an
IP-derived, salted key. `api/telemetry.js` writes content-free structured events
to Vercel function logs. Never prefix the service-role key with `VITE_`.

After the gateway is deployed and tested, run
[`production-hardening.sql`](./production-hardening.sql) in the SQL Editor. It
revokes direct browser access to the two protected RPCs, preventing someone from
bypassing the gateway. Run `npm run verify:supabase` before this final revoke;
the verification script intentionally exercises the anonymous development path.

## 6. Automatic expired-file cleanup

Add `CRON_SECRET` to the Vercel server environment and redeploy. The cron entry
in `vercel.json` runs `/api/cleanup` daily. It removes files belonging to
expired sessions before deleting their session rows.

`/api/health` is also available for production uptime monitoring.

---

## How pairing works

No table is polled and no row is written per message:

- **Device list** → Realtime **Presence** on channel `pairing:<session-id>`,
  keyed by device id, so a reconnecting device replaces its own entry.
- **Shared items** → Realtime **Broadcast** on the same channel. Text and URLs
  are never persisted anywhere; each device keeps its own history in
  `localStorage`.
- **Session validity** → the `pairing_sessions` row, so a QR link can be checked
  before joining, and sessions survive a restart.
- **Files** → the `pairing-files` bucket under `<session-id>/`. Uploads are only
  accepted into a folder belonging to a *live* session, and deletes are scoped
  the same way.

Access is granted by knowing the session UUID — the same model the old WebSocket
relay used.

## Things to know

- **Pairing files are private.** The app shares one-hour signed download links,
  not permanent public URLs. Re-run `schema.sql` if your project was created
  before this change so the existing bucket is changed to private.
- **Abandoned files are handled by the included cleanup function.** End session
  removes files immediately; the scheduled function handles closed tabs.
- **`sender` is client-supplied.** The old Express relay stamped it server-side;
  with Broadcast the sending client sets it, so a determined client could claim
  any name. Fine for pairing your own devices.
- **Pairing needs the internet.** Two devices on the same Wi-Fi used to relay
  through your laptop with no outside connection; every message now round-trips
  through Supabase.
- **Free tier caps files at 50 MB**, exactly the app's own limit.
- **Empty expired sessions and rate-limit rows** can also be cleaned directly in
  Supabase with:

  ```sql
  select cron.schedule('fly-cleanup', '*/15 * * * *',
                       $$select public.cleanup_expired_pairing_sessions()$$);
  ```
