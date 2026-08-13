# FLY security review

Reviewed: 2026-08-13

## Protections in place

- Pairing sessions cannot be listed because their table has Row Level Security
  enabled and no direct select policy. A client must know a random UUID or
  six-character code and use the narrow lookup RPC.
- Pairing files are stored in a private bucket. Upload, signed-link creation,
  and deletion are accepted only while the session is live and only within its
  UUID folder.
- Pairing download URLs expire after one hour. Ending a session removes its
  files and invalidates the session identifier.
- Shared links accept only `http` and `https`; text, link notes, history size,
  file names, and file sizes have explicit limits.
- The UI limits accidental message bursts and Supabase Realtime is configured
  with an event-rate cap.
- The optional production pairing gateway applies atomic IP-derived limits to
  session creation and join-code attempts. Raw IP addresses are never stored.
- Deployment headers include a Content Security Policy, frame denial, MIME
  sniffing protection, a strict referrer policy and a restricted permissions
  policy.
- Authentication uses the publishable/anon key. A service-role key must never
  be placed in a `VITE_` environment variable.

## Production follow-ups

- Deploy `api/pairing.js`, set its server-only secrets, and enable
  `VITE_USE_PAIRING_GATEWAY`; direct RPC fallback is intentionally retained for
  local Vite development.
- After verifying the gateway, apply `supabase/production-hardening.sql` to
  revoke the anonymous RPC grants. Without that final deployment step, a custom
  client can still bypass the gateway even though the FLY UI uses it.
- Deploy and schedule `cleanup-expired-files`; source code alone does not create
  a Supabase schedule.
- Six-character codes are convenient but should be protected by the server-side
  rate limit above. The random UUID in QR links remains substantially stronger.
- Note images are currently public URLs even though note records are private.
  Move those images to a private bucket with authenticated signed URLs before
  using Notes for sensitive material.
- Recheck the Content Security Policy if a new third-party analytics, media or
  API domain is introduced.
