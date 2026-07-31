revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.has_any_role(uuid, public.app_role[]) from public, anon;
revoke execute on function public.is_manager(uuid) from public, anon;
revoke execute on function public.is_active_user(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.has_any_role(uuid, public.app_role[]) to authenticated, service_role;
grant execute on function public.is_manager(uuid) to authenticated, service_role;
grant execute on function public.is_active_user(uuid) to authenticated, service_role;