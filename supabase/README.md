# Supabase setup

FLY runs entirely on Supabase — there is no server to deploy.

## What the app does

Open `/` and a QR code is already on screen. Scan it from a phone, or open the
same link on another laptop, and the two devices can send each other text, URLs
and files. **No account is required for any of that.**

Signing in is optional and only unlocks `/notes`.

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
| `public.profiles` (+ signup trigger) | the non-credential half of the Mongo `users` collection |
| `public.notes` | the Mongo `notes` collection |
| `public.pairing_sessions` | the in-memory `Map` in the old `pairing.service.js` |
| `create_` / `get_` / `touch_` / `end_pairing_session()` | the `/api/pairing` routes |
| `is_live_pairing_session()` | upload authorisation the old endpoint never had |
| buckets `pairing-files`, `note-images` | `multer` + the `uploads/` directory |

## 3. Turn OFF email confirmation

**Authentication → Sign In / Providers → Email → uncheck "Confirm email"**

This is required. Registration is name + email + password and signs the user in
immediately; with confirmation on, Supabase withholds the session and the app
will tell you to come back here and switch it off.

**Authentication → URL Configuration**

- *Site URL*: `http://localhost:5173`
- *Redirect URLs*: add both, so pairing works from a phone on your network:
  - `http://localhost:5173/**`
  - `http://<your-lan-ip>:5173/**` (the Network URL `npm run dev` prints)

## 4. Verify

```bash
npm run verify:supabase
```

Exercises the whole backend with only the anon key — the same access the browser
has. Creates a session, subscribes two devices, checks Presence sees both,
relays a Broadcast message, uploads a file, deletes it again, ends the session,
and confirms the policies actually bite (sessions unlistable, notes unreadable
signed-out, uploads into an unknown session refused).

Exit codes: `0` all passed, `2` schema not applied yet, `1` something failed.

## 5. Run it

```bash
cd FLY-Frontend
npm install
npm run dev
```

Open the **Network** URL rather than `localhost` — a QR code pointing at
`localhost` resolves to the phone itself.

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

- **File deletion is best-effort.** Disconnect clears the bucket, but a user who
  simply closes the tab leaves files behind until you clean them up. Sessions
  expire after 10 minutes of no devices; their files do not disappear with them.
- **`sender` is client-supplied.** The old Express relay stamped it server-side;
  with Broadcast the sending client sets it, so a determined client could claim
  any name. Fine for pairing your own devices.
- **Pairing needs the internet.** Two devices on the same Wi-Fi used to relay
  through your laptop with no outside connection; every message now round-trips
  through Supabase.
- **Free tier caps files at 50 MB**, exactly the app's own limit.
- **Expired sessions** are cleaned by `cleanup_expired_pairing_sessions()`. Call
  it manually, or schedule it if `pg_cron` is enabled:

  ```sql
  select cron.schedule('fly-cleanup', '*/15 * * * *',
                       $$select public.cleanup_expired_pairing_sessions()$$);
  ```
