CREATE TYPE public.payment_method AS ENUM ('dinheiro','pix','debito','credito','boleto','transferencia','faturado');

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  method public.payment_method NOT NULL DEFAULT 'pix',
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select_financeiro" ON public.payments FOR SELECT TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','contabilidade','secretaria']::app_role[]));
CREATE POLICY "payments_insert_financeiro" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','contabilidade','secretaria']::app_role[]));
CREATE POLICY "payments_update_manager" ON public.payments FOR UPDATE TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','contabilidade']::app_role[]));
CREATE POLICY "payments_delete_owner" ON public.payments FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'dono'::app_role));

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  amount numeric NOT NULL DEFAULT 0,
  spent_at timestamptz NOT NULL DEFAULT now(),
  service_order_id uuid REFERENCES public.service_orders(id) ON DELETE SET NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_select_financeiro" ON public.expenses FOR SELECT TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','contabilidade']::app_role[]));
CREATE POLICY "expenses_write_financeiro" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','contabilidade']::app_role[]));
CREATE POLICY "expenses_update_financeiro" ON public.expenses FOR UPDATE TO authenticated
  USING (app_private.has_any_role(auth.uid(), ARRAY['dono','gerente','contabilidade']::app_role[]));
CREATE POLICY "expenses_delete_owner" ON public.expenses FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'dono'::app_role));

CREATE INDEX payments_os_idx ON public.payments(service_order_id);
CREATE INDEX payments_paid_at_idx ON public.payments(paid_at DESC);
CREATE INDEX expenses_spent_at_idx ON public.expenses(spent_at DESC);