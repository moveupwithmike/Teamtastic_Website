-- These RPCs finalize scores and are invoked only by authenticated host UI.
-- Their bodies already enforce event-host/platform-admin authorization; make
-- the Data API grants match that contract so anonymous callers cannot reach
-- the privileged functions at all.

revoke execute on function public.resolve_checkout_challenge_item(uuid, uuid, integer) from public, anon;
grant execute on function public.resolve_checkout_challenge_item(uuid, uuid, integer) to authenticated, service_role;

revoke execute on function public.resolve_scribbles_giggles_reveal(uuid, uuid) from public, anon;
grant execute on function public.resolve_scribbles_giggles_reveal(uuid, uuid) to authenticated, service_role;
