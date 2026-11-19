-- Supabase creates public.rls_auto_enable() as an event-trigger helper. Event triggers do not need
-- EXECUTE for API roles, so close the RPC endpoint flagged by the security advisor.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
