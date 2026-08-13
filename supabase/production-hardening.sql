-- Apply only after api/pairing.js is deployed and VITE_USE_PAIRING_GATEWAY=true.
-- This closes the direct anonymous RPC path so session creation and short-code
-- lookups cannot bypass the server-side rate limiter.

revoke execute on function public.create_pairing_session() from anon, authenticated;
revoke execute on function public.get_pairing_session_by_code(text) from anon, authenticated;

grant execute on function public.create_pairing_session() to service_role;
grant execute on function public.get_pairing_session_by_code(text) to service_role;
