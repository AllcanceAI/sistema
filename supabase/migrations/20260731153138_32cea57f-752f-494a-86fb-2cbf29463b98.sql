create policy "oficina_media_select" on storage.objects for select to authenticated
using (bucket_id = 'oficina-media' and public.is_active_user(auth.uid()));

create policy "oficina_media_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'oficina-media' and public.is_active_user(auth.uid()) and owner = auth.uid());

create policy "oficina_media_delete" on storage.objects for delete to authenticated
using (bucket_id = 'oficina-media' and (owner = auth.uid() or public.is_manager(auth.uid())));