CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

CREATE OR REPLACE FUNCTION app_private.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles))
$$;

CREATE OR REPLACE FUNCTION app_private.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.profiles where id = _user_id and active)
$$;

CREATE OR REPLACE FUNCTION app_private.is_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select app_private.has_any_role(_user_id, array['dono','gerente']::public.app_role[])
$$;

GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_active_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_manager(uuid) TO authenticated, service_role;

DROP POLICY approvals_insert ON public.approvals;
CREATE POLICY approvals_insert ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria','mecanico']::public.app_role[]));
DROP POLICY approvals_select ON public.approvals;
CREATE POLICY approvals_select ON public.approvals FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY approvals_update ON public.approvals;
CREATE POLICY approvals_update ON public.approvals FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), required_role))
  WITH CHECK (app_private.has_role(auth.uid(), required_role) AND decided_by = auth.uid());

DROP POLICY audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (app_private.is_manager(auth.uid()));

DROP POLICY checklist_items_select ON public.checklist_items;
CREATE POLICY checklist_items_select ON public.checklist_items FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY checklist_items_write ON public.checklist_items;
CREATE POLICY checklist_items_write ON public.checklist_items FOR ALL TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria','mecanico']::public.app_role[]))
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria','mecanico']::public.app_role[]));

DROP POLICY checklists_select ON public.checklists;
CREATE POLICY checklists_select ON public.checklists FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY checklists_write ON public.checklists;
CREATE POLICY checklists_write ON public.checklists FOR ALL TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria','mecanico']::public.app_role[]))
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria','mecanico']::public.app_role[]));

DROP POLICY clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY clients_write ON public.clients;
CREATE POLICY clients_write ON public.clients FOR ALL TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]))
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]));

DROP POLICY companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY companies_write ON public.companies;
CREATE POLICY companies_write ON public.companies FOR ALL TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]))
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]));

DROP POLICY media_delete ON public.media;
CREATE POLICY media_delete ON public.media FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR app_private.is_manager(auth.uid()));
DROP POLICY media_insert ON public.media;
CREATE POLICY media_insert ON public.media FOR INSERT TO authenticated
  WITH CHECK (app_private.is_active_user(auth.uid()) AND created_by = auth.uid());
DROP POLICY media_select ON public.media;
CREATE POLICY media_select ON public.media FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));

DROP POLICY profiles_manage_owner ON public.profiles;
CREATE POLICY profiles_manage_owner ON public.profiles FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'dono'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'dono'::public.app_role));
DROP POLICY profiles_select_staff ON public.profiles;
CREATE POLICY profiles_select_staff ON public.profiles FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));

DROP POLICY purchase_orders_select ON public.purchase_orders;
CREATE POLICY purchase_orders_select ON public.purchase_orders FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY purchase_orders_write ON public.purchase_orders;
CREATE POLICY purchase_orders_write ON public.purchase_orders FOR ALL TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]))
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]));

DROP POLICY quote_items_select ON public.quote_items;
CREATE POLICY quote_items_select ON public.quote_items FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY quote_items_write ON public.quote_items;
CREATE POLICY quote_items_write ON public.quote_items FOR ALL TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria','mecanico']::public.app_role[]))
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria','mecanico']::public.app_role[]));

DROP POLICY quotes_select ON public.quotes;
CREATE POLICY quotes_select ON public.quotes FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY quotes_write ON public.quotes;
CREATE POLICY quotes_write ON public.quotes FOR ALL TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria','mecanico']::public.app_role[]))
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria','mecanico']::public.app_role[]));

DROP POLICY role_permissions_select ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));

DROP POLICY service_orders_delete ON public.service_orders;
CREATE POLICY service_orders_delete ON public.service_orders FOR DELETE TO authenticated
  USING (app_private.is_manager(auth.uid()));
DROP POLICY service_orders_insert ON public.service_orders;
CREATE POLICY service_orders_insert ON public.service_orders FOR INSERT TO authenticated
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]));
DROP POLICY service_orders_select ON public.service_orders;
CREATE POLICY service_orders_select ON public.service_orders FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY service_orders_update ON public.service_orders;
CREATE POLICY service_orders_update ON public.service_orders FOR UPDATE TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]) OR mechanic_id = auth.uid())
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]) OR mechanic_id = auth.uid());

DROP POLICY user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.is_manager(auth.uid()));

DROP POLICY vehicles_select ON public.vehicles;
CREATE POLICY vehicles_select ON public.vehicles FOR SELECT TO authenticated
  USING (app_private.is_active_user(auth.uid()));
DROP POLICY vehicles_write ON public.vehicles;
CREATE POLICY vehicles_write ON public.vehicles FOR ALL TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]))
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','secretaria']::public.app_role[]));

DROP POLICY oficina_media_delete ON storage.objects;
CREATE POLICY oficina_media_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'oficina-media' AND (owner = auth.uid() OR app_private.is_manager(auth.uid())));
DROP POLICY oficina_media_insert ON storage.objects;
CREATE POLICY oficina_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'oficina-media' AND app_private.is_active_user(auth.uid()) AND owner = auth.uid());
DROP POLICY oficina_media_select ON storage.objects;
CREATE POLICY oficina_media_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'oficina-media' AND app_private.is_active_user(auth.uid()));

DROP FUNCTION IF EXISTS public.is_manager(uuid);
DROP FUNCTION IF EXISTS public.is_active_user(uuid);
DROP FUNCTION IF EXISTS public.has_any_role(uuid, public.app_role[]);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);